import { Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";

export function ListsScreen() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">Lists</Text>
        <Text className="mt-2 text-center text-slate-600 dark:text-slate-300">
          Build shopping lists before a trip and estimate totals from your price history.
        </Text>
      </View>
    </ScreenContainer>
  );
}
