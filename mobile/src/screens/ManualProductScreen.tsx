import { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppTextInput, Chip, Field, PrimaryButton } from "../components/ui";
import { ingestImage, pickProductPhoto } from "../capture/images";
import { getDatabase } from "../db/database";
import { listCategories } from "../db/repositories/categories";
import { createProduct, getRecentBrands } from "../db/repositories/products";
import type { RootStackParamList } from "../navigation/types";

type ManualProductProps = NativeStackScreenProps<RootStackParamList, "ManualProduct">;

const UNITS = ["g", "kg", "mL", "L", "pcs", "pack", "oz", "lb"] as const;

/**
 * Manual product capture (spec: only the name is required; everything else
 * can be edited later). Friction reducers: recent brands, searchable
 * categories, suggested units.
 */
export function ManualProductScreen({ navigation, route }: ManualProductProps) {
  const barcode = route.params?.barcode ?? null;
  const [name, setName] = useState("");
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
      navigation.replace("PriceCapture", { productId: product.id, barcode: barcode ?? undefined });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the product");
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-slate-900"
      contentContainerClassName="px-6 py-6"
      keyboardShouldPersistTaps="handled"
    >
      {barcode !== null ? (
        <Field label="Barcode">
          <Text className="text-base font-medium text-slate-900 dark:text-slate-50">
            {barcode}
          </Text>
        </Field>
      ) : null}

      <Field label="Product name *">
        <AppTextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Nestlé Fresh Milk"
          autoFocus={barcode === null}
          returnKeyType="next"
        />
      </Field>

      <Field label="Brand" hint={recentBrands.length > 0 ? "Recent: " + recentBrands.join(", ") : undefined}>
        <AppTextInput value={brand} onChangeText={setBrand} placeholder="e.g. Nestlé" />
        {recentBrands.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap">
            {recentBrands.slice(0, 5).map((b) => (
              <View key={b} className="mb-2">
                <Chip label={b} selected={brand === b} onPress={() => setBrand(b)} />
              </View>
            ))}
          </View>
        ) : null}
      </Field>

      <Field label="Category">
        <Pressable
          onPress={() => setCategoryPickerOpen(true)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
        >
          <Text className="text-base text-slate-900 dark:text-slate-50">
            {selectedCategory?.name ?? "Pick a category"}
          </Text>
        </Pressable>
      </Field>

      <View className="mb-4 flex-row gap-3">
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
            <AppTextInput
              value={packageSize}
              onChangeText={setPackageSize}
              placeholder="e.g. 500"
            />
          </Field>
        </View>
      </View>

      <Field label="Unit">
        <View className="flex-row flex-wrap">
          {UNITS.map((u) => (
            <View key={u} className="mb-2">
              <Chip label={u} selected={unit === u} onPress={() => setUnit(unit === u ? null : u)} />
            </View>
          ))}
        </View>
      </Field>

      <Field label="Personal notes">
        <AppTextInput value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      </Field>

      <Field label="Product photo" hint="Optional. Compressed and stored offline.">
        <View className="flex-row items-center gap-3">
          {photoUri !== null ? (
            <Image source={{ uri: photoUri }} className="h-20 w-20 rounded-xl" />
          ) : null}
          <Pressable
            onPress={async () => {
              const uri = await pickProductPhoto();
              if (uri !== null) {
                setPhotoUri(uri);
              }
            }}
            className="rounded-xl bg-slate-200 px-4 py-2.5 dark:bg-slate-700"
          >
            <Text className="font-medium text-slate-800 dark:text-slate-200">
              {photoUri === null ? "Choose photo" : "Replace photo"}
            </Text>
          </Pressable>
        </View>
      </Field>

      {error !== null ? (
        <Text className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</Text>
      ) : null}

      <PrimaryButton label="Save product" onPress={() => void save()} loading={saving} />

      <Modal visible={categoryPickerOpen} animationType="slide" onRequestClose={() => setCategoryPickerOpen(false)}>
        <View className="flex-1 bg-white px-4 py-6 dark:bg-slate-900">
          <Text className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">
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
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setCategoryId(item.id);
                  setCategoryPickerOpen(false);
                  setCategoryQuery("");
                }}
                className="border-b border-slate-100 py-3 dark:border-slate-800"
              >
                <Text className="text-base text-slate-900 dark:text-slate-50">{item.name}</Text>
              </Pressable>
            )}
          />
          <PrimaryButton
            label="Cancel"
            variant="secondary"
            onPress={() => setCategoryPickerOpen(false)}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}
