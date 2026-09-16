import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppTextInput, PrimaryButton } from "../components/ui";
import { ScreenContainer } from "../components/ScreenContainer";
import { getDatabase } from "../db/database";
import { getPendingMutationCount } from "../db/repositories/meta";
import type { RootStackParamList } from "../navigation/types";
import { isProbablyBarcode } from "../utils/barcode";

type CaptureNavigation = NativeStackNavigationProp<RootStackParamList>;

export function CaptureScreen({ navigation }: { navigation: CaptureNavigation }) {
  const [manualBarcode, setManualBarcode] = useState("");
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(
    () => setPending(getPendingMutationCount(getDatabase())),
    [],
  );
  useFocusEffect(refreshPending);

  const manualError =
    manualBarcode.trim() !== "" && !isProbablyBarcode(manualBarcode.trim())
      ? "Enter a valid barcode (6–14 digits)"
      : null;

  const lookupManual = () => {
    if (!isProbablyBarcode(manualBarcode.trim())) {
      return;
    }
    navigation.navigate("ProductResolve", { barcode: manualBarcode.trim() });
  };

  return (
    <ScreenContainer>
      <View className="flex-1 justify-between px-6 py-8">
        <View>
          <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Capture
          </Text>
          <Text className="mt-2 text-slate-600 dark:text-slate-300">
            Scan shelf prices as you shop. Everything is stored offline first;
            OCR receipt capture arrives in the next milestone.
          </Text>
        </View>

        <View className="gap-3">
          <PrimaryButton
            label="Scan barcode"
            onPress={() => navigation.navigate("Scanner")}
          />
          <PrimaryButton
            label="Add product without barcode"
            variant="secondary"
            onPress={() => navigation.navigate("ManualProduct", {})}
          />
          <AppTextInput
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="number-pad"
            placeholder="…or type a barcode"
            onSubmitEditing={lookupManual}
          />
          {manualError !== null ? (
            <Text className="text-xs text-rose-600 dark:text-rose-400">{manualError}</Text>
          ) : null}
        </View>

        <Text className="text-center text-xs text-slate-400">
          {pending} change{pending === 1 ? "" : "s"} waiting to sync
        </Text>
      </View>
    </ScreenContainer>
  );
}
