import { useEffect } from "react";
import "./global.css";

import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { authConfigured, clerkPublishableKey } from "./src/auth/config";
import { SyncAuthBridge } from "./src/auth/SyncAuthBridge";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { getDatabase } from "./src/db/database";
import { attachForegroundSync, maybeSync } from "./src/sync/client";
import { ensureBackgroundSync } from "./src/sync/background";
import { ThemeRoot } from "./src/theme/ThemeRoot";

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

  // Spec sync triggers: on startup and on foreground resume (reliable),
  // plus a best-effort periodic background task. All no-op while no backend
  // is configured.
  useEffect(() => {
    void maybeSync();
    void ensureBackgroundSync();
    return attachForegroundSync();
  }, []);

  const app = (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeRoot>
            <RootNavigator />
          </ThemeRoot>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );

  // ClerkProvider throws without a key, and the app must still run offline.
  if (!authConfigured) {
    return app;
  }
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <SyncAuthBridge />
      {app}
    </ClerkProvider>
  );
}
