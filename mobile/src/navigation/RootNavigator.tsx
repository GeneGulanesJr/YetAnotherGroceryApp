import { NavigationContainer, useNavigation, type Theme } from "@react-navigation/native";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthScreen } from "../screens/AuthScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { ListsScreen } from "../screens/ListsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShoppingScreen } from "../screens/ShoppingScreen";
import { ManualProductScreen } from "../screens/ManualProductScreen";
import { PriceCaptureScreen } from "../screens/PriceCaptureScreen";
import { PriceTagScreen } from "../screens/PriceTagScreen";
import { ProductResolveScreen } from "../screens/ProductResolveScreen";
import { ReceiptCaptureScreen } from "../screens/ReceiptCaptureScreen";
import { ScannerScreen } from "../screens/ScannerScreen";
import { SnapItemScreen } from "../screens/SnapItemScreen";
import { FONT_FAMILY, isDarkTheme, useTheme, type ThemeTokens } from "../theme/tokens";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const regular = { fontFamily: FONT_FAMILY, fontWeight: "400" } as const;
const semibold = { fontFamily: FONT_FAMILY, fontWeight: "600" } as const;
const extrabold = { fontFamily: FONT_FAMILY, fontWeight: "800" } as const;

/** Headers, tab bar and screen backgrounds from the active theme. */
function navigationTheme(dark: boolean, t: ThemeTokens): Theme {
  return {
    dark,
    colors: {
      primary: t.ink,
      background: t.paper,
      card: t.paper,
      text: t.ink,
      border: t.outline,
      notification: t.cautionFg,
    },
    fonts: { regular, medium: semibold, bold: extrabold, heavy: extrabold },
  };
}

/** Settings lives behind the gear on the home header (there is no tab bar). */
function SettingsGear() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTheme();
  return (
    <Pressable
      onPress={() => navigation.navigate("Settings")}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      className="h-12 w-12 items-center justify-center"
    >
      <Ionicons name="settings-outline" size={26} color={t.ink} />
    </Pressable>
  );
}

export function RootNavigator() {
  const { name, t } = useTheme();

  return (
    <NavigationContainer theme={navigationTheme(isDarkTheme(name), t)}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: FONT_FAMILY, fontWeight: "800", fontSize: 24 },
        }}
      >
        <Stack.Screen
          name="Home"
          component={ShoppingScreen}
          options={{ title: "Shopping", headerRight: () => <SettingsGear /> }}
        />
        <Stack.Screen name="Lists" component={ListsScreen} options={{ title: "Lists" }} />
        <Stack.Screen name="Library" component={LibraryScreen} options={{ title: "Library" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
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
