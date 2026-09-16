import { useCallback, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { AppTextInput, EmptyState, Field, PrimaryButton } from "../components/ui";
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
import { formatMoney } from "../utils/money";

type ListsNavigation = NativeStackNavigationProp<RootStackParamList>;

export function ListsScreen({ navigation }: { navigation: ListsNavigation }) {
  const [lists, setLists] = useState<ListSummaryLine[]>(() => listLists(getDatabase()));
  const [createOpen, setCreateOpen] = useState(false);
  const [openListId, setOpenListId] = useState<string | null>(null);

  const refresh = useCallback(() => setLists(listLists(getDatabase())), []);
  useFocusEffect(refresh);

  const openList = lists.find((l) => l.id === openListId) ?? null;

  return (
    <ScreenContainer>
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">Lists</Text>

        <FlatList
          data={lists}
          keyExtractor={(list) => list.id}
          className="mt-4 flex-1"
          contentContainerClassName="pb-4"
          ListEmptyComponent={
            <EmptyState
              title="No lists yet"
              message="Build a shopping list ahead of time, then convert it into a trip in the store."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setOpenListId(item.id)}
              className="mb-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.openCount} open · {item.itemCount} total
                    {item.estimatedTotalMinor > 0
                      ? ` · est. ${formatMoney({ amountMinor: item.estimatedTotalMinor, currency: item.currency ?? getDefaultCurrency(getDatabase()) })}`
                      : ""}
                  </Text>
                </View>
                <Text className="text-slate-400">›</Text>
              </View>
            </Pressable>
          )}
        />

        <PrimaryButton label="New list" onPress={() => setCreateOpen(true)} />
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-white px-6 dark:bg-slate-900">
        <Text className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-50">
          New list
        </Text>
        <Field label="Name">
          <AppTextInput value={name} onChangeText={setName} placeholder="e.g. Weekly groceries" autoFocus />
        </Field>
        <PrimaryButton label="Create" onPress={create} />
        <View className="mt-3" />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
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
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white px-6 py-8 dark:bg-slate-900">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">{list.name}</Text>

        <FlatList
          data={itemList}
          keyExtractor={(item) => item.id}
          className="mt-4 flex-1"
          contentContainerClassName="pb-4"
          ListEmptyComponent={
            <EmptyState title="Empty list" message="Add items below as you plan the week." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setListItemPurchased(getDatabase(), item.id, item.purchased !== 1);
                refreshItems();
              }}
              className="mb-2 flex-row items-center rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800"
            >
              <Text className="mr-3 text-lg">{item.purchased === 1 ? "☑" : "☐"}</Text>
              <View className="flex-1">
                <Text
                  className={`text-base ${item.purchased === 1 ? "text-slate-400 line-through" : "text-slate-900 dark:text-slate-50"}`}
                >
                  {item.productName ?? item.name}
                </Text>
                {item.estimatedPriceMinor !== null ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    est.{" "}
                    {formatMoney({
                      amountMinor: item.estimatedPriceMinor,
                      currency: item.currency ?? "PHP",
                    })}{" "}
                    × {item.quantity}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => {
                  removeListItem(getDatabase(), item.id);
                  refreshItems();
                }}
                className="px-2 py-1"
              >
                <Text className="text-slate-400">✕</Text>
              </Pressable>
            </Pressable>
          )}
        />

        <AppTextInput
          value={newItemName}
          onChangeText={setNewItemName}
          placeholder="Add item…"
          onSubmitEditing={addItem}
        />

        <View className="mt-4 gap-3">
          <PrimaryButton label="Start trip from this list" onPress={startTrip} />
          <PrimaryButton
            label="Delete list"
            variant="danger"
            onPress={() => {
              deleteList(getDatabase(), list.id);
              onClose();
            }}
          />
          <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
