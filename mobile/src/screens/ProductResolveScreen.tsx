import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Card, EmptyState, Notice, PrimaryButton, Text } from "../components/ui";
import { findByScan } from "../db/repositories/barcodes";
import { getActiveTrip, addProductToTrip } from "../db/repositories/trips";
import { latestPriceForProduct } from "../db/repositories/prices";
import { getDefaultCurrency } from "../db/repositories/meta";
import type { BarcodeMatch } from "../db/repositories/barcodes";
import type { Price, Trip } from "../db/schema";
import { getDatabase } from "../db/database";
import type { RootStackParamList } from "../navigation/types";
import { formatMoney } from "../utils/money";
import {
  normalizeBarcode,
  type ScannedFormat,
} from "../utils/barcode";

type ResolveProps = NativeStackScreenProps<RootStackParamList, "ProductResolve">;

interface ResolvedScan {
  match: BarcodeMatch | null;
  lastPrice: Price | null;
  activeTrip: Trip | null;
}

function resolveScan(rawBarcode: string, format: ScannedFormat): ResolvedScan {
  const db = getDatabase();
  const match = findByScan(db, rawBarcode, format);
  return {
    match,
    lastPrice:
      match === null ? null : (latestPriceForProduct(db, match.product.id) ?? null),
    activeTrip: getActiveTrip(db) ?? null,
  };
}

export function ProductResolveScreen({ navigation, route }: ResolveProps) {
  const rawBarcode = route.params.barcode;
  const format = (route.params.format ?? "unknown") as ScannedFormat;
  const normalized = normalizeBarcode(rawBarcode, format);
  const [{ match, lastPrice, activeTrip }, setResolved] = useState<ResolvedScan>(() =>
    resolveScan(rawBarcode, format),
  );
  const [addedInfo, setAddedInfo] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: match === null ? "New product" : "Scanned product",
    });
  }, [match, navigation]);

  const refresh = () => setResolved(resolveScan(rawBarcode, format));

  if (match === null) {
    return (
      <View className="flex-1 bg-paper px-5 pb-6 dark:bg-paper-dark">
        <EmptyState
          icon="barcode-outline"
          title="Not in your library yet"
          message={`Barcode ${normalized} has not been captured on this phone. Create the product once and later scans will recognize it.`}
        />
        <View className="gap-3">
          <PrimaryButton
            label="Create this product"
            onPress={() => navigation.replace("ManualProduct", { barcode: normalized })}
          />
          <PrimaryButton
            label="Scan something else"
            variant="secondary"
            onPress={() => navigation.replace("Scanner")}
          />
        </View>
      </View>
    );
  }

  const { product } = match;
  const currency = lastPrice?.currency ?? getDefaultCurrency(getDatabase());

  const quickAddToTrip = () => {
    if (activeTrip === null || lastPrice === null) {
      return;
    }
    const result = addProductToTrip(getDatabase(), {
      tripId: activeTrip.id,
      productId: product.id,
      storeId: activeTrip.storeId,
      currency: lastPrice.currency,
      shelfPriceMinor: lastPrice.regularPriceMinor,
      expectedUnitPriceMinor: lastPrice.regularPriceMinor,
      barcode: normalized,
    });
    setAddedInfo(
      result.duplicate
        ? `Quantity increased to ${result.purchase.quantity}`
        : "Added to your active trip",
    );
    refresh();
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-paper-dark"
      contentContainerClassName="flex-grow px-5 py-6"
    >
      <Text variant="meta" tone="meta">
        {normalized}
      </Text>
      <Text variant="display" className="mt-1">
        {product.name}
      </Text>
      {product.brand !== null ? <Text tone="secondary">{product.brand}</Text> : null}
      {product.packageSize !== null ? (
        <Text tone="meta" className="mt-1">
          {product.packageQuantity !== null ? `${product.packageQuantity} × ` : ""}
          {product.packageSize} {product.unit ?? ""}
        </Text>
      ) : null}

      <Card className="mt-6">
        <Text variant="label" tone="secondary">
          Last recorded price
        </Text>
        {lastPrice === null ? (
          <Text tone="meta" className="mt-1">
            No price captured yet
          </Text>
        ) : (
          <View className="mt-1 flex-row items-baseline gap-2">
            <Text variant="title">
              {formatMoney({ amountMinor: lastPrice.regularPriceMinor, currency: lastPrice.currency })}
            </Text>
            <Text variant="meta" tone="meta">
              {lastPrice.capturedAt.toLocaleDateString()}
            </Text>
          </View>
        )}
      </Card>

      {addedInfo !== null ? (
        <View className="mt-4">
          <Notice tone="brand" icon="checkmark-circle-outline">
            {addedInfo}
          </Notice>
        </View>
      ) : null}

      <View className="mt-auto gap-3 pt-6">
        <PrimaryButton
          label="Photograph price tag"
          icon="camera-outline"
          onPress={() => navigation.navigate("PriceTag", { productId: product.id })}
        />
        <PrimaryButton
          label="Type price instead"
          variant="secondary"
          onPress={() => navigation.navigate("PriceCapture", { productId: product.id, barcode: normalized })}
        />
        {activeTrip !== null && lastPrice !== null ? (
          <PrimaryButton label="Add to trip at last price" variant="secondary" onPress={quickAddToTrip} />
        ) : null}
        <PrimaryButton
          label="This is a different product"
          variant="secondary"
          onPress={() => navigation.replace("ManualProduct", { barcode: normalized })}
        />
        <Text variant="meta" tone="meta" className="text-center">
          Currency: {currency}
        </Text>
      </View>
    </ScrollView>
  );
}
