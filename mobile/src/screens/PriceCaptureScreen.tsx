import { useState } from "react";
import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppTextInput, Chip, Field, Notice, PrimaryButton, Text } from "../components/ui";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import { recordPrice } from "../db/repositories/prices";
import {
  addProductToTrip,
  getActiveTrip,
  getTripPurchases,
  tripTotalMinor,
} from "../db/repositories/trips";
import type { RootStackParamList } from "../navigation/types";
import { budgetStatus, formatMoney, parseMoney } from "../utils/money";

type PriceCaptureProps = NativeStackScreenProps<RootStackParamList, "PriceCapture">;

type PriceType = "regular" | "promotional" | "loyalty";

/**
 * The save step for every shelf price: typed, or confirmed from a photo (OCR
 * or barcode), whose raw text, confidence and source image are stored with
 * it. Prices are captured per product+store+time and, when a trip is active,
 * the item joins the running trip; a duplicate scan raises the quantity.
 */
export function PriceCaptureScreen({ navigation, route }: PriceCaptureProps) {
  const { productId, barcode, prefillAmount, ocrRawText, ocrConfidence, sourceImageId } =
    route.params;
  const [amount, setAmount] = useState(prefillAmount ?? "");
  const [priceType, setPriceType] = useState<PriceType>("regular");
  const [taxIncluded, setTaxIncluded] = useState(true);
  const currency = getDefaultCurrency(getDatabase());
  const activeTrip = getActiveTrip(getDatabase());
  const tripActive = activeTrip !== undefined;
  const spentMinor = tripActive ? tripTotalMinor(getTripPurchases(getDatabase(), activeTrip.id)) : 0;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const money = parseMoney(amount, currency);
    if (money.amountMinor <= 0) {
      setError("Enter the price printed on the shelf tag");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const db = getDatabase();
      recordPrice(db, {
        productId,
        storeId: null,
        currency: money.currency,
        // The schema requires regularPriceMinor; typed captures mirror into
        // it so unit-price math stays possible. The typed field is also set.
        regularPriceMinor: money.amountMinor,
        promotionalPriceMinor: priceType === "promotional" ? money.amountMinor : null,
        loyaltyPriceMinor: priceType === "loyalty" ? money.amountMinor : null,
        expectedCheckoutPriceMinor: money.amountMinor,
        taxIncluded,
        capturedAt: new Date(),
        sourceImageId: sourceImageId ?? null,
        ocrRawText: ocrRawText ?? null,
        ocrConfidence: ocrConfidence ?? null,
      });

      let addedToTrip = false;
      const trip = getActiveTrip(db);
      if (trip !== undefined) {
        addProductToTrip(db, {
          tripId: trip.id,
          productId,
          storeId: trip.storeId,
          currency: money.currency,
          shelfPriceMinor: money.amountMinor,
          expectedUnitPriceMinor: money.amountMinor,
          barcode: barcode ?? null,
        });
        addedToTrip = true;
      }

      setSaving(false);
      if (addedToTrip) {
        navigation.replace("SnapItem");
      } else {
        navigation.goBack();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the price");
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-paper-dark"
      contentContainerClassName="px-5 py-6"
      keyboardShouldPersistTaps="handled"
    >
      <Field
        label={`Price (${currency})`}
        hint={ocrRawText !== undefined ? `Read from the photo: ${ocrRawText}` : undefined}
      >
        <AppTextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 123.45"
          autoFocus={prefillAmount === undefined}
        />
      </Field>

      <Field label="Price type">
        <View className="flex-row flex-wrap gap-y-3">
          <Chip label="Regular" selected={priceType === "regular"} onPress={() => setPriceType("regular")} />
          <Chip label="Promo" selected={priceType === "promotional"} onPress={() => setPriceType("promotional")} />
          <Chip label="Loyalty" selected={priceType === "loyalty"} onPress={() => setPriceType("loyalty")} />
        </View>
      </Field>

      <Field label="Tax included in this price?">
        <View className="flex-row flex-wrap gap-y-3">
          <Chip label="Yes" selected={taxIncluded} onPress={() => setTaxIncluded(true)} />
          <Chip label="No" selected={!taxIncluded} onPress={() => setTaxIncluded(false)} />
        </View>
      </Field>

      {amount.trim() !== "" ? (
        <View className="mb-5 flex-row items-baseline justify-between">
          <Text tone="secondary">Will be recorded as</Text>
          <Text variant="title" tone="brand">
            {formatMoney(parseMoney(amount, currency))}
          </Text>
        </View>
      ) : null}

      {tripActive ? (
        <View className="mb-5">
          <Notice tone="brand" icon="cart-outline">
            A run is in progress, so this item joins it. Snapping the same product again raises its
            quantity.
          </Notice>
        </View>
      ) : null}

      {activeTrip?.budgetMinor != null && parseMoney(amount, currency).amountMinor > 0 ? (
        <BudgetAfter
          budgetMinor={activeTrip.budgetMinor}
          spentMinor={spentMinor + parseMoney(amount, currency).amountMinor}
          currency={currency}
        />
      ) : null}

      {error !== null ? (
        <View className="mb-4">
          <Notice>{error}</Notice>
        </View>
      ) : null}

      <PrimaryButton
        label={tripActive ? "Save and snap next item" : "Save price"}
        onPress={save}
        loading={saving}
      />
    </ScrollView>
  );
}

/** What the run's budget looks like once this item is added. */
function BudgetAfter({
  budgetMinor,
  spentMinor,
  currency,
}: {
  budgetMinor: number;
  spentMinor: number;
  currency: string;
}) {
  const status = budgetStatus(budgetMinor, spentMinor);
  const left = formatMoney({ amountMinor: Math.abs(status.remainingMinor), currency });
  return (
    <View className="mb-5 flex-row items-baseline justify-between">
      <Text tone="secondary">{status.over ? "Over budget after this" : "Budget left after this"}</Text>
      <Text variant="title" tone={status.over ? "caution" : "brand"}>
        {left}
      </Text>
    </View>
  );
}
