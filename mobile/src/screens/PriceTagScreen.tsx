import { useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OCRTextOverlay } from "expo-mlkit-ocr";

import { AppTextInput, PrimaryButton } from "../components/ui";
import { ingestImage } from "../capture/images";
import { ocrAvailable, runOcr, type OcrResult } from "../capture/ocr";
import { parsePriceCandidates, type PriceCandidate } from "../capture/priceParse";
import { getDatabase } from "../db/database";
import type { ImageRecord } from "../db/schema";
import type { RootStackParamList } from "../navigation/types";
import { formatMoney } from "../utils/money";

type PriceTagProps = NativeStackScreenProps<RootStackParamList, "PriceTag">;

type Phase =
  | { step: "camera" }
  | { step: "processing" }
  | { step: "review"; image: ImageRecord; ocr: OcrResult | null }
  | { step: "error"; message: string };

/**
 * Spec capture flow: take a high-resolution still, run on-device OCR, show a
 * tap-to-confirm overlay, then hand the confirmed value to price capture.
 * Raw value, confidence, and source image travel with it.
 */
export function PriceTagScreen({ navigation, route }: PriceTagProps) {
  const { productId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ step: "camera" });
  const [manualAmount, setManualAmount] = useState("");
  const cameraRef = useRef<CameraView>(null);

  if (permission === null) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slate-950 px-6">
        <Text className="text-center text-xl font-semibold text-slate-50">
          Camera access needed
        </Text>
        <Text className="text-center text-slate-300">
          The camera photographs shelf price tags so OCR can read them offline.
        </Text>
        <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-slate-400">Cancel</Text>
        </Pressable>
      </View>
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

  const confirmCandidate = (candidate: PriceCandidate) => {
    navigation.replace("PriceCapture", {
      productId,
      prefillAmount: candidate.normalized,
      ocrRawText: candidate.raw,
      ocrConfidence: candidate.confidence,
      sourceImageId: phase.step === "review" ? phase.image.id : undefined,
    });
  };

  const confirmManual = () => {
    if (manualAmount.trim() === "") {
      return;
    }
    navigation.replace("PriceCapture", {
      productId,
      prefillAmount: manualAmount.trim(),
      sourceImageId: phase.step === "review" ? phase.image.id : undefined,
    });
  };

  if (phase.step === "camera") {
    return (
      <View className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} zoom={0}>
          <View className="pointer-events-none absolute inset-x-0 top-28 items-center">
            <View className="h-24 w-64 rounded-xl border-2 border-teal-300/80" />
            <Text className="mt-3 px-8 text-center text-slate-100">
              Frame the price tag, then capture
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
            <View className="w-16" />
          </View>
        </CameraView>
      </View>
    );
  }

  if (phase.step === "processing") {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-slate-950">
        <Text className="text-lg text-slate-100">Reading price tag…</Text>
        <Text className="text-slate-400">On-device OCR — works offline</Text>
      </View>
    );
  }

  if (phase.step === "error") {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slate-950 px-6">
        <Text className="text-lg text-slate-100">{phase.message}</Text>
        <PrimaryButton label="Try again" onPress={() => setPhase({ step: "camera" })} />
      </View>
    );
  }

  const { image, ocr } = phase;
  const candidates = ocr === null ? [] : parsePriceCandidates(ocr.lines);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="pb-10">
      <View className="h-80 bg-slate-950">
        {ocr !== null ? (
          <OCRTextOverlay
            result={ocr.raw}
            imageWidth={image.width ?? 1}
            imageHeight={image.height ?? 1}
            resizeMode="contain"
            highlightLevel="line"
            boxColor="#5eead4"
            selectedBoxColor="#f59e0b"
            style={{ flex: 1 }}
          >
            <Image
              source={{ uri: image.localUri ?? undefined }}
              style={{ flex: 1, resizeMode: "contain" }}
            />
          </OCRTextOverlay>
        ) : (
          <Image
            source={{ uri: image.localUri ?? undefined }}
            style={{ flex: 1, resizeMode: "contain" }}
          />
        )}
      </View>

      <View className="px-6 pt-5">
        {ocr === null ? (
          <Text className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            {ocrAvailable()
              ? "OCR found no text — enter the price manually."
              : "OCR needs the development build (Expo Go does not include ML Kit). Enter the price manually."}
          </Text>
        ) : candidates.length === 0 ? (
          <Text className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            No price recognized — tap the tag to retake, or type the price below.
          </Text>
        ) : (
          <>
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Detected prices — confirm one
            </Text>
            <View className="mb-4 gap-2">
              {candidates.slice(0, 5).map((candidate, index) => (
                <Pressable
                  key={`${candidate.minor}-${index}`}
                  onPress={() => confirmCandidate(candidate)}
                  className="flex-row items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800"
                >
                  <Text className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {formatMoney({ amountMinor: candidate.minor, currency: "PHP" })}
                  </Text>
                  <Text className="max-w-48 text-right text-xs text-slate-500 dark:text-slate-400">
                    {candidate.raw}
                    {candidate.unitPrice ? " · unit price" : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Or type the price
        </Text>
        <AppTextInput
          value={manualAmount}
          onChangeText={setManualAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 123.45"
          onSubmitEditing={confirmManual}
        />
        <View className="mt-3 gap-3">
          <PrimaryButton label="Use typed price" onPress={confirmManual} />
          <PrimaryButton
            label="Retake photo"
            variant="secondary"
            onPress={() => setPhase({ step: "camera" })}
          />
        </View>
      </View>
    </ScrollView>
  );
}
