import { Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";

export function HistoryScreen() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">History</Text>
        <Text className="mt-2 text-center text-slate-600 dark:text-slate-300">
          Review previous trips, receipts, and purchases, including detected pricing discrepancies.
        </Text>
      </View>
    </ScreenContainer>
  );
}
