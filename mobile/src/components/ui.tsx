import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT_FAMILY, useTheme, useTokens } from "../theme/tokens";

/**
 * Sticker-wallet primitives. Screens import `Text` from here, not from
 * react-native, so every string gets Bricolage Grotesque and a token color.
 * Pass `className` for layout only; color and size come from `tone`/`variant`.
 * Surfaces are stickers: a 2px ink outline plus a hard offset shadow (useTheme().shadow,
 * none in Night market).
 */

export type IconName = ComponentProps<typeof Ionicons>["name"];

const TONES = {
  primary: "text-ink",
  secondary: "text-ink-2",
  meta: "text-ink-3",
  brand: "text-brand-text",
  caution: "text-caution-fg",
  under: "text-under",
  onBrand: "text-on-brand",
  // Camera screens are always Night market, whatever the theme.
  camera: "text-cam-ink",
  cameraSecondary: "text-cam-ink-2",
  cameraActive: "text-cam-brand-text",
} as const;

// The face ships in 400/600/800 only; stay on those weights (500/700 resolve unpredictably).
const VARIANTS = {
  hero: "text-[52px] leading-[56px] font-extrabold tracking-tighter",
  display: "text-[30px] leading-[36px] font-extrabold tracking-tight",
  title: "text-xl leading-[26px] font-extrabold",
  body: "text-base leading-6",
  label: "text-sm leading-5 font-semibold",
  meta: "text-[13px] leading-[18px]",
} as const;

export type Tone = keyof typeof TONES;

// NativeWind drops a font-family class whose name has spaces, so the face goes through style.
// Tabular figures keep prices from jittering as they change.
const face = { fontFamily: FONT_FAMILY, fontVariant: ["tabular-nums" as const] };

export function Text({
  tone = "primary",
  variant = "body",
  className = "",
  style,
  ...props
}: ComponentProps<typeof RNText> & {
  tone?: Tone;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <RNText
      className={`${VARIANTS[variant]} ${TONES[tone]} ${className}`}
      style={[face, style]}
      {...props}
    />
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { t, shadow } = useTheme();
  const palette = variant === "primary" ? "bg-brand" : "bg-card";
  const tone: Tone = variant === "primary" ? "onBrand" : variant === "danger" ? "caution" : "primary";
  const fg = variant === "primary" ? t.onBrand : variant === "danger" ? t.cautionFg : t.ink;
  const inactive = disabled === true || loading === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      android_ripple={{ color: t.line }}
      style={{ boxShadow: inactive ? undefined : shadow }}
      className={`min-h-12 flex-row items-center justify-center gap-2 overflow-hidden rounded-full border-2 border-outline px-5 py-3 ${palette} ${inactive ? "opacity-50" : ""}`}
    >
      {loading === true ? (
        <ActivityIndicator color={fg} />
      ) : icon !== undefined ? (
        <Ionicons name={icon} size={20} color={fg} />
      ) : null}
      <Text tone={tone} className="text-[17px] font-extrabold">
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5">
      <Text variant="label" tone="secondary" className="mb-1.5">
        {label}
      </Text>
      {children}
      {hint !== undefined ? (
        <Text variant="meta" tone="meta" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function AppTextInput({ style, ...props }: ComponentProps<typeof TextInput>) {
  const t = useTokens();
  return (
    <TextInput
      placeholderTextColor={t.ink3}
      selectionColor={t.brandText}
      className="min-h-12 rounded-xl border-2 border-outline bg-card px-3 py-2.5 text-base text-ink"
      style={[face, style]}
      {...props}
    />
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: t.line }}
      // 36dp visual height + 6dp slop each side = 48dp touch target.
      hitSlop={6}
      className={`mr-2 min-h-9 justify-center overflow-hidden rounded-full border-2 border-outline px-3.5 ${selected ? "bg-brand" : "bg-card"}`}
    >
      <Text variant="meta" tone={selected ? "onBrand" : "primary"} className="font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}

/** A sticker: card fill, ink outline, hard shadow. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { shadow } = useTheme();
  return (
    <View style={{ boxShadow: shadow }} className={`rounded-2xl border-2 border-outline bg-card p-4 ${className}`}>
      {children}
    </View>
  );
}

/** Inline state message: caution for errors and mismatches, tint for good news. Icon + words, never color alone. */
export function Notice({
  tone = "caution",
  icon,
  children,
}: {
  tone?: "caution" | "brand";
  icon?: IconName;
  children: ReactNode;
}) {
  const t = useTokens();
  const caution = tone === "caution";
  return (
    <View
      accessibilityRole="alert"
      className={`flex-row items-start gap-2 rounded-xl border-2 px-3 py-2.5 ${caution ? "border-caution-fg bg-caution-bg" : "border-outline bg-tint"}`}
    >
      <Ionicons
        name={icon ?? (caution ? "alert-circle-outline" : "information-circle-outline")}
        size={18}
        color={caution ? t.cautionFg : t.brandText}
        style={{ marginTop: 2 }}
      />
      <Text variant="meta" tone={caution ? "caution" : "brand"} className="flex-1 font-semibold">
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon?: IconName;
}) {
  const t = useTokens();
  return (
    <View className="flex-1 items-center justify-center px-8">
      {icon !== undefined ? <Ionicons name={icon} size={32} color={t.ink3} /> : null}
      <Text variant="title" className="mt-3 text-center">
        {title}
      </Text>
      <Text tone="secondary" className="mt-2 text-center">
        {message}
      </Text>
    </View>
  );
}

/** Tappable list row: icon, title, optional detail, chevron. Rows are separated by a hairline. */
export function ListRow({
  icon,
  title,
  detail,
  onPress,
  last = false,
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: t.line }}
      className={`min-h-14 flex-row items-center gap-3 py-3 ${last ? "" : "border-b-2 border-line"}`}
    >
      {icon !== undefined ? <Ionicons name={icon} size={22} color={t.ink2} /> : null}
      <View className="flex-1">
        <Text className="font-semibold">{title}</Text>
        {detail !== undefined ? (
          <Text variant="meta" tone="meta">
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.ink3} />
    </Pressable>
  );
}

/**
 * Full-screen page over the current tab. Hardware back closes it
 * (onRequestClose); its own safe-area provider keeps content clear of the
 * status and navigation bars under edge-to-edge.
 */
export function FullScreenModal({
  visible = true,
  onClose,
  children,
}: {
  visible?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: t.paper }}>
          {children}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** Sheet from the bottom edge over a dimmed page; tap outside or hardware back closes it. */
export function BottomSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { shadow } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* Lifts the sheet over the keyboard when it holds a text field. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          style={{ paddingBottom: insets.bottom + 16, boxShadow: shadow }}
          className="rounded-t-3xl border-2 border-b-0 border-outline bg-paper px-5 pt-5"
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
