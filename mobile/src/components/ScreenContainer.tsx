import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTokens } from "../theme/tokens";

/** Parchment page; the navigator header owns the top inset. */
export function ScreenContainer({ children }: PropsWithChildren) {
  const t = useTokens();
  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.paper }}>
      {children}
    </SafeAreaView>
  );
}
