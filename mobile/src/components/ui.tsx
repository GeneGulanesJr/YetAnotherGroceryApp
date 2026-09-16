import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const palette =
    variant === "primary"
      ? "bg-teal-700 active:bg-teal-800"
      : variant === "danger"
        ? "bg-rose-600 active:bg-rose-700"
        : "bg-slate-200 active:bg-slate-300 dark:bg-slate-700 dark:active:bg-slate-600";
  const textPalette =
    variant === "secondary" ? "text-slate-900 dark:text-slate-50" : "text-white";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${palette} ${disabled || loading ? "opacity-50" : ""}`}
    >
      {loading === true ? <ActivityIndicator color="currentColor" /> : null}
      <Text className={`text-base font-semibold ${textPalette}`}>{label}</Text>
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
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Text>
      {children}
      {hint !== undefined ? (
        <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</Text>
      ) : null}
    </View>
  );
}

export function AppTextInput(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
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
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-1.5 ${selected ? "bg-teal-700" : "bg-slate-200 dark:bg-slate-700"}`}
    >
      <Text
        className={`text-sm font-medium ${selected ? "text-white" : "text-slate-800 dark:text-slate-200"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</Text>
      <Text className="mt-2 text-center text-slate-600 dark:text-slate-300">{message}</Text>
    </View>
  );
}
