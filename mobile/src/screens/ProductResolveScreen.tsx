import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { EmptyState, PrimaryButton } from "../components/ui";
import { findByBarcode } from "../db/repositories/barcodes";
import { getActiveTrip, addProductToTrip } from "../db/repositories/trips";
import { latestPriceForProduct } from "../db/repositories/prices";
import { getDefaultCurrency } from "../db/repositories/meta";
import type { BarcodeMatch } from "../db/repositories/barcodes";
import type { Price, Trip } from "../db/schema";
import { getDatabase } from "../db/database";
import type { RootStackParamList } from "../navigation/types";
import { formatMoney } from "../utils/money";
import {
  barcodeLookupKeys,
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
  const keys = barcodeLookupKeys(rawBarcode, format);
  const match = keys.map((key) => findByBarcode(db, key)).find((m) => m !== null) ?? null;
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
      <View className="flex-1 bg-white px-6 py-8 dark:bg-slate-900">
        <EmptyState
          title="Not in your library yet"
          message={`Barcode ${normalized} has not been captured on this device. Create the product once — later scans of the same barcode will recognize it.`}
        />
        <PrimaryButton
          label="Create this product"
          onPress={() =>
            navigation.replace("ManualProduct", { barcode: normalized })
          }
        />
        <View className="mt-3">
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
    <View className="flex-1 bg-white px-6 py-6 dark:bg-slate-900">
      <Text className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
        {normalized}
      </Text>
      <Text className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
        {product.name}
      </Text>
      {product.brand !== null ? (
        <Text className="mt-1 text-base text-slate-600 dark:text-slate-300">
          {product.brand}
        </Text>
      ) : null}
      {product.packageSize !== null ? (
        <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {product.packageQuantity !== null ? `${product.packageQuantity} × ` : ""}
          {product.packageSize} {product.unit ?? ""}
        </Text>
      ) : null}

      <View className="mt-6 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
        <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Last recorded price
        </Text>
        {lastPrice === null ? (
          <Text className="mt-1 text-slate-600 dark:text-slate-300">
            No price captured yet
          </Text>
        ) : (
          <View className="mt-1 flex-row items-baseline gap-2">
            <Text className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              {formatMoney({ amountMinor: lastPrice.regularPriceMinor, currency: lastPrice.currency })}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400">
              {lastPrice.capturedAt.toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {addedInfo !== null ? (
        <Text className="mt-4 text-sm font-medium text-teal-700 dark:text-teal-300">
          {addedInfo}
        </Text>
      ) : null}

      <View className="mt-auto gap-3">
        <PrimaryButton
          label="Capture price"
          onPress={() =>
            navigation.navigate("PriceCapture", {
              productId: product.id,
              barcode: normalized,
            })
          }
        />
        {activeTrip !== null && lastPrice !== null ? (
          <PrimaryButton
            label="Add to trip at last price"
            variant="secondary"
            onPress={quickAddToTrip}
          />
        ) : null}
        <PrimaryButton
          label="This is a different product"
          variant="secondary"
          onPress={() =>
            navigation.replace("ManualProduct", { barcode: normalized })
          }
        />
        <Text className="text-center text-xs text-slate-400">
          Currency: {currency}
        </Text>
      </View>
    </View>
  );
}
