import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  CameraBar,
  CameraButton,
  CameraGuide,
  CameraPermission,
  Processing,
  Shutter,
  useHardwareBack,
} from "../components/camera";
import { AppTextInput, Card, Notice, PrimaryButton, Text } from "../components/ui";
import { ingestImage } from "../capture/images";
import { ocrAvailable, runOcr } from "../capture/ocr";
import {
  classifyReceiptLines,
  type ReceiptLineType,
} from "../capture/receiptParse";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import {
  createReceiptWithLines,
  type ConfirmedReceiptLine,
} from "../db/repositories/receipts";
import { getActiveTrip } from "../db/repositories/trips";
import type { RootStackParamList } from "../navigation/types";
import { useTokens } from "../theme/tokens";
import { formatMoney, parseMoney } from "../utils/money";

type ReceiptProps = NativeStackScreenProps<RootStackParamList, "ReceiptCapture">;

interface EditableLine {
  key: string;
  lineType: ReceiptLineType;
  description: string;
  quantity: string;
  unitPrice: string;
}

const TYPE_CYCLE: ReceiptLineType[] = [
  "product",
  "total",
  "subtotal",
  "tax",
  "discount",
  "payment",
  "unknown",
];

type Phase =
  | { step: "camera" }
  | { step: "processing" }
  | { step: "edit"; lines: EditableLine[]; rawOcrText: string | null; sourceImageId: string | null }
  | { step: "saved"; totalMinor: number; overchargeMinor: number | null };

let lineKey = 0;
function nextKey(): string {
  lineKey += 1;
  return `line-${lineKey}`;
}

/**
 * Receipt verification v1: photo -> on-device OCR -> classified editable
 * lines -> confirmed save (transactional) with trip matching and shelf-vs-
 * receipt discrepancy reporting.
 */
export function ReceiptCaptureScreen({ navigation }: ReceiptProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ step: "camera" });
  const cameraRef = useRef<CameraView>(null);
  const currency = getDefaultCurrency(getDatabase());
  const t = useTokens();

  useHardwareBack(phase.step === "edit", () => setPhase({ step: "camera" }));

  if (permission === null) {
    return <View className="flex-1 bg-paper-dark" />;
  }

  if (!permission.granted && phase.step === "camera") {
    return (
      <CameraPermission
        reason="Photograph the receipt so its lines can be read on this phone, offline."
        onRequest={() => void requestPermission()}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  const startManual = () => {
    setPhase({
      step: "edit",
      lines: [
        {
          key: nextKey(),
          lineType: "product",
          description: "",
          quantity: "1",
          unitPrice: "",
        },
      ],
      rawOcrText: null,
      sourceImageId: null,
    });
  };

  const capture = async () => {
    setPhase({ step: "processing" });
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.95 });
      if (photo === undefined || photo === null) {
        setPhase({ step: "camera" });
        return;
      }
      const { record } = await ingestImage(getDatabase(), photo.uri);
      const ocr = await runOcr(record.localUri ?? photo.uri);
      if (ocr === null) {
        if (!ocrAvailable()) {
          startManual();
          return;
        }
        setPhase({
          step: "edit",
          lines: [{ key: nextKey(), lineType: "product", description: "", quantity: "1", unitPrice: "" }],
          rawOcrText: null,
          sourceImageId: record.id,
        });
        return;
      }
      const parsed = classifyReceiptLines(ocr.text.split("\n").filter((l) => l.trim() !== ""));
      const lines: EditableLine[] = parsed
        .filter((line) => line.lineType !== "header" && line.lineType !== "footer")
        .map((line) => ({
          key: nextKey(),
          lineType: line.lineType,
          description: line.descriptionRaw ?? "",
          quantity: line.quantity === null ? "" : String(line.quantity),
          unitPrice: line.unitPriceMinor === null ? "" : (line.unitPriceMinor / 100).toFixed(2),
        }));
      setPhase({
        step: "edit",
        lines: lines.length === 0 ? [{ key: nextKey(), lineType: "product", description: "", quantity: "1", unitPrice: "" }] : lines,
        rawOcrText: ocr.text,
        sourceImageId: record.id,
      });
    } catch {
      setPhase({ step: "camera" });
    }
  };

  const save = () => {
    if (phase.step !== "edit") {
      return;
    }
    const db = getDatabase();
    const trip = getActiveTrip(db);
    const confirmed: ConfirmedReceiptLine[] = phase.lines
      .filter((line) => line.description.trim() !== "" || line.unitPrice.trim() !== "")
      .map((line) => {
        const unitPriceMinor = parseMoney(line.unitPrice, currency).amountMinor;
        const quantity = Number(line.quantity) > 0 ? Number(line.quantity) : null;
        return {
          lineType: line.lineType,
          descriptionRaw: line.description.trim(),
          descriptionCorrected: line.description.trim(),
          quantity,
          unitPriceMinor: unitPriceMinor > 0 ? unitPriceMinor : null,
          lineTotalMinor:
            unitPriceMinor > 0 ? unitPriceMinor * (quantity ?? 1) : null,
        };
      });

    const receipt = createReceiptWithLines(db, {
      tripId: trip?.id ?? null,
      storeId: trip?.storeId ?? null,
      currency,
      sourceImageId: phase.sourceImageId,
      rawOcrText: phase.rawOcrText,
      lines: confirmed,
    });
    setPhase({
      step: "saved",
      totalMinor: receipt.totalMinor ?? 0,
      overchargeMinor: receipt.overchargeMinor,
    });
  };

  if (phase.step === "camera") {
    return (
      <View className="flex-1 bg-paper-dark">
        <CameraView ref={cameraRef} style={{ flex: 1 }} />
        <CameraGuide text="Fill the frame with the receipt" frameClassName="h-96 w-72" />
        <CameraBar>
          <CameraButton icon="close" label="Close" onPress={() => navigation.goBack()} />
          <Shutter label="Take photo of receipt" onPress={() => void capture()} />
          <CameraButton icon="create-outline" label="Type" onPress={startManual} />
        </CameraBar>
      </View>
    );
  }

  if (phase.step === "processing") {
    return <Processing title="Reading the receipt" />;
  }

  if (phase.step === "saved") {
    const over = phase.overchargeMinor !== null && phase.overchargeMinor > 0;
    return (
      <View className="flex-1 justify-center bg-paper px-5 dark:bg-paper-dark">
        <Text variant="display">Receipt saved</Text>
        <Text variant="title" tone="brand" className="mt-3">
          {formatMoney({ amountMinor: phase.totalMinor, currency })}
        </Text>
        <View className="mt-4">
          {over ? (
            <Notice>
              Possible overcharge of {formatMoney({ amountMinor: phase.overchargeMinor ?? 0, currency })}{" "}
              against the shelf prices you recorded.
            </Notice>
          ) : (
            <Notice tone="brand" icon="checkmark-circle-outline">
              Prices matched the shelf prices you recorded.
            </Notice>
          )}
        </View>
        <View className="mt-8">
          <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  const updateLine = (key: string, patch: Partial<EditableLine>) => {
    setPhase({
      ...phase,
      lines: phase.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-paper-dark"
      contentContainerClassName="px-5 pb-12"
      contentContainerStyle={{ paddingTop: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="display">Confirm receipt lines</Text>
      <Text tone="secondary" className="mt-1">
        Tap the type on a line to change it, and remove junk lines. Nothing is saved until you confirm.
      </Text>

      {phase.lines.map((line) => (
        <Card key={line.key} className="mt-3 gap-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() =>
                updateLine(line.key, {
                  lineType: TYPE_CYCLE[(TYPE_CYCLE.indexOf(line.lineType) + 1) % TYPE_CYCLE.length],
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Line type ${line.lineType}, tap to change`}
              hitSlop={8}
              className="min-h-8 justify-center rounded-md bg-tint px-2.5 dark:bg-tint-dark"
            >
              <Text variant="meta" tone="brand" className="font-medium">
                {line.lineType}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPhase({ ...phase, lines: phase.lines.filter((l) => l.key !== line.key) })}
              accessibilityRole="button"
              accessibilityLabel="Remove line"
              android_ripple={{ color: t.line, borderless: true }}
              className="h-12 w-12 items-center justify-center"
            >
              <Ionicons name="close" size={20} color={t.ink3} />
            </Pressable>
          </View>
          <AppTextInput
            value={line.description}
            onChangeText={(text) => updateLine(line.key, { description: text })}
            placeholder="Line item"
          />
          <View className="flex-row gap-2">
            <View className="w-20">
              <AppTextInput
                value={line.quantity}
                onChangeText={(text) => updateLine(line.key, { quantity: text })}
                keyboardType="number-pad"
                placeholder="Qty"
              />
            </View>
            <View className="flex-1">
              <AppTextInput
                value={line.unitPrice}
                onChangeText={(text) => updateLine(line.key, { unitPrice: text })}
                keyboardType="decimal-pad"
                placeholder={`Unit price (${currency})`}
              />
            </View>
          </View>
        </Card>
      ))}

      <View className="mt-4 gap-3">
        <PrimaryButton
          label="Add line"
          icon="add"
          variant="secondary"
          onPress={() =>
            setPhase({
              ...phase,
              lines: [
                ...phase.lines,
                { key: nextKey(), lineType: "product", description: "", quantity: "1", unitPrice: "" },
              ],
            })
          }
        />
        <PrimaryButton label="Save receipt" onPress={save} />
        <PrimaryButton
          label="Retake photo"
          icon="camera-reverse-outline"
          variant="secondary"
          onPress={() => setPhase({ step: "camera" })}
        />
      </View>
    </ScrollView>
  );
}
