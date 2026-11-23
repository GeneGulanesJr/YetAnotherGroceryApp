import { useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { OCRTextOverlay } from "expo-mlkit-ocr";
import { StatusBar } from "expo-status-bar";

import { ocrAvailable, type OcrResult } from "../capture/ocr";
import type { PriceAssessment, PriceCandidate } from "../capture/priceParse";
import type { ImageRecord } from "../db/schema";
import type { CapturedPrice } from "../navigation/types";
// OCR boxes sit on the photo, which is always on the Night camera ground.
import { palettes, useTokens } from "../theme/tokens";
import { formatMoney } from "../utils/money";
import { AppTextInput, Notice, PrimaryButton, Text } from "./ui";

/**
 * The one confirm step for photographed prices (tech.mobile.md OCR path):
 * photo with OCR overlay, ranked candidates, and a typed fallback. Nothing is
 * saved here; the caller receives the confirmed value with its provenance.
 */
export function PriceReview({
  image,
  ocr,
  assessment,
  currency,
  header,
  onConfirm,
  onRetake,
}: {
  image: ImageRecord;
  ocr: OcrResult | null;
  assessment: PriceAssessment;
  currency: string;
  /** Product / barcode block shown above the prices. */
  header?: ReactNode;
  onConfirm: (price: CapturedPrice) => void;
  onRetake: () => void;
}) {
  const t = useTokens();
  const [manualAmount, setManualAmount] = useState("");
  const { candidates, clear } = assessment;
  const money = (minor: number) => formatMoney({ amountMinor: minor, currency });

  const confirmCandidate = (candidate: PriceCandidate) =>
    onConfirm({
      prefillAmount: candidate.normalized,
      ocrRawText: candidate.raw,
      ocrConfidence: candidate.confidence,
      sourceImageId: image.id,
    });

  const confirmManual = () => {
    if (manualAmount.trim() !== "") {
      onConfirm({ prefillAmount: manualAmount.trim(), sourceImageId: image.id });
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {/* The photo band is always dark. */}
      <StatusBar style="light" />
      <View className="h-72 bg-cam-paper">
        {ocr !== null ? (
          <OCRTextOverlay
            result={ocr.raw}
            imageWidth={image.width ?? 1}
            imageHeight={image.height ?? 1}
            resizeMode="contain"
            highlightLevel="line"
            boxColor={palettes.night.brandText}
            selectedBoxColor={palettes.night.ink}
            style={{ flex: 1 }}
          >
            <Image source={{ uri: image.localUri ?? undefined }} style={{ flex: 1, resizeMode: "contain" }} />
          </OCRTextOverlay>
        ) : (
          <Image source={{ uri: image.localUri ?? undefined }} style={{ flex: 1, resizeMode: "contain" }} />
        )}
      </View>

      <View className="gap-4 px-5 pt-5">
        {header}

        {ocr === null ? (
          <Notice icon="text-outline">
            {ocrAvailable()
              ? "No text found in the photo. Retake it closer to the tag, or type the price."
              : "Reading prices needs the development build (Expo Go has no ML Kit). Type the price below."}
          </Notice>
        ) : !clear ? (
          <Notice>Price not clear. Retake a closer photo of the tag, or type it.</Notice>
        ) : null}

        {candidates.length > 0 ? (
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {clear ? "Tap the price to confirm" : "Possible prices"}
            </Text>
            {candidates.slice(0, 5).map((candidate, index) => (
              <Pressable
                key={`${candidate.minor}-${index}`}
                onPress={() => confirmCandidate(candidate)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${money(candidate.minor)}`}
                android_ripple={{ color: t.line }}
                className="min-h-14 flex-row items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 border-outline bg-card px-4 py-3"
              >
                <Text variant="title" tone={index === 0 && clear ? "brand" : "primary"}>
                  {money(candidate.minor)}
                </Text>
                <Text variant="meta" tone="meta" numberOfLines={2} className="flex-1 text-right">
                  {candidate.unitPrice ? `${candidate.raw}, unit price` : candidate.raw}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View>
          <Text variant="label" tone="secondary" className="mb-1.5">
            Or type the price ({currency})
          </Text>
          <AppTextInput
            value={manualAmount}
            onChangeText={setManualAmount}
            keyboardType="decimal-pad"
            placeholder="e.g. 123.45"
            onSubmitEditing={confirmManual}
          />
        </View>
        <View className="gap-3">
          <PrimaryButton
            label="Use typed price"
            variant={clear ? "secondary" : "primary"}
            disabled={manualAmount.trim() === ""}
            onPress={confirmManual}
          />
          <PrimaryButton
            label="Retake photo"
            icon="camera-reverse-outline"
            variant="secondary"
            onPress={onRetake}
          />
        </View>
      </View>
    </ScrollView>
  );
}
