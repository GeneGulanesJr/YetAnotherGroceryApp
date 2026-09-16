import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppTextInput, PrimaryButton } from "../components/ui";
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
import { parseMoney } from "../utils/money";

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

  if (permission === null) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted && phase.step === "camera") {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slate-950 px-6">
        <Text className="text-center text-xl font-semibold text-slate-50">
          Camera access needed
        </Text>
        <Text className="text-center text-slate-300">
          Photograph the receipt so OCR can read the line items offline.
        </Text>
        <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-slate-400">Cancel</Text>
        </Pressable>
      </View>
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
      <View className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }}>
          <View className="pointer-events-none absolute inset-x-0 top-28 items-center">
            <View className="h-72 w-72 rounded-xl border-2 border-teal-300/80" />
            <Text className="mt-3 px-8 text-center text-slate-100">
              Fill the frame with the receipt
            </Text>
          </View>
          <View className="absolute inset-x-0 bottom-0 flex-row justify-between bg-black/70 px-6 pb-10 pt-4">
            <Pressable onPress={() => navigation.goBack()} className="rounded-xl bg-slate-800 px-4 py-3">
              <Text className="font-medium text-slate-100">Close</Text>
            </Pressable>
            <Pressable
              onPress={() => void capture()}
              className="h-16 w-16 items-center justify-center rounded-full bg-white"
            >
              <View className="h-12 w-12 rounded-full bg-teal-600" />
            </Pressable>
            <Pressable onPress={startManual} className="rounded-xl bg-slate-800 px-4 py-3">
              <Text className="font-medium text-slate-100">Manual</Text>
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  }

  if (phase.step === "processing") {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-slate-950">
        <Text className="text-lg text-slate-100">Reading receipt…</Text>
        <Text className="text-slate-400">On-device OCR — works offline</Text>
      </View>
    );
  }

  if (phase.step === "saved") {
    return (
      <View className="flex-1 justify-center bg-white px-6 dark:bg-slate-900">
        <Text className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          Receipt saved
        </Text>
        <Text className="mt-3 text-lg text-slate-600 dark:text-slate-300">
          Total {(phase.totalMinor / 100).toFixed(2)} {currency}
        </Text>
        {phase.overchargeMinor !== null && phase.overchargeMinor > 0 ? (
          <Text className="mt-2 text-base font-semibold text-rose-600 dark:text-rose-400">
            ⚠ Possible overcharge: {(phase.overchargeMinor / 100).toFixed(2)} {currency} vs
            recorded shelf prices
          </Text>
        ) : (
          <Text className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Prices matched your recorded shelf prices.
          </Text>
        )}
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
      className="flex-1 bg-white dark:bg-slate-900"
      contentContainerClassName="px-5 py-6 pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-xl font-bold text-slate-900 dark:text-slate-50">
        Confirm receipt lines
      </Text>
      <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Tap a type label to change it. Delete junk lines — nothing is saved until you confirm.
      </Text>

      {phase.lines.map((line) => (
        <View key={line.key} className="mt-3 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() =>
                updateLine(line.key, {
                  lineType: TYPE_CYCLE[(TYPE_CYCLE.indexOf(line.lineType) + 1) % TYPE_CYCLE.length],
                })
              }
              className="rounded-full bg-teal-700 px-3 py-1"
            >
              <Text className="text-xs font-semibold uppercase text-white">{line.lineType}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setPhase({
                  ...phase,
                  lines: phase.lines.filter((l) => l.key !== line.key),
                })
              }
              className="px-2 py-1"
            >
              <Text className="text-slate-400">✕ remove</Text>
            </Pressable>
          </View>
          <AppTextInput
            value={line.description}
            onChangeText={(text) => updateLine(line.key, { description: text })}
            placeholder="Line item"
          />
          <View className="mt-2 flex-row gap-2">
            <View className="w-20">
              <AppTextInput
                value={line.quantity}
                onChangeText={(text) => updateLine(line.key, { quantity: text })}
                keyboardType="number-pad"
                placeholder="qty"
              />
            </View>
            <View className="flex-1">
              <AppTextInput
                value={line.unitPrice}
                onChangeText={(text) => updateLine(line.key, { unitPrice: text })}
                keyboardType="decimal-pad"
                placeholder={`unit price (${currency})`}
              />
            </View>
          </View>
        </View>
      ))}

      <View className="mt-4 gap-3">
        <PrimaryButton
          label="Add line"
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
          variant="secondary"
          onPress={() => setPhase({ step: "camera" })}
        />
      </View>
    </ScrollView>
  );
}
