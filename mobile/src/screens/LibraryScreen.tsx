import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { AppTextInput, EmptyState, PrimaryButton } from "../components/ui";
import { getDatabase } from "../db/database";
import {
  archiveProduct,
  getProductDetail,
  searchProducts,
  updateProduct,
  type ProductDetail,
  type ProductListItem,
} from "../db/repositories/products";
import { priceHistoryForProduct } from "../db/repositories/prices";
import type { RootStackParamList } from "../navigation/types";
import { formatMoney } from "../utils/money";
import { unitPriceBaseLabel, unitPriceMinor } from "../utils/units";

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen({ navigation }: { navigation: LibraryNavigation }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductListItem[]>(() =>
    searchProducts(getDatabase(), ""),
  );
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  const refresh = () => setProducts(searchProducts(getDatabase(), query));
  useFocusEffect(refresh);

  const runSearch = (value: string) => {
    setQuery(value);
    setProducts(searchProducts(getDatabase(), value));
  };

  return (
    <ScreenContainer>
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">Library</Text>

        <AppTextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Search products and brands"
        />

        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          className="mt-4 flex-1"
          contentContainerClassName="pb-4"
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              message="Products appear as you scan and capture prices."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setDetail(getProductDetail(getDatabase(), item.id))}
              className="mb-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {[item.brand, item.categoryName].filter(Boolean).join(" · ") || "No details"}
                  </Text>
                </View>
                {item.lastPriceMinor !== null ? (
                  <Text className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatMoney({
                      amountMinor: item.lastPriceMinor,
                      currency: item.lastCurrency ?? "PHP",
                    })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />

        <PrimaryButton
          label="Add product"
          variant="secondary"
          onPress={() => navigation.navigate("ManualProduct", {})}
        />
      </View>

      {detail !== null ? (
        <ProductDetailModal
          detail={detail}
          onClose={() => {
            setDetail(null);
            refresh();
          }}
          onCapturePrice={(productId) => {
            setDetail(null);
            navigation.navigate("PriceCapture", { productId });
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function ProductDetailModal({
  detail,
  onClose,
  onCapturePrice,
}: {
  detail: ProductDetail;
  onClose: () => void;
  onCapturePrice: (productId: string) => void;
}) {
  const prices = priceHistoryForProduct(getDatabase(), detail.product.id, 10);
  const product = detail.product;

  const unitPrice =
    product.packageSize !== null
      ? unitPriceMinor(
          detail.lastPrice?.regularPriceMinor ?? 0,
          product.packageQuantity,
          product.packageSize,
          product.unit,
        )
      : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white px-6 py-8 dark:bg-slate-900">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {product.name}
        </Text>
        <Text className="mt-1 text-slate-600 dark:text-slate-300">
          {[product.brand, detail.category?.name]
            .filter((part): part is string => part !== null && part !== undefined)
            .join(" · ") || "No details yet"}
        </Text>
        {product.packageSize !== null ? (
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {product.packageQuantity !== null ? `${product.packageQuantity} × ` : ""}
            {product.packageSize} {product.unit ?? ""}
            {unitPrice !== null
              ? ` · ${formatMoney({ amountMinor: unitPrice.minorPerDisplayUnit, currency: detail.lastPrice?.currency ?? "PHP" })} / ${unitPriceBaseLabel(unitPrice.baseUnit)}`
              : ""}
          </Text>
        ) : null}
        {detail.barcodes.length > 0 ? (
          <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {detail.barcodes.join(" · ")}
          </Text>
        ) : null}
        {product.notes !== null ? (
          <Text className="mt-3 text-sm italic text-slate-500 dark:text-slate-400">
            {product.notes}
          </Text>
        ) : null}

        <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Price history
        </Text>
        <FlatList
          data={prices}
          keyExtractor={(price) => price.id}
          className="mt-2 flex-1"
          ListEmptyComponent={
            <Text className="text-slate-500 dark:text-slate-400">No prices captured yet.</Text>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between border-b border-slate-100 py-3 dark:border-slate-800">
              <Text className="text-sm text-slate-600 dark:text-slate-300">
                {item.capturedAt.toLocaleDateString()}
                {item.promotionalPriceMinor !== null ? " · promo" : ""}
                {item.loyaltyPriceMinor !== null ? " · loyalty" : ""}
              </Text>
              <Text className="font-semibold text-slate-800 dark:text-slate-100">
                {formatMoney({ amountMinor: item.regularPriceMinor, currency: item.currency })}
              </Text>
            </View>
          )}
        />

        <View className="gap-3">
          <PrimaryButton
            label="Capture price"
            onPress={() => onCapturePrice(product.id)}
          />
          <PrimaryButton
            label={product.isFavorite === 1 ? "Remove favorite" : "Mark favorite"}
            variant="secondary"
            onPress={() => {
              updateProduct(getDatabase(), product.id, {
                isFavorite: product.isFavorite === 1 ? 0 : 1,
              });
              onClose();
            }}
          />
          <PrimaryButton
            label="Archive product"
            variant="danger"
            onPress={() => {
              archiveProduct(getDatabase(), product.id);
              onClose();
            }}
          />
          <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
