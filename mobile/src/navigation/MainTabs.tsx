import type { ComponentProps } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { CaptureScreen } from "../screens/CaptureScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { ListsScreen } from "../screens/ListsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShoppingScreen } from "../screens/ShoppingScreen";

export type MainTabParamList = {
  Shopping: undefined;
  Lists: undefined;
  Capture: undefined;
  Library: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<keyof MainTabParamList, { focused: IconName; outline: IconName }> = {
  Shopping: { focused: "cart", outline: "cart-outline" },
  Lists: { focused: "list", outline: "list-outline" },
  Capture: { focused: "scan", outline: "scan-outline" },
  Library: { focused: "library", outline: "library-outline" },
  History: { focused: "time", outline: "time-outline" },
  Settings: { focused: "settings", outline: "settings-outline" },
};

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: "left",
        tabBarIcon: ({ color, size, focused }) => {
          const { focused: focusedIcon, outline } = tabIcons[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? focusedIcon : outline} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Shopping" component={ShoppingScreen} options={{ title: "Shopping" }} />
      <Tab.Screen name="Lists" component={ListsScreen} options={{ title: "Lists" }} />
      <Tab.Screen name="Capture" component={CaptureScreen} options={{ title: "Capture" }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: "Library" }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}
