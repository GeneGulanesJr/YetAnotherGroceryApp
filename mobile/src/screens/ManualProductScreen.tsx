import { useState } from "react";
import { FlatList, Image, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  AppTextInput,
  Card,
  Chip,
  Field,
  FullScreenModal,
  Notice,
  PrimaryButton,
  Text,
} from "../components/ui";
import { ingestImage, pickProductPhoto } from "../capture/images";
import { getDatabase } from "../db/database";
import { listCategories } from "../db/repositories/categories";
import { createProduct, getRecentBrands } from "../db/repositories/products";
import type { RootStackParamList } from "../navigation/types";
import { useTokens } from "../theme/tokens";

type ManualProductProps = NativeStackScreenProps<RootStackParamList, "ManualProduct">;

const UNITS = ["g", "kg", "mL", "L", "pcs", "pack", "oz", "lb"] as const;

/**
 * Manual product capture (spec: only the name is required; everything else
 * can be edited later). Friction reducers: recent brands, searchable
 * categories, suggested units.
 */
export function ManualProductScreen({ navigation, route }: ManualProductProps) {
  const barcode = route.params?.barcode ?? null;
  const confirmedPrice = route.params?.price;
  const nameSuggestions = route.params?.nameSuggestions ?? [];
  const [name, setName] = useState(nameSuggestions[0] ?? "");
  const [brand, setBrand] = useState("");
  const categories = listCategories(getDatabase());
  const recentBrands = getRecentBrands(getDatabase(), 8);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [packageQuantity, setPackageQuantity] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [unit, setUnit] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTokens();

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
  );

  const save = async () => {
    if (name.trim() === "") {
      setError("Product name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const db = getDatabase();
      let photoImageId: string | null = null;
      if (photoUri !== null) {
        const { record } = await ingestImage(db, photoUri);
        photoImageId = record.id;
      }
      const product = createProduct(db, {
        name,
        brand: brand || null,
        categoryId,
        packageQuantity: packageQuantity.trim() === "" ? null : Number(packageQuantity),
        packageSize: packageSize || null,
        unit,
        notes: notes || null,
        barcode,
        photoImageId,
      });
      navigation.replace("PriceCapture", {
        productId: product.id,
        barcode: barcode ?? undefined,
        ...confirmedPrice,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the product");
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="px-5 py-6"
      keyboardShouldPersistTaps="handled"
    >
      {barcode !== null || confirmedPrice?.prefillAmount !== undefined ? (
        <Card className="mb-5">
          {barcode !== null ? (
            <Text variant="meta" tone="meta">
              Barcode {barcode}
            </Text>
          ) : null}
          {confirmedPrice?.prefillAmount !== undefined ? (
            <Text className="mt-0.5">
              Price {confirmedPrice.prefillAmount} carries over to the next step.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Field
        label="Product name (required)"
        hint={nameSuggestions.length > 0 ? "Read from the tag photo. Check it before saving." : undefined}
      >
        <AppTextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Nestlé Fresh Milk"
          autoFocus={nameSuggestions.length === 0}
          returnKeyType="next"
        />
        {nameSuggestions.length > 1 ? (
          <View className="mt-3 flex-row flex-wrap gap-y-3">
            {nameSuggestions.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                selected={name === suggestion}
                onPress={() => setName(suggestion)}
              />
            ))}
          </View>
        ) : null}
      </Field>

      <Field label="Brand">
        <AppTextInput value={brand} onChangeText={setBrand} placeholder="e.g. Nestlé" />
        {recentBrands.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-y-3">
            {recentBrands.slice(0, 5).map((b) => (
              <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(b)} />
            ))}
          </View>
        ) : null}
      </Field>

      <Field label="Category">
        <Pressable
          onPress={() => setCategoryPickerOpen(true)}
          accessibilityRole="button"
          android_ripple={{ color: t.line }}
          className="min-h-12 flex-row items-center justify-between overflow-hidden rounded-xl border-2 border-outline bg-card px-3"
        >
          <Text tone={selectedCategory === null ? "meta" : "primary"}>
            {selectedCategory?.name ?? "Pick a category"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={t.ink3} />
        </Pressable>
      </Field>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Pack quantity">
            <AppTextInput
              value={packageQuantity}
              onChangeText={setPackageQuantity}
              keyboardType="number-pad"
              placeholder="e.g. 6"
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Package size">
            <AppTextInput value={packageSize} onChangeText={setPackageSize} placeholder="e.g. 500" />
          </Field>
        </View>
      </View>

      <Field label="Unit">
        <View className="flex-row flex-wrap gap-y-3">
          {UNITS.map((u) => (
            <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(unit === u ? null : u)} />
          ))}
        </View>
      </Field>

      <Field label="Personal notes">
        <AppTextInput value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      </Field>

      <Field label="Product photo" hint="Optional. Compressed and stored on this phone.">
        <View className="flex-row items-center gap-3">
          {photoUri !== null ? <Image source={{ uri: photoUri }} className="h-20 w-20 rounded-2xl border-2 border-outline" /> : null}
          <PrimaryButton
            label={photoUri === null ? "Choose photo" : "Replace photo"}
            icon="image-outline"
            variant="secondary"
            onPress={async () => {
              const uri = await pickProductPhoto();
              if (uri !== null) {
                setPhotoUri(uri);
              }
            }}
          />
        </View>
      </Field>

      {error !== null ? (
        <View className="mb-4">
          <Notice>{error}</Notice>
        </View>
      ) : null}

      <PrimaryButton label="Save product" onPress={() => void save()} loading={saving} />

      <FullScreenModal visible={categoryPickerOpen} onClose={() => setCategoryPickerOpen(false)}>
        <View className="flex-1 px-5 pt-6">
          <Text variant="display" className="mb-4">
            Pick a category
          </Text>
          <AppTextInput
            value={categoryQuery}
            onChangeText={setCategoryQuery}
            placeholder="Search categories"
            autoFocus
          />
          <FlatList
            data={filteredCategories}
            keyExtractor={(c) => c.id}
            className="mt-2"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setCategoryId(item.id);
                  setCategoryPickerOpen(false);
                  setCategoryQuery("");
                }}
                accessibilityRole="button"
                android_ripple={{ color: t.line }}
                className="min-h-12 flex-row items-center justify-between border-b border-line py-3"
              >
                <Text>{item.name}</Text>
                {item.id === categoryId ? <Ionicons name="checkmark" size={20} color={t.brandText} /> : null}
              </Pressable>
            )}
          />
          <View className="pb-4 pt-2">
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => setCategoryPickerOpen(false)} />
          </View>
        </View>
      </FullScreenModal>
    </ScrollView>
  );
}
