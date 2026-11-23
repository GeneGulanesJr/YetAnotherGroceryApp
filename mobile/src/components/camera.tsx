import { useEffect, type ReactNode } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/tokens";
import { PrimaryButton, Text, type IconName } from "./ui";

/**
 * Shared camera chrome. Camera screens always sit on Deep Dark, whatever the
 * system theme, so these use the dark tokens directly.
 */
const dark = colors.dark;

export function CameraPermission({
  reason,
  onRequest,
  onCancel,
}: {
  reason: string;
  onRequest: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-paper-dark px-8">
      <StatusBar style="light" />
      <Ionicons name="camera-outline" size={36} color={dark.ink3} />
      <Text variant="title" tone="camera" className="text-center">
        Camera access needed
      </Text>
      <Text tone="cameraSecondary" className="text-center">
        {reason}
      </Text>
      <View className="mt-2 self-stretch">
        <PrimaryButton label="Allow camera" onPress={onRequest} />
      </View>
      <CameraButton icon="close" label="Cancel" onPress={onCancel} />
    </View>
  );
}

/** Icon + label control for the camera bar; 48dp minimum. */
export function CameraButton({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      android_ripple={{ color: dark.line, borderless: true }}
      className="min-h-12 min-w-16 items-center justify-center gap-1 px-2"
    >
      <Ionicons name={icon} size={24} color={active ? dark.brandText : dark.ink} />
      <Text variant="meta" tone={active ? "cameraActive" : "camera"}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Shutter({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-ink-dark"
    >
      <View className="h-14 w-14 rounded-full bg-ink-dark" />
    </Pressable>
  );
}

/** Bottom bar over the preview, padded past the gesture/nav bar (edge-to-edge). */
export function CameraBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingBottom: insets.bottom + 16 }}
      className="absolute inset-x-0 bottom-0 flex-row items-center justify-between bg-paper-dark/80 px-6 pt-4"
    >
      {children}
    </View>
  );
}

/** Framing guide plus one instruction line, below the status bar. */
export function CameraGuide({
  text,
  frameClassName,
}: {
  text: string;
  frameClassName: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ top: insets.top + 48 }}
      className="absolute inset-x-0 items-center"
    >
      <StatusBar style="light" />
      <View className={`rounded-lg border-2 border-ink-dark/80 ${frameClassName}`} />
      <View className="mt-4 rounded-lg bg-paper-dark/70 px-3 py-1.5">
        <Text tone="camera" className="text-center">
          {text}
        </Text>
      </View>
    </View>
  );
}

export function Processing({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-paper-dark px-8">
      <StatusBar style="light" />
      <Text variant="title" tone="camera">
        {title}
      </Text>
      <Text tone="cameraSecondary">On this phone, works offline</Text>
    </View>
  );
}

/**
 * While enabled, Android hardware back runs onBack instead of closing the
 * screen (e.g. review → camera). Later listeners run first, so this wins over
 * the navigator's own handler.
 */
export function useHardwareBack(enabled: boolean, onBack: () => void) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [enabled, onBack]);
}
