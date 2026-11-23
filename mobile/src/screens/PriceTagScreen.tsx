import { useRef, useState } from "react";
import { View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
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
import { PrimaryButton, Text } from "../components/ui";
import { ingestImage } from "../capture/images";
import { runOcr, type OcrResult } from "../capture/ocr";
import { assessPrice, parsePriceCandidates } from "../capture/priceParse";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import type { ImageRecord } from "../db/schema";
import type { RootStackParamList } from "../navigation/types";

type PriceTagProps = NativeStackScreenProps<RootStackParamList, "PriceTag">;

type Phase =
  | { step: "camera" }
  | { step: "processing" }
  | { step: "review"; image: ImageRecord; ocr: OcrResult | null }
  | { step: "error"; message: string };

/**
 * Price-tag photo for an already-known product: take a still, run on-device
 * OCR, confirm in the shared PriceReview, then hand the confirmed value to
 * price capture. Raw value, confidence, and source image travel with it.
 */
export function PriceTagScreen({ navigation, route }: PriceTagProps) {
  const { productId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ step: "camera" });
  const [torchOn, setTorchOn] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useHardwareBack(phase.step === "review" || phase.step === "error", () =>
    setPhase({ step: "camera" }),
  );

  if (permission === null) {
    return <View className="flex-1 bg-paper-dark" />;
  }

  if (!permission.granted) {
    return (
      <CameraPermission
        reason="The camera photographs shelf price tags so the price can be read on this phone, offline."
        onRequest={() => void requestPermission()}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  const capture = async () => {
    setPhase({ step: "processing" });
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.95 });
      if (photo === undefined || photo === null) {
        setPhase({ step: "camera" });
        return;
      }
      const { record } = await ingestImage(getDatabase(), photo.uri);
      const ocr = await runOcr(record.localUri ?? record.thumbnailUri ?? photo.uri);
      setPhase({ step: "review", image: record, ocr });
    } catch (cause) {
      setPhase({
        step: "error",
        message: cause instanceof Error ? cause.message : "Capture failed",
      });
    }
  };

  if (phase.step === "camera") {
    return (
      <View className="flex-1 bg-paper-dark">
        <CameraView ref={cameraRef} style={{ flex: 1 }} zoom={0} enableTorch={torchOn} />
        <CameraGuide text="Frame the price tag, then capture" frameClassName="h-28 w-72" />
        <CameraBar>
          <CameraButton icon="close" label="Close" onPress={() => navigation.goBack()} />
          <Shutter label="Take photo of price tag" onPress={() => void capture()} />
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
    return <Processing title="Reading the price tag" />;
  }

  if (phase.step === "error") {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper-dark px-8">
        <Text tone="camera" className="text-center">
          {phase.message}
        </Text>
        <PrimaryButton label="Try again" onPress={() => setPhase({ step: "camera" })} />
      </View>
    );
  }

  const { image, ocr } = phase;
  return (
    <PriceReview
      image={image}
      ocr={ocr}
      assessment={assessPrice(ocr === null ? [] : parsePriceCandidates(ocr.lines))}
      currency={getDefaultCurrency(getDatabase())}
      onRetake={() => setPhase({ step: "camera" })}
      onConfirm={(price) => navigation.replace("PriceCapture", { productId, ...price })}
    />
  );
}
