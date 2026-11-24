import { useState } from "react";
import { Image, PixelRatio, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { TripPurchaseLine } from "../db/repositories/trips";
import { moneyColors, useTheme } from "../theme/tokens";
import { formatMoney } from "../utils/money";
import { breakDownCash, layoutStickers, type Box, type StickerRect } from "../utils/wallet";
import { Text } from "./ui";

const TILT = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.2, -2, 1.5];
// Room inside the box for tilted corners and the offset shadow.
const PAD = 8;
// Bold digits at the 12px floor, plus the label's padding and the sticker border.
const PRICE_CHAR_WIDTH = 7;
const PRICE_CHROME = 12;

const lineCost = (line: TripPurchaseLine) =>
  formatMoney({ amountMinor: line.shelfPriceMinor * line.quantity, currency: line.currency });

/**
 * What's in the cart as photo stickers, newest first, area proportional to
 * what the line costs (shelf price × quantity). The box takes the space it is
 * given and never grows: stickers shrink, then the oldest fold into "+k more".
 */
export function CartBox({
  lines,
  onPressLine,
  onPressMore,
}: {
  lines: readonly TripPurchaseLine[];
  onPressLine: (line: TripPurchaseLine) => void;
  onPressMore: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  // Lines whose cutout file failed to load go back to the square full photo.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const newest = [...lines].reverse();
  const cutoutOf = (line: TripPurchaseLine) => (broken.has(line.id) ? null : line.cutout);
  const fontScale = Math.min(PixelRatio.getFontScale(), 1.3);
  const { stickers, more, hidden } =
    box === null
      ? { stickers: [], more: null, hidden: 0 }
      : layoutStickers(
          newest.map((line) => {
            const cost = line.shelfPriceMinor * line.quantity;
            const cutout = cutoutOf(line);
            return cutout === null
              ? { cost }
              : {
                  cost,
                  aspect: cutout.width / cutout.height,
                  minWidth: Math.ceil(lineCost(line).length * PRICE_CHAR_WIDTH * fontScale) + PRICE_CHROME,
                };
          }),
          { width: box.width - 2 * PAD, height: box.height - 2 * PAD },
        );

  return (
    <View
      className="min-h-0 flex-1 overflow-hidden"
      onLayout={({ nativeEvent }) => setBox({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}
    >
      {lines.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text tone="secondary" className="text-center font-semibold">
            Snap an item with its price tag. Its photo lands here, sized by what it costs.
          </Text>
        </View>
      ) : (
        <>
          {stickers.map((rect, i) => (
            <Sticker
              key={newest[i].id}
              line={newest[i]}
              cutout={cutoutOf(newest[i])}
              rect={rect}
              tilt={TILT[i % TILT.length]}
              onPress={() => onPressLine(newest[i])}
              onCutoutError={() => setBroken((ids) => new Set(ids).add(newest[i].id))}
            />
          ))}
          {more !== null ? <MoreSticker count={hidden} rect={more} onPress={onPressMore} /> : null}
        </>
      )}
    </View>
  );
}

function Sticker({
  line,
  cutout,
  rect,
  tilt,
  onPress,
  onCutoutError,
}: {
  line: TripPurchaseLine;
  cutout: TripPurchaseLine["cutout"];
  rect: StickerRect;
  tilt: number;
  onPress: () => void;
  onCutoutError: () => void;
}) {
  const { t, shadow } = useTheme();
  const cost = lineCost(line);
  const side = Math.min(rect.width, rect.height);
  const priceSize = side >= 140 ? 18 : side >= 100 ? 15 : 13;
  const showName = side >= 110 || line.photoUri === null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${line.productName}, ${cost}${line.quantity > 1 ? `, ${line.quantity} pieces` : ""}. Change quantity or remove`}
      style={{
        position: "absolute",
        left: PAD + rect.x,
        top: PAD + rect.y,
        width: rect.width,
        height: rect.height,
        transform: [{ rotate: `${tilt}deg` }],
        boxShadow: shadow,
      }}
      className="overflow-hidden rounded-2xl border-2 border-outline bg-sand"
    >
      {cutout !== null ? (
        <Image source={{ uri: cutout.uri }} style={{ flex: 1, margin: 3 }} resizeMode="contain" onError={onCutoutError} />
      ) : line.photoUri !== null ? (
        <Image source={{ uri: line.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View className="items-center pt-2">
          <Ionicons name="pricetag-outline" size={20} color={t.ink3} />
        </View>
      )}
      {line.quantity > 1 ? (
        <View className="absolute right-1 top-1 rounded-full border-2 border-outline bg-brand px-1.5">
          <Text variant="meta" tone="onBrand" className="font-extrabold" maxFontSizeMultiplier={1.2}>
            ×{line.quantity}
          </Text>
        </View>
      ) : null}
      {/* On a cutout the price sits in its own strip, so it never covers the item. */}
      <View className={cutout !== null ? "bg-card px-1 py-0.5" : "absolute inset-x-1 bottom-1 rounded-lg bg-card px-1.5 py-0.5"}>
        {showName ? (
          <Text numberOfLines={1} className="text-xs font-semibold" style={{ lineHeight: 15 }} maxFontSizeMultiplier={1.2}>
            {line.productName}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={cutout !== null ? 12 / priceSize : 0.9}
          maxFontSizeMultiplier={1.3}
          className="font-extrabold"
          style={{ fontSize: priceSize, lineHeight: Math.round(priceSize * 1.25) }}
        >
          {cost}
        </Text>
      </View>
    </Pressable>
  );
}

function MoreSticker({ count, rect, onPress }: { count: number; rect: StickerRect; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} more items. Show all`}
      style={{ position: "absolute", left: PAD + rect.x, top: PAD + rect.y, width: rect.width, height: rect.height }}
      className="items-center justify-center rounded-2xl border-2 border-dashed border-outline bg-card"
    >
      <Text className="font-extrabold" maxFontSizeMultiplier={1.2}>
        +{count}
      </Text>
      <Text variant="meta" tone="secondary" maxFontSizeMultiplier={1.2}>
        more
      </Text>
    </Pressable>
  );
}

/**
 * The budget still unspent as peso notes and coins (greedy), one sticker per
 * denomination with a count. One fixed-height row, so it never pushes the buttons.
 */
export function WalletStrip({ remainingMinor, currency }: { remainingMinor: number; currency: string }) {
  const bills = breakDownCash(remainingMinor, moneyColors.bills);
  const rest = remainingMinor - bills.reduce((sum, { piece, count }) => sum + piece.minor * count, 0);
  const coins = breakDownCash(rest, moneyColors.coins);
  return (
    <View
      accessible
      accessibilityLabel={`Still in your wallet: ${formatMoney({ amountMinor: remainingMinor, currency })}`}
    >
      <Text variant="label" tone="secondary">
        Still in your wallet
      </Text>
      {bills.length + coins.length === 0 ? (
        <Text tone="secondary" className="h-14 py-3">
          Nothing left. One more item puts you over.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="h-16" contentContainerClassName="items-center pl-1 pr-4">
          {bills.map(({ piece, count }, i) => (
            <View
              key={piece.minor}
              style={{ backgroundColor: piece.bg, transform: [{ rotate: `${TILT[i % TILT.length]}deg` }] }}
              className="-mr-3 h-11 w-20 justify-center rounded-lg border-2 border-outline px-2"
            >
              {/* 19px bold counts as large text (3:1): white on the ₱1000/₱100 blues and purples is 3.5–4.3:1. */}
              <Text className="text-[19px] font-extrabold" style={{ color: piece.fg }} maxFontSizeMultiplier={1.1}>
                ₱{piece.label}
              </Text>
              {count > 1 ? <CountBadge count={count} /> : null}
            </View>
          ))}
          <View className="w-5" />
          {coins.map(({ piece, count }) => (
            <View key={piece.minor} className="-mr-1 rounded-full border-2 border-outline">
              <View
                style={{ backgroundColor: piece.bg, borderColor: piece.ring }}
                className="h-10 w-10 items-center justify-center rounded-full border-[3px]"
              >
                <Text className="text-xs font-extrabold" style={{ color: moneyColors.ink }} maxFontSizeMultiplier={1}>
                  {piece.label}
                </Text>
              </View>
              {count > 1 ? <CountBadge count={count} /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <View className="absolute -bottom-2 -right-1 rounded-full border-2 border-outline bg-card px-1">
      <Text className="text-xs font-extrabold" style={{ lineHeight: 15 }} maxFontSizeMultiplier={1}>
        ×{count}
      </Text>
    </View>
  );
}

/** Over budget: a striped IOU slip with the amount and the next step. Tap to raise the budget. */
export function IouSlip({ overMinor, currency, onPress }: { overMinor: number; currency: string; onPress: () => void }) {
  const { shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Over budget by ${formatMoney({ amountMinor: overMinor, currency })}. Put one item back or raise the budget. Tap to edit the budget`}
      style={{ boxShadow: shadow, transform: [{ rotate: "-1.5deg" }] }}
      className="flex-row overflow-hidden rounded-xl border-2 border-caution-fg bg-card"
    >
      {/* Absolute, so the stripes never set the slip's height; the text does. */}
      <View className="absolute bottom-0 left-0 top-0 w-4 items-center overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} className="my-[3px] h-1.5 w-8 bg-caution-fg" style={{ transform: [{ rotate: "45deg" }] }} />
        ))}
      </View>
      <View className="ml-4 flex-1 px-3.5 py-2.5">
        <Text tone="caution" className="text-[19px] font-extrabold">
          ▲ IOU {formatMoney({ amountMinor: overMinor, currency })}
        </Text>
        <Text variant="meta" tone="secondary" className="font-semibold">
          Wallet&apos;s empty. Put one item back or raise the budget.
        </Text>
      </View>
    </Pressable>
  );
}
