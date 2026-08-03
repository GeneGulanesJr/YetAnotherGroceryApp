import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export function ScreenContainer({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      {children}
    </SafeAreaView>
  );
}
