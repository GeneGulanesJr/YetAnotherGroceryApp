import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useFocusEffect, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import {
  AppTextInput,
  BottomSheet,
  EmptyState,
  Field,
  FullScreenModal,
  ListRow,
  PrimaryButton,
  Text,
} from "../components/ui";
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
import { useTokens } from "../theme/tokens";
import { formatMoney } from "../utils/money";
import { isProbablyBarcode } from "../utils/barcode";
import { unitPriceBaseLabel, unitPriceMinor } from "../utils/units";

type LibraryNavigation = NativeStackNavigationProp<RootStackParamList>;

export function LibraryScreen({
  navigation,
  route,
}: {
  navigation: LibraryNavigation;
  route: RouteProp<RootStackParamList, "Library">;
}) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductListItem[]>(() =>
    searchProducts(getDatabase(), ""),
  );
  // Home opens a specific product straight away.
  const [detail, setDetail] = useState<ProductDetail | null>(() =>
    route.params?.productId === undefined ? null : getProductDetail(getDatabase(), route.params.productId),
  );
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(
    () => setProducts(searchProducts(getDatabase(), query)),
    [query],
  );
  useFocusEffect(refresh);

  const runSearch = (value: string) => {
    setQuery(value);
    setProducts(searchProducts(getDatabase(), value));
  };

  const t = useTokens();

  return (
    <ScreenContainer>
      <View className="flex-1 px-5 pt-4">
        <AppTextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Search products and brands"
          accessibilityLabel="Search products and brands"
        />

        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          className="mt-2 flex-1"
          contentContainerClassName="pb-4 flex-grow"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="library-outline"
              title={query.trim() === "" ? "Nothing here yet" : "No matches"}
              message={
                query.trim() === ""
                  ? "Products appear as you snap items and capture prices."
                  : "Try a shorter name or the brand."
              }
            />
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setDetail(getProductDetail(getDatabase(), item.id))}
              accessibilityRole="button"
              android_ripple={{ color: t.line }}
              className={`min-h-16 flex-row items-center gap-3 py-3 ${index === products.length - 1 ? "" : "border-b border-line"}`}
            >
              <View className="flex-1">
                <Text>{item.name}</Text>
                <Text variant="meta" tone="meta">
                  {[item.brand, item.categoryName].filter(Boolean).join(" · ") || "No details"}
                </Text>
              </View>
              {item.lastPriceMinor !== null ? (
                <Text className="font-semibold">
                  {formatMoney({ amountMinor: item.lastPriceMinor, currency: item.lastCurrency ?? "PHP" })}
                </Text>
              ) : null}
            </Pressable>
          )}
        />

        <View className="pb-4 pt-2">
          <PrimaryButton
            label="Add product"
            icon="add"
            variant="secondary"
            onPress={() => setAddOpen(true)}
          />
        </View>
      </View>

      {addOpen ? (
        <AddProductSheet
          onClose={() => setAddOpen(false)}
          onGo={(go) => {
            setAddOpen(false);
            go(navigation);
          }}
        />
      ) : null}

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
    <FullScreenModal onClose={onClose}>
      <View className="flex-1 px-5 pt-6">
        <Text variant="display">{product.name}</Text>
        <Text tone="secondary" className="mt-1">
          {[product.brand, detail.category?.name]
            .filter((part): part is string => part !== null && part !== undefined)
            .join(" · ") || "No details yet"}
        </Text>
        {product.packageSize !== null ? (
          <Text tone="meta" className="mt-1">
            {product.packageQuantity !== null ? `${product.packageQuantity} × ` : ""}
            {product.packageSize} {product.unit ?? ""}
            {unitPrice !== null
              ? `, ${formatMoney({ amountMinor: unitPrice.minorPerDisplayUnit, currency: detail.lastPrice?.currency ?? "PHP" })} per ${unitPriceBaseLabel(unitPrice.baseUnit)}`
              : ""}
          </Text>
        ) : null}
        {detail.barcodes.length > 0 ? (
          <Text variant="meta" tone="meta" className="mt-2">
            {detail.barcodes.join(" · ")}
          </Text>
        ) : null}
        {product.notes !== null ? (
          <Text tone="secondary" className="mt-3">
            {product.notes}
          </Text>
        ) : null}

        <Text variant="label" tone="secondary" className="mt-6">
          Price history
        </Text>
        <FlatList
          data={prices}
          keyExtractor={(price) => price.id}
          className="mt-1 flex-1"
          ListEmptyComponent={
            <Text tone="meta" className="mt-2">
              No prices captured yet.
            </Text>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between gap-3 border-b border-line py-3">
              <Text tone="secondary">
                {item.capturedAt.toLocaleDateString()}
                {item.promotionalPriceMinor !== null ? ", promo" : ""}
                {item.loyaltyPriceMinor !== null ? ", loyalty" : ""}
              </Text>
              <Text className="font-semibold">
                {formatMoney({ amountMinor: item.regularPriceMinor, currency: item.currency })}
              </Text>
            </View>
          )}
        />

        <View className="gap-3 pb-4 pt-3">
          <PrimaryButton label="Capture price" icon="pricetag-outline" onPress={() => onCapturePrice(product.id)} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <PrimaryButton
                label={product.isFavorite === 1 ? "Unfavorite" : "Favorite"}
                icon={product.isFavorite === 1 ? "star" : "star-outline"}
                variant="secondary"
                onPress={() => {
                  updateProduct(getDatabase(), product.id, {
                    isFavorite: product.isFavorite === 1 ? 0 : 1,
                  });
                  onClose();
                }}
              />
            </View>
            <View className="flex-1">
              <PrimaryButton
                label="Archive"
                icon="archive-outline"
                variant="danger"
                onPress={() => {
                  archiveProduct(getDatabase(), product.id);
                  onClose();
                }}
              />
            </View>
          </View>
          <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </FullScreenModal>
  );
}

/**
 * The ways to add a product without snapping it (snapping is the center tab):
 * scan a barcode live, type one, or add a product that has none.
 */
function AddProductSheet({
  onClose,
  onGo,
}: {
  onClose: () => void;
  onGo: (go: (navigation: LibraryNavigation) => void) => void;
}) {
  const [barcode, setBarcode] = useState("");
  const typed = barcode.trim();
  const valid = isProbablyBarcode(typed);
  const lookUp = () => {
    if (valid) {
      onGo((navigation) => navigation.navigate("ProductResolve", { barcode: typed }));
    }
  };
  return (
    <BottomSheet onClose={onClose}>
      <Text variant="title">Add product</Text>
      <ListRow
        icon="scan-outline"
        title="Scan barcode live"
        detail="Then photograph or type the price"
        onPress={() => onGo((navigation) => navigation.navigate("Scanner"))}
      />
      <ListRow
        icon="create-outline"
        title="Add product without barcode"
        onPress={() => onGo((navigation) => navigation.navigate("ManualProduct", {}))}
        last
      />
      <View className="mt-4">
        <Field label="Type a barcode" hint={typed !== "" && !valid ? "Enter a valid barcode (6–14 digits)" : undefined}>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <AppTextInput
                value={barcode}
                onChangeText={setBarcode}
                keyboardType="number-pad"
                placeholder="e.g. 4800017234567"
                onSubmitEditing={lookUp}
              />
            </View>
            <PrimaryButton label="Look up" variant="secondary" disabled={!valid} onPress={lookUp} />
          </View>
        </Field>
      </View>
    </BottomSheet>
  );
}
