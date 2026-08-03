import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useColorScheme } from "react-native";

import { MainTabs } from "./MainTabs";

export function RootNavigator() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}
