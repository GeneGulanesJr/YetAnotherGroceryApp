import { useCallback, useState } from "react";
import { Alert, FlatList, Image, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHardwareBack } from "../components/camera";
import { ScreenContainer } from "../components/ScreenContainer";
import { CartBox, IouSlip, WalletStrip } from "../components/wallet";
import {
  AppTextInput,
  BottomSheet,
  Chip,
  Field,
  FullScreenModal,
  ListRow,
  PrimaryButton,
  Text,
  type IconName,
} from "../components/ui";
import { getDatabase } from "../db/database";
import { listLists, type ListSummaryLine } from "../db/repositories/lists";
import { getDefaultCurrency } from "../db/repositories/meta";
import { searchProducts, type ProductListItem } from "../db/repositories/products";
import { listReceipts, type ReceiptSummaryLine } from "../db/repositories/receipts";
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
import { useTheme, useTokens } from "../theme/tokens";
import { budgetStatus, formatMoney, parseMoney } from "../utils/money";
import { ReceiptList, TripDetailModal } from "../components/TripHistory";

type ShoppingNavigation = NativeStackNavigationProp<RootStackParamList>;

interface TripView {
  trip: Trip | null;
  store: Store | null;
  lines: TripPurchaseLine[];
  totalMinor: number;
  /** Finished runs, newest first (cancelled ones are left out). */
  runs: TripSummaryLine[];
  receipts: ReceiptSummaryLine[];
  /** Home sections shown when no run is open: shopping lists and recent library products. */
  lists: ListSummaryLine[];
  products: ProductListItem[];
}

function loadView(): TripView {
  const db = getDatabase();
  const runs = listTrips(db, { status: "completed" });
  const receipts = listReceipts(db);
  const lists = listLists(db);
  const products = searchProducts(db, "", { limit: 3 });
  const trip = getActiveTrip(db) ?? null;
  if (trip === null) {
    return { trip: null, store: null, lines: [], totalMinor: 0, runs, receipts, lists, products };
  }
  const lines = getTripPurchases(db, trip.id);
  return {
    trip,
    store: getTripStore(db, trip) ?? null,
    lines,
    totalMinor: tripTotalMinor(lines),
    runs,
    receipts,
    lists,
    products,
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
  const [sheetLineId, setSheetLineId] = useState<string | null>(null);
  const [allItemsOpen, setAllItemsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  // Only while Home is on screen: a stack page pushed on top (Lists, Library) owns back then.
  const focused = useIsFocused();
  useHardwareBack(activeShown && focused, () => setShowActive(false));

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
            <Text tone={status.over ? "caution" : "under"} className="mt-3 font-extrabold">
              {status.over
                ? `▲ ${money(-status.remainingMinor)} over the ${money(summary.budgetMinor ?? 0)} budget`
                : `✓ ${money(status.remainingMinor)} under the ${money(summary.budgetMinor ?? 0)} budget`}
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
    const status = trip.budgetMinor === null ? null : budgetStatus(trip.budgetMinor, view.totalMinor);
    const sheetLine = view.lines.find((line) => line.id === sheetLineId);
    return (
      <ScreenContainer>
        <View className="flex-1 px-5">
          <View className="flex-row items-center gap-2">
            <AllRunsButton onPress={() => setShowActive(false)} />
            <View className="flex-1 items-end">
              <View className="max-w-full rounded-full border-2 border-outline px-3 py-1">
                <Text variant="label" numberOfLines={1}>
                  {storeLabel(view.store?.name, view.store?.branch)}
                </Text>
              </View>
            </View>
            <IconButton icon="ellipsis-horizontal" label="Run menu" onPress={() => setMenuOpen(true)} />
          </View>

          <BudgetHero
            budgetMinor={trip.budgetMinor}
            spentMinor={view.totalMinor}
            itemCount={view.lines.length}
            currency={currency}
            onEdit={() => setBudgetOpen(true)}
          />

          <CartBox
            lines={view.lines}
            onPressLine={(line) => setSheetLineId(line.id)}
            onPressMore={() => setAllItemsOpen(true)}
          />

          {status !== null ? (
            <View className="pt-2">
              {status.over ? (
                <IouSlip overMinor={-status.remainingMinor} currency={currency} onPress={() => setBudgetOpen(true)} />
              ) : currency === "PHP" ? (
                <WalletStrip remainingMinor={status.remainingMinor} currency={currency} />
              ) : null}
            </View>
          ) : null}

          <View className="gap-3 pb-3 pt-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <PrimaryButton
                  label="Receipt"
                  icon="receipt-outline"
                  variant="secondary"
                  onPress={() => navigation.navigate("ReceiptCapture", { tripId: trip.id })}
                />
              </View>
              <View className="flex-1">
                <PrimaryButton label="Finish run" icon="checkmark-done" variant="secondary" onPress={finishTrip} />
              </View>
            </View>
            <PrimaryButton
              label="Snap next item"
              icon="camera-outline"
              onPress={() => navigation.navigate("SnapItem")}
            />
          </View>
        </View>

        {menuOpen ? (
          <RunMenu
            title={storeLabel(view.store?.name, view.store?.branch)}
            detail={`${formatMoney({ amountMinor: view.totalMinor, currency })} spent, ${view.lines.length} item${view.lines.length === 1 ? "" : "s"}`}
            onEditBudget={() => {
              setMenuOpen(false);
              setBudgetOpen(true);
            }}
            onOpen={(screen) => {
              setMenuOpen(false);
              navigation.navigate(screen);
            }}
            onCancelRun={() => {
              setMenuOpen(false);
              dropTrip();
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}

        {sheetLine !== undefined ? (
          <ItemSheet line={sheetLine} onClose={() => setSheetLineId(null)} onChanged={refresh} />
        ) : null}

        {allItemsOpen ? (
          <AllItemsModal lines={view.lines} onClose={() => setAllItemsOpen(false)} onChanged={refresh} />
        ) : null}

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
        // Bottom room so the floating Snap button never covers the last row.
        contentContainerClassName="px-5 pb-32 pt-2 flex-grow"
        ListHeaderComponent={
          <View className="mb-1">
            {view.trip !== null ? (
              <ActiveRunCard
                view={view}
                onPress={() => setShowActive(true)}
              />
            ) : (
              <PrimaryButton label="Grocery run" icon="add" onPress={() => setStartOpen(true)} />
            )}
            <HomeSections view={view} navigation={navigation} />
            <SectionHead title="Past runs" />
          </View>
        }
        ListEmptyComponent={
          <Text tone="meta" className="mt-1">
            Finished runs show up here with what you spent against the budget.
          </Text>
        }
        ListFooterComponent={<ReceiptList receipts={view.receipts} />}
        renderItem={({ item, index }) => (
          <RunRow run={item} last={index === view.runs.length - 1} onPress={() => setOpenRun(item)} />
        )}
      />

      <SnapFab onPress={() => navigation.navigate("SnapItem")} />

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

function SectionHead({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const t = useTokens();
  return (
    <View className="mt-6 min-h-12 flex-row items-center justify-between">
      <Text variant="title">{title}</Text>
      {onSeeAll !== undefined ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={`See all ${title.toLowerCase()}`}
          className="min-h-12 flex-row items-center gap-0.5 pl-3"
        >
          <Text className="font-extrabold">See all</Text>
          <Ionicons name="chevron-forward" size={16} color={t.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Lists and Library on the home page, so neither needs a tab: list cards
 * open that list; the search box and product rows open the Library.
 */
function HomeSections({ view, navigation }: { view: TripView; navigation: ShoppingNavigation }) {
  const { t, shadow } = useTheme();
  return (
    <View>
      <SectionHead title="Lists" onSeeAll={() => navigation.navigate("Lists")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-2 pr-2 pt-0.5">
        {view.lists.map((list) => (
          <Pressable
            key={list.id}
            onPress={() => navigation.navigate("Lists", { listId: list.id })}
            accessibilityRole="button"
            accessibilityLabel={`${list.name}, ${list.openCount} open of ${list.itemCount}`}
            style={{ boxShadow: shadow }}
            className="min-h-24 w-36 rounded-2xl border-2 border-outline bg-card p-3"
          >
            <Text className="font-extrabold" numberOfLines={2}>
              {list.name}
            </Text>
            <Text variant="meta" tone="secondary" className="mt-auto">
              {list.openCount} open of {list.itemCount}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => navigation.navigate("Lists")}
          accessibilityRole="button"
          accessibilityLabel={view.lists.length === 0 ? "Make your first list" : "New list"}
          className="min-h-24 w-36 items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-outline p-3"
        >
          <Ionicons name="add" size={22} color={t.ink} />
          <Text variant="meta" className="text-center font-semibold">
            {view.lists.length === 0 ? "Plan a list before you go" : "New list"}
          </Text>
        </Pressable>
      </ScrollView>

      <SectionHead title="Library" onSeeAll={() => navigation.navigate("Library")} />
      <Pressable
        onPress={() => navigation.navigate("Library")}
        accessibilityRole="button"
        accessibilityLabel="Search products and brands"
        className="min-h-12 flex-row items-center gap-2 rounded-xl border-2 border-outline bg-card px-3"
      >
        <Ionicons name="search" size={20} color={t.ink3} />
        <Text tone="meta">Search products and brands</Text>
      </Pressable>
      {view.products.map((product, index) => (
        <Pressable
          key={product.id}
          onPress={() => navigation.navigate("Library", { productId: product.id })}
          accessibilityRole="button"
          android_ripple={{ color: t.line }}
          className={`min-h-14 flex-row items-center gap-3 py-2 ${index === view.products.length - 1 ? "" : "border-b-2 border-line"}`}
        >
          <Text className="flex-1 font-semibold" numberOfLines={1}>
            {product.name}
          </Text>
          {product.lastPriceMinor !== null ? (
            <Text className="font-extrabold">
              {formatMoney({ amountMinor: product.lastPriceMinor, currency: product.lastCurrency ?? "PHP" })}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** The app's one main action, floating over the home page. */
function SnapFab({ onPress }: { onPress: () => void }) {
  const { t, shadow } = useTheme();
  // Absolute children ignore the container's safe-area padding, so add the inset here.
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ bottom: insets.bottom + 16 }} className="absolute inset-x-0 items-center">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Snap item"
        accessibilityHint="Photograph an item with its price tag"
        style={{ boxShadow: shadow }}
        className="min-h-14 flex-row items-center gap-2.5 rounded-full border-2 border-outline bg-brand px-7"
      >
        <Ionicons name="camera" size={24} color={t.onBrand} />
        <Text tone="onBrand" className="text-lg font-extrabold">
          Snap item
        </Text>
      </Pressable>
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: t.line, borderless: true }}
      className="h-12 w-12 items-center justify-center"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-outline bg-card">
        <Ionicons name={icon} size={20} color={t.ink} />
      </View>
    </Pressable>
  );
}

/**
 * The hero: what is left to spend (or how far over), then spent of budget.
 * Over/under always pairs color with a ▲/✓ and a word. Tap to edit the budget.
 */
function BudgetHero({
  budgetMinor,
  spentMinor,
  itemCount,
  currency,
  onEdit,
}: {
  budgetMinor: number | null;
  spentMinor: number;
  itemCount: number;
  currency: string;
  onEdit: () => void;
}) {
  const t = useTokens();
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency });
  const items = `${itemCount} item${itemCount === 1 ? "" : "s"}`;

  if (budgetMinor === null) {
    return (
      <View className="flex-row items-end justify-between gap-3 pb-2 pt-1">
        <View className="flex-1">
          <Text variant="label" tone="secondary">
            Spent so far
          </Text>
          <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
            {money(spentMinor)}
          </Text>
          <Text variant="meta" tone="secondary" className="font-semibold">
            {items}, no budget
          </Text>
        </View>
        <PrimaryButton label="Set budget" icon="wallet-outline" variant="secondary" onPress={onEdit} />
      </View>
    );
  }

  const status = budgetStatus(budgetMinor, spentMinor);
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${status.over ? "Over budget by" : "Left to spend"} ${money(Math.abs(status.remainingMinor))}. ${money(spentMinor)} spent of ${money(budgetMinor)}. Edit budget`}
      className="pb-2 pt-1"
    >
      <View className="flex-row items-center gap-1.5">
        {status.over ? (
          <Text tone="caution" className="font-extrabold">
            ▲ Over budget
          </Text>
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color={t.under} />
            <Text tone="under" className="font-extrabold">
              Left to spend
            </Text>
          </>
        )}
        <Ionicons name="create-outline" size={16} color={t.ink3} />
      </View>
      <Text
        variant="hero"
        tone={status.over ? "caution" : "primary"}
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.2}
      >
        {money(Math.abs(status.remainingMinor))}
      </Text>
      <Text variant="meta" tone="secondary" className="font-semibold">
        {money(spentMinor)} spent of {money(budgetMinor)}, {items}
      </Text>
    </Pressable>
  );
}

function ActiveRunCard({ view, onPress }: { view: TripView; onPress: () => void }) {
  const { t, shadow } = useTheme();
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
      style={{ boxShadow: shadow }}
      className="overflow-hidden rounded-2xl border-2 border-outline bg-card p-4"
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
        <Text tone={status.over ? "caution" : "under"} className="mt-1 font-extrabold">
          {status.over
            ? `▲ ${money(-status.remainingMinor)} over budget`
            : `✓ ${money(status.remainingMinor)} left of ${money(trip.budgetMinor ?? 0)}`}
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
      className={`min-h-16 flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line"}`}
    >
      <View className="flex-1">
        <Text>{run.storeName ?? "Grocery run"}</Text>
        <Text variant="meta" tone="meta">
          {run.startedAt.toLocaleDateString()} · {run.purchaseCount} item{run.purchaseCount === 1 ? "" : "s"}
        </Text>
      </View>
      <View className="items-end">
        <Text className="font-semibold">{money(run.totalMinor)}</Text>
        {status !== null ? (
          <Text variant="meta" tone={status.over ? "caution" : "under"} className="font-semibold">
            {status.over ? `▲ ${money(-status.remainingMinor)} over` : `✓ ${money(status.remainingMinor)} under`}
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
      <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-outline bg-card">
        <Ionicons name={icon} size={20} color={t.ink} />
      </View>
    </Pressable>
  );
}

function TextButton({ label, tone, onPress }: { label: string; tone?: "caution"; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-12 items-center justify-center">
      <Text tone={tone ?? "secondary"} className="font-extrabold">
        {label}
      </Text>
    </Pressable>
  );
}

function changeQuantity(line: TripPurchaseLine, quantity: number, onChanged: () => void) {
  // Zero removes the line (setPurchaseQuantity).
  setPurchaseQuantity(getDatabase(), line.id, quantity);
  onChanged();
}

/** Bottom sheet for one cart sticker: quantity −/+ and remove. Hardware back closes it. */
function ItemSheet({
  line,
  onClose,
  onChanged,
}: {
  line: TripPurchaseLine;
  onClose: () => void;
  onChanged: () => void;
}) {
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency: line.currency });
  return (
    <BottomSheet onClose={onClose}>
        <View className="flex-row items-center gap-4">
          {line.photoUri !== null ? (
            <Image source={{ uri: line.photoUri }} className="h-20 w-20 rounded-2xl border-2 border-outline" />
          ) : null}
          <View className="flex-1">
            <Text variant="title" numberOfLines={2}>
              {line.productName}
            </Text>
            <Text tone="secondary" className="mt-0.5">
              {money(line.shelfPriceMinor)} × {line.quantity} = {money(line.shelfPriceMinor * line.quantity)}
            </Text>
          </View>
        </View>
        <View className="mt-4 flex-row items-center justify-center gap-6">
          <QtyButton
            icon="remove"
            label={`One less ${line.productName}`}
            onPress={() => changeQuantity(line, line.quantity - 1, onChanged)}
          />
          <Text variant="display" accessibilityLabel={`Quantity ${line.quantity}`}>
            {line.quantity}
          </Text>
          <QtyButton
            icon="add"
            label={`One more ${line.productName}`}
            onPress={() => changeQuantity(line, line.quantity + 1, onChanged)}
          />
        </View>
        <View className="mt-4 gap-3">
          <PrimaryButton
            label="Remove from run"
            icon="trash-outline"
            variant="danger"
            onPress={() => {
              removePurchase(getDatabase(), line.id);
              onChanged();
              onClose();
            }}
          />
          <PrimaryButton label="Done" variant="secondary" onPress={onClose} />
        </View>
    </BottomSheet>
  );
}

/**
 * Run menu behind the ⋯ button: the rare actions, kept out of the thumb's
 * easy path. Cancel run asks before it discards the run.
 */
function RunMenu({
  title,
  detail,
  onEditBudget,
  onOpen,
  onCancelRun,
  onClose,
}: {
  title: string;
  detail: string;
  onEditBudget: () => void;
  onOpen: (screen: "Lists" | "Library") => void;
  onCancelRun: () => void;
  onClose: () => void;
}) {
  const confirmCancel = () =>
    Alert.alert("Cancel this run?", "It leaves your list of runs and its total is not kept. Prices you captured stay in the Library.", [
      { text: "Keep shopping", style: "cancel" },
      { text: "Cancel run", style: "destructive", onPress: onCancelRun },
    ]);
  return (
    <BottomSheet onClose={onClose}>
      <Text variant="title" numberOfLines={1}>
        {title}
      </Text>
      <Text tone="secondary" className="mt-0.5">
        {detail}
      </Text>
      <View className="mt-2">
        <ListRow icon="wallet-outline" title="Edit budget" onPress={onEditBudget} />
        <ListRow icon="list-outline" title="Lists" detail="Check what's still on your list" onPress={() => onOpen("Lists")} />
        <ListRow icon="library-outline" title="Library" detail="Prices you've captured" onPress={() => onOpen("Library")} last />
      </View>
      <View className="mt-3 gap-3">
        <PrimaryButton label="Cancel run" icon="trash-outline" variant="danger" onPress={confirmCancel} />
        <PrimaryButton label="Done" variant="secondary" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

/** Every line of the run with −/+/remove, for the items folded into "+k more". */
function AllItemsModal({
  lines,
  onClose,
  onChanged,
}: {
  lines: readonly TripPurchaseLine[];
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <FullScreenModal onClose={onClose}>
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text variant="display">All items</Text>
        <TextButton label="Close" onPress={onClose} />
      </View>
      <FlatList
        data={[...lines].reverse()}
        keyExtractor={(line) => line.id}
        contentContainerClassName="px-5 pb-6"
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-1 border-b-2 border-line py-3">
            <View className="flex-1">
              <Text className="font-semibold">{item.productName}</Text>
              <Text variant="meta" tone="secondary" className="mt-0.5">
                {formatMoney({ amountMinor: item.shelfPriceMinor, currency: item.currency })} × {item.quantity} ={" "}
                {formatMoney({ amountMinor: item.shelfPriceMinor * item.quantity, currency: item.currency })}
              </Text>
            </View>
            <QtyButton
              icon="remove"
              label={`One less ${item.productName}`}
              onPress={() => changeQuantity(item, item.quantity - 1, onChanged)}
            />
            <QtyButton
              icon="add"
              label={`One more ${item.productName}`}
              onPress={() => changeQuantity(item, item.quantity + 1, onChanged)}
            />
            <QtyButton
              icon="trash-outline"
              label={`Remove ${item.productName}`}
              onPress={() => {
                removePurchase(getDatabase(), item.id);
                onChanged();
              }}
            />
          </View>
        )}
      />
    </FullScreenModal>
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
