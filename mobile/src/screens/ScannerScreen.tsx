import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CameraBar,
  CameraButton,
  CameraGuide,
  CameraPermission,
  useHardwareBack,
} from "../components/camera";
import { AppTextInput, PrimaryButton, Text } from "../components/ui";
import { isProbablyBarcode, rankScannedCodes, SCAN_BARCODE_TYPES } from "../utils/barcode";
import type { RootStackParamList } from "../navigation/types";

type ScannerProps = NativeStackScreenProps<RootStackParamList, "Scanner">;

/**
 * Live barcode scanner (fallback to Snap item). Locks after the first
 * accepted scan (duplicate-scan handling happens downstream in the trip
 * flow), with a typed fallback for damaged labels.
 */
export function ScannerScreen({ navigation }: ScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const lockRef = useRef(false);
  const insets = useSafeAreaInsets();

  useHardwareBack(manualEntry, () => setManualEntry(false));

  if (permission === null) {
    return <View className="flex-1 bg-cam-paper" />;
  }

  if (!permission.granted) {
    return (
      <CameraPermission
        reason="The camera scans barcodes so you can capture prices offline in the store. Nothing is uploaded without your confirmation."
        onRequest={() => void requestPermission()}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  const handleScan = (scan: { type: string; data: string }) => {
    const [code] = rankScannedCodes([scan]);
    if (lockRef.current || code === undefined) {
      return;
    }
    lockRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("ProductResolve", { barcode: code.data, format: code.format });
  };

  const submitManual = () => {
    const value = manualValue.trim();
    if (!isProbablyBarcode(value)) {
      setManualError("Enter a valid barcode (6–14 digits)");
      return;
    }
    setManualError(null);
    navigation.replace("ProductResolve", { barcode: value, format: "unknown" });
  };

  return (
    <View className="flex-1 bg-cam-paper">
      <CameraView
        style={{ flex: 1 }}
        onBarcodeScanned={handleScan}
        barcodeScannerSettings={{ barcodeTypes: [...SCAN_BARCODE_TYPES] }}
        enableTorch={torchOn}
      />
      <CameraGuide text="Point at a product barcode or QR code" frameClassName="h-48 w-72" />

      {manualEntry ? (
        <KeyboardAvoidingView
          behavior="padding"
          style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 120 }}
        >
          <View className="gap-3 rounded-2xl border-2 border-outline bg-card p-4">
            <Text variant="label" tone="secondary">
              Type the digits printed under the barcode
            </Text>
            <AppTextInput
              value={manualValue}
              onChangeText={setManualValue}
              keyboardType="number-pad"
              placeholder="e.g. 4800017234567"
              onSubmitEditing={submitManual}
              autoFocus
            />
            {manualError !== null ? (
              <Text variant="meta" tone="caution">
                {manualError}
              </Text>
            ) : null}
            <PrimaryButton label="Look up" onPress={submitManual} />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <CameraBar>
        <CameraButton icon="close" label="Close" onPress={() => navigation.goBack()} />
        <CameraButton
          icon="keypad-outline"
          label="Type"
          active={manualEntry}
          onPress={() => setManualEntry((open) => !open)}
        />
        <CameraButton
          icon={torchOn ? "flashlight" : "flashlight-outline"}
          label="Torch"
          active={torchOn}
          onPress={() => setTorchOn((on) => !on)}
        />
      </CameraBar>
    </View>
  );
}
