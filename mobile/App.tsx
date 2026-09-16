import { useEffect } from "react";
import "./global.css";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { getDatabase } from "./src/db/database";
import { attachForegroundSync, maybeSync } from "./src/sync/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
});

export default function App() {
  // Opens SQLite, applies migrations, and seeds defaults before any screen
  // queries it (getDatabase is a synchronous singleton).
  getDatabase();

  // Spec sync triggers: on startup and on foreground resume (background
  // tasks are a later milestone). No-ops while no backend is configured.
  useEffect(() => {
    void maybeSync();
    return attachForegroundSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <RootNavigator />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
