import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppTextInput, Field, ListRow, PrimaryButton, Text } from "../components/ui";
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

  const typed = manualBarcode.trim();
  const valid = isProbablyBarcode(typed);

  const lookupManual = () => {
    if (valid) {
      navigation.navigate("ProductResolve", { barcode: typed });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4" keyboardShouldPersistTaps="handled">
        <Text variant="display">Snap an item</Text>
        <Text tone="secondary" className="mt-2">
          One photo of the item with its price tag. The barcode and the price are read on this
          phone, and you confirm before anything is saved.
        </Text>
        <View className="mt-6">
          <PrimaryButton
            label="Take photo"
            icon="camera-outline"
            onPress={() => navigation.navigate("SnapItem")}
          />
        </View>

        <Text variant="label" tone="secondary" className="mb-1 mt-10">
          Other ways to add
        </Text>
        <ListRow
          icon="scan-outline"
          title="Scan barcode live"
          detail="Then photograph or type the price"
          onPress={() => navigation.navigate("Scanner")}
        />
        <ListRow
          icon="create-outline"
          title="Add product without barcode"
          onPress={() => navigation.navigate("ManualProduct", {})}
          last
        />

        <View className="mt-6">
          <Field
            label="Type a barcode"
            hint={typed !== "" && !valid ? "Enter a valid barcode (6–14 digits)" : undefined}
          >
            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppTextInput
                  value={manualBarcode}
                  onChangeText={setManualBarcode}
                  keyboardType="number-pad"
                  placeholder="e.g. 4800017234567"
                  onSubmitEditing={lookupManual}
                />
              </View>
              <PrimaryButton label="Look up" variant="secondary" disabled={!valid} onPress={lookupManual} />
            </View>
          </Field>
        </View>

        <Text variant="meta" tone="meta" className="mt-2">
          {pending === 0
            ? "No changes waiting to sync"
            : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
