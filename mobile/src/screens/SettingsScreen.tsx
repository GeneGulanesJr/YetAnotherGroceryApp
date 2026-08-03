import { Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";

export function SettingsScreen() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</Text>
        <Text className="mt-2 text-center text-slate-600 dark:text-slate-300">
          Manage synchronization, storage, image retention, and account preferences.
        </Text>
      </View>
    </ScreenContainer>
  );
}
