import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useHardwareBack } from "../components/camera";
import { ScreenContainer } from "../components/ScreenContainer";
import {
  AppTextInput,
  Card,
  Chip,
  EmptyState,
  Field,
  FullScreenModal,
  PrimaryButton,
  Text,
  type IconName,
} from "../components/ui";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import { ensureStore, listStores } from "../db/repositories/stores";
import {
  cancelTrip,
  completeTrip,
  getActiveTrip,
  getTripPurchases,
  getTripStore,
  listTrips,
  removePurchase,
  setPurchaseQuantity,
  setTripBudget,
  startTrip,
  tripTotalMinor,
  type TripPurchaseLine,
  type TripSummaryLine,
} from "../db/repositories/trips";
import type { Store, Trip } from "../db/schema";
import type { RootStackParamList } from "../navigation/types";
import { useTokens } from "../theme/tokens";
import { budgetStatus, formatMoney, parseMoney } from "../utils/money";
import { TripDetailModal } from "./HistoryScreen";

type ShoppingNavigation = NativeStackNavigationProp<RootStackParamList>;

interface TripView {
  trip: Trip | null;
  store: Store | null;
  lines: TripPurchaseLine[];
  totalMinor: number;
  /** Finished runs, newest first (cancelled ones are left out). */
  runs: TripSummaryLine[];
}

function loadView(): TripView {
  const db = getDatabase();
  const runs = listTrips(db, { status: "completed" });
  const trip = getActiveTrip(db) ?? null;
  if (trip === null) {
    return { trip: null, store: null, lines: [], totalMinor: 0, runs };
  }
  const lines = getTripPurchases(db, trip.id);
  return {
    trip,
    store: getTripStore(db, trip) ?? null,
    lines,
    totalMinor: tripTotalMinor(lines),
    runs,
  };
}

function storeLabel(name: string | null | undefined, branch: string | null | undefined): string {
  return `${name ?? "Grocery run"}${branch !== null && branch !== undefined ? ` ${branch}` : ""}`;
}

/**
 * Shopping tab: "+ Grocery run" on top, the runs below. A run can carry a
 * budget; every scanned item is deducted from it as it is added. The active
 * run lives in SQLite and reloads on every focus, so killing the app mid-run
 * loses nothing (spec requirement).
 */
export function ShoppingScreen({ navigation }: { navigation: ShoppingNavigation }) {
  const [view, setView] = useState<TripView>(() => loadView());
  const [showActive, setShowActive] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [openRun, setOpenRun] = useState<TripSummaryLine | null>(null);
  const [summary, setSummary] = useState<{
    items: number;
    totalMinor: number;
    budgetMinor: number | null;
    currency: string;
  } | null>(null);

  // Stable identity or useFocusEffect re-runs every render (update loop).
  const refresh = useCallback(() => setView(loadView()), []);
  useFocusEffect(refresh);

  const activeShown = showActive && view.trip !== null && summary === null;
  useHardwareBack(activeShown, () => setShowActive(false));

  const finishTrip = () => {
    if (view.trip === null) {
      return;
    }
    setSummary({
      items: view.lines.length,
      totalMinor: view.totalMinor,
      budgetMinor: view.trip.budgetMinor,
      currency: view.trip.currency ?? getDefaultCurrency(getDatabase()),
    });
    completeTrip(getDatabase(), view.trip.id);
    refresh();
  };

  const dropTrip = () => {
    if (view.trip === null) {
      return;
    }
    cancelTrip(getDatabase(), view.trip.id);
    setShowActive(false);
    refresh();
  };

  if (summary !== null) {
    const status = summary.budgetMinor === null ? null : budgetStatus(summary.budgetMinor, summary.totalMinor);
    const money = (amountMinor: number) => formatMoney({ amountMinor, currency: summary.currency });
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center px-5">
          <Text variant="display">Run complete</Text>
          <Text variant="title" tone="brand" className="mt-3">
            {money(summary.totalMinor)}
          </Text>
          <Text tone="secondary" className="mt-1">
            {summary.items} item{summary.items === 1 ? "" : "s"}, saved on this phone.
          </Text>
          {status !== null ? (
            <Text tone={status.over ? "caution" : "brand"} className="mt-3 font-medium">
              {status.over
                ? `${money(-status.remainingMinor)} over the ${money(summary.budgetMinor ?? 0)} budget`
                : `${money(status.remainingMinor)} under the ${money(summary.budgetMinor ?? 0)} budget`}
            </Text>
          ) : null}
          <View className="mt-8">
            <PrimaryButton
              label="Done"
              onPress={() => {
                setSummary(null);
                setShowActive(false);
              }}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (activeShown && view.trip !== null) {
    const trip = view.trip;
    const currency = trip.currency ?? getDefaultCurrency(getDatabase());
    return (
      <ScreenContainer>
        <View className="flex-1 px-5">
          <AllRunsButton onPress={() => setShowActive(false)} />
          <Text variant="meta" tone="meta">
            Started {trip.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Text variant="display">{storeLabel(view.store?.name, view.store?.branch)}</Text>

          <View className="mt-3">
            <BudgetMeter
              budgetMinor={trip.budgetMinor}
              spentMinor={view.totalMinor}
              currency={currency}
              onEdit={() => setBudgetOpen(true)}
            />
          </View>

          <FlatList
            data={view.lines}
            keyExtractor={(line) => line.id}
            className="mt-2 flex-1"
            contentContainerClassName="pb-4 flex-grow"
            ListEmptyComponent={
              <EmptyState
                icon="camera-outline"
                title="No items yet"
                message="Snap an item with its price tag. Its price comes off the budget right away."
              />
            }
            renderItem={({ item }) => (
              <View className="flex-row items-center gap-2 border-b border-line py-3 dark:border-line-dark">
                <View className="flex-1">
                  <Text>{item.productName}</Text>
                  {item.productBrand !== null ? (
                    <Text variant="meta" tone="meta">
                      {item.productBrand}
                      {item.packageSize !== null ? `, ${item.packageSize} ${item.unit ?? ""}` : ""}
                    </Text>
                  ) : null}
                  <Text variant="meta" tone="secondary" className="mt-0.5">
                    {formatMoney({ amountMinor: item.shelfPriceMinor, currency: item.currency })} ×{" "}
                    {item.quantity} ={" "}
                    {formatMoney({ amountMinor: item.shelfPriceMinor * item.quantity, currency: item.currency })}
                  </Text>
                </View>
                <QtyButton
                  icon="remove"
                  label={`One less ${item.productName}`}
                  onPress={() => {
                    setPurchaseQuantity(getDatabase(), item.id, item.quantity - 1);
                    refresh();
                  }}
                />
                <QtyButton
                  icon="add"
                  label={`One more ${item.productName}`}
                  onPress={() => {
                    setPurchaseQuantity(getDatabase(), item.id, item.quantity + 1);
                    refresh();
                  }}
                />
                <QtyButton
                  icon="trash-outline"
                  label={`Remove ${item.productName}`}
                  onPress={() => {
                    removePurchase(getDatabase(), item.id);
                    refresh();
                  }}
                />
              </View>
            )}
          />

          <View className="gap-3 pb-4 pt-3">
            <PrimaryButton
              label="Snap next item"
              icon="camera-outline"
              onPress={() => navigation.navigate("SnapItem")}
            />
            <PrimaryButton
              label="Attach receipt photo"
              icon="receipt-outline"
              variant="secondary"
              onPress={() => navigation.navigate("ReceiptCapture", { tripId: trip.id })}
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <PrimaryButton label="Finish run" variant="secondary" onPress={finishTrip} />
              </View>
              <View className="flex-1">
                <PrimaryButton label="Cancel run" variant="danger" onPress={dropTrip} />
              </View>
            </View>
          </View>
        </View>

        {budgetOpen ? (
          <BudgetModal
            initialMinor={trip.budgetMinor}
            currency={currency}
            onClose={() => setBudgetOpen(false)}
            onSave={(budgetMinor) => {
              setTripBudget(getDatabase(), trip.id, budgetMinor);
              setBudgetOpen(false);
              refresh();
            }}
          />
        ) : null}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={view.runs}
        keyExtractor={(run) => run.id}
        contentContainerClassName="px-5 pb-8 pt-4 flex-grow"
        ListHeaderComponent={
          <View className="mb-2">
            {view.trip !== null ? (
              <ActiveRunCard
                view={view}
                onPress={() => setShowActive(true)}
              />
            ) : (
              <PrimaryButton label="Grocery run" icon="add" onPress={() => setStartOpen(true)} />
            )}
            <Text variant="label" tone="secondary" className="mt-8">
              Grocery runs
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text tone="meta" className="mt-1">
            Finished runs show up here with what you spent against the budget.
          </Text>
        }
        renderItem={({ item, index }) => (
          <RunRow run={item} last={index === view.runs.length - 1} onPress={() => setOpenRun(item)} />
        )}
      />

      <StartTripModal
        visible={startOpen}
        onClose={() => setStartOpen(false)}
        onStarted={() => {
          setStartOpen(false);
          refresh();
          setShowActive(true);
        }}
      />

      {openRun !== null ? <TripDetailModal trip={openRun} onClose={() => setOpenRun(null)} /> : null}
    </ScreenContainer>
  );
}

function AllRunsButton({ onPress }: { onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: t.line }}
      className="-ml-1 min-h-12 flex-row items-center gap-1 self-start pr-3"
    >
      <Ionicons name="chevron-back" size={20} color={t.brandText} />
      <Text tone="brand">All runs</Text>
    </Pressable>
  );
}

/** Budget left after everything scanned so far, or the running total when there is no budget. */
function BudgetMeter({
  budgetMinor,
  spentMinor,
  currency,
  onEdit,
}: {
  budgetMinor: number | null;
  spentMinor: number;
  currency: string;
  onEdit: () => void;
}) {
  const t = useTokens();
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency });

  if (budgetMinor === null) {
    return (
      <Card className="flex-row items-center justify-between">
        <View>
          <Text variant="meta" tone="meta">
            Spent so far
          </Text>
          <Text variant="title" tone="brand">
            {money(spentMinor)}
          </Text>
        </View>
        <PrimaryButton label="Set budget" icon="wallet-outline" variant="secondary" onPress={onEdit} />
      </Card>
    );
  }

  const status = budgetStatus(budgetMinor, spentMinor);
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${status.over ? "Over budget by" : "Budget left"} ${money(Math.abs(status.remainingMinor))}. Edit budget`}
      android_ripple={{ color: t.line }}
      className="overflow-hidden rounded-lg bg-card p-4 dark:bg-card-dark"
    >
      <View className="flex-row items-baseline justify-between">
        <Text variant="meta" tone="meta">
          {status.over ? "Over budget" : "Left to spend"}
        </Text>
        <Ionicons name="create-outline" size={16} color={t.ink3} />
      </View>
      <Text variant="display" tone={status.over ? "caution" : "brand"}>
        {money(Math.abs(status.remainingMinor))}
      </Text>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-sand dark:bg-sand-dark">
        <View
          style={{ width: `${status.fraction * 100}%` }}
          className={`h-2 rounded-full ${status.over ? "bg-caution-fg dark:bg-caution-fg-dark" : "bg-brand dark:bg-brand-text-dark"}`}
        />
      </View>
      <Text variant="meta" tone="meta" className="mt-1.5">
        {money(spentMinor)} spent of {money(budgetMinor)}
      </Text>
    </Pressable>
  );
}

function ActiveRunCard({ view, onPress }: { view: TripView; onPress: () => void }) {
  const t = useTokens();
  const trip = view.trip;
  if (trip === null) {
    return null;
  }
  const currency = trip.currency ?? getDefaultCurrency(getDatabase());
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency });
  const status = trip.budgetMinor === null ? null : budgetStatus(trip.budgetMinor, view.totalMinor);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: t.line }}
      className="overflow-hidden rounded-lg bg-card p-4 dark:bg-card-dark"
    >
      <View className="flex-row items-center justify-between">
        <Text variant="label" tone="brand">
          Run in progress
        </Text>
        <Ionicons name="chevron-forward" size={18} color={t.ink3} />
      </View>
      <Text variant="title" className="mt-1">
        {storeLabel(view.store?.name, view.store?.branch)}
      </Text>
      <Text tone="secondary">
        {view.lines.length} item{view.lines.length === 1 ? "" : "s"}, {money(view.totalMinor)}
      </Text>
      {status !== null ? (
        <Text tone={status.over ? "caution" : "brand"} className="mt-1 font-medium">
          {status.over
            ? `${money(-status.remainingMinor)} over budget`
            : `${money(status.remainingMinor)} left of ${money(trip.budgetMinor ?? 0)}`}
        </Text>
      ) : null}
    </Pressable>
  );
}

function RunRow({ run, last, onPress }: { run: TripSummaryLine; last: boolean; onPress: () => void }) {
  const t = useTokens();
  const currency = run.currency ?? getDefaultCurrency(getDatabase());
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency });
  const status = run.budgetMinor === null ? null : budgetStatus(run.budgetMinor, run.totalMinor);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: t.line }}
      className={`min-h-16 flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line dark:border-line-dark"}`}
    >
      <View className="flex-1">
        <Text>{run.storeName ?? "Grocery run"}</Text>
        <Text variant="meta" tone="meta">
          {run.startedAt.toLocaleDateString()} · {run.purchaseCount} item{run.purchaseCount === 1 ? "" : "s"}
        </Text>
      </View>
      <View className="items-end">
        <Text className="font-medium">{money(run.totalMinor)}</Text>
        {status !== null ? (
          <Text variant="meta" tone={status.over ? "caution" : "brand"}>
            {status.over ? `${money(-status.remainingMinor)} over` : `${money(status.remainingMinor)} under`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function QtyButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: t.line, borderless: true }}
      className="h-12 w-12 items-center justify-center"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-sand dark:bg-sand-dark">
        <Ionicons name={icon} size={18} color={t.ink2} />
      </View>
    </Pressable>
  );
}

/** Budget input: blank means no budget. Returns minor units or null. */
function parseBudget(input: string, currency: string): number | null {
  const minor = parseMoney(input, currency).amountMinor;
  return input.trim() === "" || minor <= 0 ? null : minor;
}

function BudgetModal({
  initialMinor,
  currency,
  onClose,
  onSave,
}: {
  initialMinor: number | null;
  currency: string;
  onClose: () => void;
  onSave: (budgetMinor: number | null) => void;
}) {
  const [value, setValue] = useState(initialMinor === null ? "" : (initialMinor / 100).toFixed(2));
  return (
    <FullScreenModal onClose={onClose}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-5 py-6" keyboardShouldPersistTaps="handled">
        <Text variant="display" className="mb-6">
          Budget
        </Text>
        <Field label={`Budget for this run (${currency})`} hint="Leave empty for no budget.">
          <AppTextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="e.g. 2000"
            autoFocus
          />
        </Field>
        <View className="gap-3">
          <PrimaryButton label="Save budget" onPress={() => onSave(parseBudget(value, currency))} />
          <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}

function StartTripModal({
  visible,
  onClose,
  onStarted,
}: {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [storeName, setStoreName] = useState("");
  const [branch, setBranch] = useState("");
  const [budget, setBudget] = useState("");
  const stores = listStores(getDatabase());
  const currency = getDefaultCurrency(getDatabase());

  const start = () => {
    const db = getDatabase();
    const store =
      storeName.trim() === ""
        ? null
        : ensureStore(db, {
            name: storeName.trim(),
            branch: branch.trim() === "" ? null : branch.trim(),
          });
    startTrip(db, {
      storeId: store?.id ?? null,
      currency,
      budgetMinor: parseBudget(budget, currency),
    });
    setStoreName("");
    setBranch("");
    setBudget("");
    onStarted();
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-5 py-6" keyboardShouldPersistTaps="handled">
        <Text variant="display" className="mb-6">
          New grocery run
        </Text>
        <Field label={`Budget (${currency}, optional)`} hint="Each item you snap comes off the budget.">
          <AppTextInput
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder="e.g. 2000"
            autoFocus
          />
        </Field>
        <Field label="Store (optional)">
          <AppTextInput value={storeName} onChangeText={setStoreName} placeholder="e.g. Save More" />
        </Field>
        <Field label="Branch (optional)">
          <AppTextInput value={branch} onChangeText={setBranch} placeholder="e.g. Katipunan" />
        </Field>
        {stores.length > 0 ? (
          <View className="mb-5 flex-row flex-wrap gap-y-3">
            {stores.slice(0, 6).map((store) => (
              <Chip
                key={store.id}
                label={store.branch !== null ? `${store.name} ${store.branch}` : store.name}
                selected={storeName === store.name && branch === (store.branch ?? "")}
                onPress={() => {
                  setStoreName(store.name);
                  setBranch(store.branch ?? "");
                }}
              />
            ))}
          </View>
        ) : null}
        <View className="gap-3">
          <PrimaryButton label="Start run" icon="cart-outline" onPress={start} />
          <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
