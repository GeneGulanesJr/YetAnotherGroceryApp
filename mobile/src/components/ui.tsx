import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { FONT_FAMILY, useTokens } from "../theme/tokens";

/**
 * Kami-derived primitives. Screens import `Text` from here, not from
 * react-native, so every string gets the bundled serif and a token color.
 * Pass `className` for layout only; color and size come from `tone`/`variant`.
 */

export type IconName = ComponentProps<typeof Ionicons>["name"];

const TONES = {
  primary: "text-ink dark:text-ink-dark",
  secondary: "text-ink-2 dark:text-ink-2-dark",
  meta: "text-ink-3 dark:text-ink-3-dark",
  brand: "text-brand-text dark:text-brand-text-dark",
  caution: "text-caution-fg dark:text-caution-fg-dark",
  onBrand: "text-on-brand",
  // Camera screens are always dark, whatever the system theme.
  camera: "text-ink-dark",
  cameraSecondary: "text-ink-2-dark",
  cameraActive: "text-brand-text-dark",
} as const;

// Four screen sizes (Kami: display, title, body, secondary) plus a label weight.
const VARIANTS = {
  display: "text-[28px] leading-[34px] font-medium",
  title: "text-xl leading-[26px] font-medium",
  body: "text-base leading-6",
  label: "text-sm leading-5 font-medium tracking-wide",
  meta: "text-[13px] leading-[18px]",
} as const;

export type Tone = keyof typeof TONES;

// NativeWind drops a font-family class whose name has spaces, so the serif goes through style.
const serif = { fontFamily: FONT_FAMILY };

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
      style={[serif, style]}
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
  const t = useTokens();
  const palette =
    variant === "primary"
      ? "bg-brand dark:bg-brand-dark"
      : variant === "danger"
        ? "bg-caution-bg dark:bg-caution-bg-dark"
        : "border border-line bg-sand dark:border-line-dark dark:bg-sand-dark";
  const tone: Tone =
    variant === "primary" ? "onBrand" : variant === "danger" ? "caution" : "primary";
  const fg = variant === "primary" ? t.onBrand : variant === "danger" ? t.cautionFg : t.ink;
  const inactive = disabled === true || loading === true;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      android_ripple={{ color: variant === "primary" ? t.brandText : t.line }}
      className={`min-h-12 flex-row items-center justify-center gap-2 overflow-hidden rounded-lg px-4 py-3 ${palette} ${inactive ? "opacity-50" : ""}`}
    >
      {loading === true ? (
        <ActivityIndicator color={fg} />
      ) : icon !== undefined ? (
        <Ionicons name={icon} size={20} color={fg} />
      ) : null}
      <Text tone={tone} className="font-medium">
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
      className="min-h-12 rounded-lg border border-line bg-card px-3 py-2.5 text-base text-ink dark:border-line-dark dark:bg-card-dark dark:text-ink-dark"
      style={[serif, style]}
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
      className={`mr-2 min-h-9 justify-center overflow-hidden rounded-full px-3.5 ${selected ? "bg-brand dark:bg-brand-dark" : "bg-sand dark:bg-sand-dark"}`}
    >
      <Text variant="meta" tone={selected ? "onBrand" : "secondary"} className="font-medium">
        {label}
      </Text>
    </Pressable>
  );
}

/** One quiet grouping cue: an ivory fill, no border or shadow (Kami cards). */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-lg bg-card p-4 dark:bg-card-dark ${className}`}>{children}</View>;
}

/** Inline state message: caution for errors and mismatches, brand tint for good news. */
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
      className={`flex-row items-start gap-2 rounded-lg px-3 py-2.5 ${caution ? "bg-caution-bg dark:bg-caution-bg-dark" : "bg-tint dark:bg-tint-dark"}`}
    >
      <Ionicons
        name={icon ?? (caution ? "alert-circle-outline" : "information-circle-outline")}
        size={18}
        color={caution ? t.cautionFg : t.brandText}
        style={{ marginTop: 2 }}
      />
      <Text variant="meta" tone={caution ? "caution" : "brand"} className="flex-1">
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
      className={`min-h-14 flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line dark:border-line-dark"}`}
    >
      {icon !== undefined ? <Ionicons name={icon} size={22} color={t.ink2} /> : null}
      <View className="flex-1">
        <Text>{title}</Text>
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
