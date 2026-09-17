import { useEffect } from "react";
import "./global.css";

import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SyncAuthBridge } from "./src/auth/SyncAuthBridge";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { getDatabase } from "./src/db/database";
import { attachForegroundSync, maybeSync } from "./src/sync/client";
import { ensureBackgroundSync } from "./src/sync/background";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
});

// Inlined by Expo from .env.local at build time (EXPO_PUBLIC_* convention).
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export default function App() {
  // Opens SQLite, applies migrations, and seeds defaults before any screen
  // queries it (getDatabase is a synchronous singleton).
  getDatabase();

  // Spec sync triggers: on startup and on foreground resume (reliable),
  // plus a best-effort periodic background task. All no-op while no backend
  // is configured.
  useEffect(() => {
    void maybeSync();
    void ensureBackgroundSync();
    return attachForegroundSync();
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SyncAuthBridge />
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="auto" />
            <RootNavigator />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
