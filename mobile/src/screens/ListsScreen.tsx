import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import {
  AppTextInput,
  EmptyState,
  Field,
  FullScreenModal,
  PrimaryButton,
  Text,
} from "../components/ui";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import {
  addListItem,
  convertListToTrip,
  createList,
  deleteList,
  listItems,
  listLists,
  removeListItem,
  setListItemPurchased,
  type ListSummaryLine,
} from "../db/repositories/lists";
import type { RootStackParamList } from "../navigation/types";
import { useTokens } from "../theme/tokens";
import { formatMoney } from "../utils/money";

type ListsNavigation = NativeStackNavigationProp<RootStackParamList>;

export function ListsScreen({ navigation }: { navigation: ListsNavigation }) {
  const [lists, setLists] = useState<ListSummaryLine[]>(() => listLists(getDatabase()));
  const [createOpen, setCreateOpen] = useState(false);
  const [openListId, setOpenListId] = useState<string | null>(null);

  const refresh = useCallback(() => setLists(listLists(getDatabase())), []);
  useFocusEffect(refresh);

  const openList = lists.find((l) => l.id === openListId) ?? null;

  const t = useTokens();

  return (
    <ScreenContainer>
      <View className="flex-1 px-5 pt-2">
        <FlatList
          data={lists}
          keyExtractor={(list) => list.id}
          className="flex-1"
          contentContainerClassName="pb-4 flex-grow"
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title="No lists yet"
              message="Build a shopping list ahead of time, then turn it into a trip in the store."
            />
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setOpenListId(item.id)}
              accessibilityRole="button"
              android_ripple={{ color: t.line }}
              className={`min-h-16 flex-row items-center gap-3 py-3 ${index === lists.length - 1 ? "" : "border-b border-line dark:border-line-dark"}`}
            >
              <View className="flex-1">
                <Text>{item.name}</Text>
                <Text variant="meta" tone="meta">
                  {item.openCount} open of {item.itemCount}
                  {item.estimatedTotalMinor > 0
                    ? `, about ${formatMoney({ amountMinor: item.estimatedTotalMinor, currency: item.currency ?? getDefaultCurrency(getDatabase()) })}`
                    : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.ink3} />
            </Pressable>
          )}
        />

        <View className="pb-4 pt-2">
          <PrimaryButton label="New list" icon="add" onPress={() => setCreateOpen(true)} />
        </View>
      </View>

      <CreateListModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          refresh();
        }}
      />

      {openList !== null ? (
        <ListDetailModal
          list={openList}
          onClose={() => {
            setOpenListId(null);
            refresh();
          }}
          onTripStarted={() => {
            setOpenListId(null);
            refresh();
            navigation.navigate("Shopping" as never);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function CreateListModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const currency = getDefaultCurrency(getDatabase());

  const create = () => {
    if (name.trim() === "") {
      return;
    }
    createList(getDatabase(), { name: name.trim(), currency });
    setName("");
    onCreated();
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose}>
      <View className="flex-1 justify-center px-5">
        <Text variant="display" className="mb-6">
          New list
        </Text>
        <Field label="Name">
          <AppTextInput value={name} onChangeText={setName} placeholder="e.g. Weekly groceries" autoFocus />
        </Field>
        <View className="gap-3">
          <PrimaryButton label="Create" onPress={create} disabled={name.trim() === ""} />
          <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </FullScreenModal>
  );
}

function ListDetailModal({
  list,
  onClose,
  onTripStarted,
}: {
  list: ListSummaryLine;
  onClose: () => void;
  onTripStarted: () => void;
}) {
  const [newItemName, setNewItemName] = useState("");
  const [itemList, setItemList] = useState(() => listItems(getDatabase(), list.id));
  const t = useTokens();

  const refreshItems = () => setItemList(listItems(getDatabase(), list.id));

  const addItem = () => {
    if (newItemName.trim() === "") {
      return;
    }
    addListItem(getDatabase(), { listId: list.id, name: newItemName.trim() });
    setNewItemName("");
    refreshItems();
  };

  const startTrip = () => {
    try {
      convertListToTrip(getDatabase(), list.id);
      onTripStarted();
    } catch (error) {
      Alert.alert(
        "Trip already active",
        error instanceof Error
          ? error.message
          : "Complete or cancel the active trip first.",
      );
    }
  };

  return (
    <FullScreenModal onClose={onClose}>
      <View className="flex-1 px-5 pt-6">
        <Text variant="display">{list.name}</Text>

        <FlatList
          data={itemList}
          keyExtractor={(item) => item.id}
          className="mt-4 flex-1"
          contentContainerClassName="pb-4 flex-grow"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState icon="create-outline" title="Empty list" message="Add items below as you plan the week." />
          }
          renderItem={({ item }) => {
            const done = item.purchased === 1;
            return (
              <View className="min-h-14 flex-row items-center border-b border-line dark:border-line-dark">
                <Pressable
                  onPress={() => {
                    setListItemPurchased(getDatabase(), item.id, !done);
                    refreshItems();
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  android_ripple={{ color: t.line }}
                  className="flex-1 flex-row items-center gap-3 py-3"
                >
                  <Ionicons
                    name={done ? "checkbox" : "square-outline"}
                    size={22}
                    color={done ? t.brandText : t.ink3}
                  />
                  <View className="flex-1">
                    <Text tone={done ? "meta" : "primary"} className={done ? "line-through" : ""}>
                      {item.productName ?? item.name}
                    </Text>
                    {item.estimatedPriceMinor !== null ? (
                      <Text variant="meta" tone="meta">
                        about{" "}
                        {formatMoney({ amountMinor: item.estimatedPriceMinor, currency: item.currency ?? "PHP" })}{" "}
                        × {item.quantity}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    removeListItem(getDatabase(), item.id);
                    refreshItems();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.productName ?? item.name}`}
                  android_ripple={{ color: t.line, borderless: true }}
                  className="h-12 w-12 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color={t.ink3} />
                </Pressable>
              </View>
            );
          }}
        />

        <AppTextInput
          value={newItemName}
          onChangeText={setNewItemName}
          placeholder="Add item…"
          returnKeyType="done"
          onSubmitEditing={addItem}
        />

        <View className="gap-3 pb-4 pt-4">
          <PrimaryButton label="Start trip from this list" icon="cart-outline" onPress={startTrip} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
            </View>
            <View className="flex-1">
              <PrimaryButton
                label="Delete list"
                variant="danger"
                onPress={() => {
                  deleteList(getDatabase(), list.id);
                  onClose();
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
