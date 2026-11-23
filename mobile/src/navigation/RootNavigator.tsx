import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useColorScheme } from "react-native";

import { AuthScreen } from "../screens/AuthScreen";
import { ManualProductScreen } from "../screens/ManualProductScreen";
import { PriceCaptureScreen } from "../screens/PriceCaptureScreen";
import { PriceTagScreen } from "../screens/PriceTagScreen";
import { ProductResolveScreen } from "../screens/ProductResolveScreen";
import { ReceiptCaptureScreen } from "../screens/ReceiptCaptureScreen";
import { ScannerScreen } from "../screens/ScannerScreen";
import { SnapItemScreen } from "../screens/SnapItemScreen";
import { colors, FONT_FAMILY } from "../theme/tokens";
import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const regular = { fontFamily: FONT_FAMILY, fontWeight: "400" } as const;
const medium = { fontFamily: FONT_FAMILY, fontWeight: "500" } as const;

/** Headers, tab bar and screen backgrounds from the Kami tokens; Kami has no bold. */
function navigationTheme(dark: boolean): Theme {
  const t = colors[dark ? "dark" : "light"];
  return {
    dark,
    colors: {
      primary: t.brandText,
      background: t.paper,
      card: t.paper,
      text: t.ink,
      border: t.line,
      notification: t.cautionFg,
    },
    fonts: { regular, medium, bold: medium, heavy: medium },
  };
}

export function RootNavigator() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <NavigationContainer theme={navigationTheme(isDark)}>
      <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
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
          name="SnapItem"
          component={SnapItemScreen}
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
