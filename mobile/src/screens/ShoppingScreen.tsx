import { Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";

export function ShoppingScreen() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">Shopping</Text>
        <Text className="mt-2 text-center text-slate-600 dark:text-slate-300">
          Start a trip, scan products, capture shelf prices, and verify your receipt at checkout.
        </Text>
      </View>
    </ScreenContainer>
  );
}
