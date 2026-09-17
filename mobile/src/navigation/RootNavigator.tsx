import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useColorScheme } from "react-native";

import { AuthScreen } from "../screens/AuthScreen";
import { ManualProductScreen } from "../screens/ManualProductScreen";
import { PriceCaptureScreen } from "../screens/PriceCaptureScreen";
import { PriceTagScreen } from "../screens/PriceTagScreen";
import { ProductResolveScreen } from "../screens/ProductResolveScreen";
import { ReceiptCaptureScreen } from "../screens/ReceiptCaptureScreen";
import { ScannerScreen } from "../screens/ScannerScreen";
import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ title: "Account" }}
        />
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="ProductResolve"
          component={ProductResolveScreen}
          options={{ title: "Scanned product" }}
        />
        <Stack.Screen
          name="ManualProduct"
          component={ManualProductScreen}
          options={{ title: "New product" }}
        />
        <Stack.Screen
          name="PriceCapture"
          component={PriceCaptureScreen}
          options={{ title: "Capture price" }}
        />
        <Stack.Screen
          name="PriceTag"
          component={PriceTagScreen}
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="ReceiptCapture"
          component={ReceiptCaptureScreen}
          options={{ title: "Receipt", headerShown: false, presentation: "fullScreenModal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
