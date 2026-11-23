import { useRef, useState } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
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
import { PriceReview } from "../components/PriceReview";
import { AppTextInput, Card, Chip, Notice, PrimaryButton, Text } from "../components/ui";
import { ingestImage } from "../capture/images";
import { guessItemNames } from "../capture/nameParse";
import { runOcr, type OcrResult } from "../capture/ocr";
import { assessPrice, parsePriceCandidates } from "../capture/priceParse";
import { getDatabase } from "../db/database";
import { findByScan } from "../db/repositories/barcodes";
import { getDefaultCurrency } from "../db/repositories/meta";
import type { ImageRecord } from "../db/schema";
import type { CapturedPrice, RootStackParamList } from "../navigation/types";
import {
  isProbablyBarcode,
  normalizeBarcode,
  rankScannedCodes,
  SCAN_BARCODE_TYPES,
  type ScannedCode,
} from "../utils/barcode";

type SnapItemProps = NativeStackScreenProps<RootStackParamList, "SnapItem">;

interface Shot {
  image: ImageRecord;
  ocr: OcrResult | null;
  /** Every code found, best first; `code` is the one the user is going with. */
  codes: ScannedCode[];
  code: ScannedCode | null;
}

type Phase =
  | { step: "camera" }
  | { step: "processing" }
  | { step: "review"; shot: Shot }
  /** Live scan to add a barcode to a shot that had none; keeps the read price. */
  | { step: "scanBarcode"; shot: Shot }
  | { step: "error"; message: string };

type Scan = { type: string; data: string };

/**
 * Default capture: one photo of the item with its tag. The barcode/QR is
 * decoded from the still (ML Kit, Android) with the last code the live
 * preview saw as a fallback, the price and item name are read by OCR from the
 * tag in the same photo, and the user confirms.
 */
export function SnapItemScreen({ navigation }: SnapItemProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ step: "camera" });
  const [torchOn, setTorchOn] = useState(false);
  const [liveCode, setLiveCode] = useState<Scan | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const capturing = useRef(false);

  useHardwareBack(phase.step !== "camera" && phase.step !== "processing", () =>
    setPhase(phase.step === "scanBarcode" ? { step: "review", shot: phase.shot } : { step: "camera" }),
  );

  if (permission === null) {
    return <View className="flex-1 bg-cam-paper" />;
  }

  if (!permission.granted) {
    return (
      <CameraPermission
        reason="One photo of the item and its price tag gives the barcode and the price, read on this phone. Nothing is saved until you confirm."
        onRequest={() => void requestPermission()}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  const retake = () => {
    setLiveCode(null);
    setPhase({ step: "camera" });
  };

  const capture = async () => {
    if (capturing.current) {
      return;
    }
    capturing.current = true;
    const seenLive = liveCode;
    try {
      // CameraView must stay mounted until the photo resolves: unmounting aborts the capture.
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.95 });
      if (photo === undefined || photo === null) {
        return;
      }
      setPhase({ step: "processing" });
      const [still, { record }] = await Promise.all([
        // Full-resolution still for barcode detail; Expo Go / iOS non-QR yield [].
        scanFromURLAsync(photo.uri, [...SCAN_BARCODE_TYPES]).catch((): Scan[] => []),
        ingestImage(getDatabase(), photo.uri),
      ]);
      // OCR the stored, orientation-normalized copy so the overlay boxes line up with it.
      const ocr = await runOcr(record.localUri ?? photo.uri);
      const codes = rankScannedCodes(seenLive === null ? still : [...still, seenLive]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhase({ step: "review", shot: { image: record, ocr, codes, code: codes[0] ?? null } });
    } catch (cause) {
      setPhase({ step: "error", message: cause instanceof Error ? cause.message : "Capture failed" });
    } finally {
      capturing.current = false;
    }
  };

  const onLiveScan = (scan: Scan) => {
    if (scan.data !== liveCode?.data && rankScannedCodes([scan]).length > 0) {
      setLiveCode(scan);
    }
  };

  if (phase.step === "camera" || phase.step === "scanBarcode") {
    const addingBarcode = phase.step === "scanBarcode";
    return (
      <View className="flex-1 bg-cam-paper">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: [...SCAN_BARCODE_TYPES] }}
          onBarcodeScanned={(scan) => {
            if (phase.step !== "scanBarcode") {
              onLiveScan(scan);
              return;
            }
            const [code] = rankScannedCodes([scan]);
            if (code !== undefined) {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPhase({ step: "review", shot: { ...phase.shot, codes: [code], code } });
            }
          }}
        />
        <CameraGuide
          text={
            addingBarcode
              ? "Point at the product barcode"
              : liveCode !== null
                ? "Barcode found. Keep the price tag in view and take the photo"
                : "Fit the barcode and the price tag in one photo"
          }
          frameClassName={addingBarcode ? "h-40 w-72" : "h-80 w-72"}
        />
        <CameraBar>
          <CameraButton
            icon={addingBarcode ? "arrow-back" : "close"}
            label={addingBarcode ? "Back" : "Close"}
            onPress={() =>
              phase.step === "scanBarcode"
                ? setPhase({ step: "review", shot: phase.shot })
                : navigation.goBack()
            }
          />
          {addingBarcode ? (
            <View className="w-[72px]" />
          ) : (
            <Shutter label="Take photo of item and price tag" onPress={() => void capture()} />
          )}
          <CameraButton
            icon={torchOn ? "flashlight" : "flashlight-outline"}
            label="Torch"
            active={torchOn}
            onPress={() => setTorchOn((on) => !on)}
          />
        </CameraBar>
      </View>
    );
  }

  if (phase.step === "processing") {
    return <Processing title="Reading barcode and price" />;
  }

  if (phase.step === "error") {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-cam-paper px-8">
        <Text tone="camera" className="text-center">
          {phase.message}
        </Text>
        <PrimaryButton label="Try again" onPress={retake} />
      </View>
    );
  }

  const { shot } = phase;
  const db = getDatabase();
  const code = shot.code;
  const normalized = code === null ? null : normalizeBarcode(code.data, code.format);
  const match = code === null ? null : findByScan(db, code.data, code.format);
  const assessment = assessPrice(shot.ocr === null ? [] : parsePriceCandidates(shot.ocr.lines));

  const nameSuggestions = shot.ocr === null ? [] : guessItemNames(shot.ocr.lines);

  const confirm = (price: CapturedPrice) => {
    if (match !== null) {
      navigation.replace("PriceCapture", {
        productId: match.product.id,
        barcode: normalized ?? undefined,
        ...price,
      });
    } else {
      navigation.replace("ManualProduct", { barcode: normalized ?? undefined, price, nameSuggestions });
    }
  };

  return (
    <PriceReview
      image={shot.image}
      ocr={shot.ocr}
      assessment={assessment}
      currency={getDefaultCurrency(db)}
      onRetake={retake}
      onConfirm={confirm}
      header={
        <ShotHeader
          shot={shot}
          productName={match?.product.name ?? null}
          tagName={nameSuggestions[0] ?? null}
          brand={match?.product.brand ?? null}
          normalized={normalized}
          onPick={(picked) => setPhase({ step: "review", shot: { ...shot, code: picked } })}
          onScanLive={() => setPhase({ step: "scanBarcode", shot })}
        />
      }
    />
  );
}

function ShotHeader({
  shot,
  productName,
  tagName,
  brand,
  normalized,
  onPick,
  onScanLive,
}: {
  shot: Shot;
  productName: string | null;
  tagName: string | null;
  brand: string | null;
  normalized: string | null;
  onPick: (code: ScannedCode) => void;
  onScanLive: () => void;
}) {
  const [typed, setTyped] = useState("");
  const typedValid = isProbablyBarcode(typed.trim());

  return (
    <View className="gap-3">
      {shot.codes.length > 1 ? (
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            Several codes in the photo. Which one is the product?
          </Text>
          <View className="flex-row flex-wrap gap-y-3">
            {shot.codes.map((c) => (
              <Chip
                key={c.data}
                label={normalizeBarcode(c.data, c.format)}
                selected={c.data === shot.code?.data}
                onPress={() => onPick(c)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {shot.code === null ? (
        <>
          <Notice tone="brand" icon="barcode-outline">
            No barcode found in the photo. Retake it with the barcode larger, scan it live, or
            type it. Confirming a price without one adds the product without a barcode.
          </Notice>
          <PrimaryButton label="Scan barcode live" icon="scan-outline" variant="secondary" onPress={onScanLive} />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppTextInput
                value={typed}
                onChangeText={setTyped}
                keyboardType="number-pad"
                placeholder="Type the barcode digits"
                onSubmitEditing={() => typedValid && onPick({ data: typed.trim(), format: "unknown" })}
              />
            </View>
            <PrimaryButton
              label="Use"
              variant="secondary"
              disabled={!typedValid}
              onPress={() => onPick({ data: typed.trim(), format: "unknown" })}
            />
          </View>
        </>
      ) : (
        <Card>
          <Text variant="meta" tone="meta">
            {normalized}
          </Text>
          {productName !== null ? (
            <>
              <Text variant="title" className="mt-1">
                {productName}
              </Text>
              {brand !== null ? <Text tone="secondary">{brand}</Text> : null}
            </>
          ) : (
            <>
              <Text variant="title" className="mt-1">
                {tagName ?? "New product"}
              </Text>
              <Text tone="secondary">
                {tagName === null
                  ? "Not saved yet. You will name it after confirming the price."
                  : "New product, name read from the tag. You can edit it next."}
              </Text>
            </>
          )}
        </Card>
      )}
    </View>
  );
}
