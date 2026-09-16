import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppTextInput, PrimaryButton } from "../components/ui";
import {
  formatFromCameraType,
  isProbablyBarcode,
  SCAN_BARCODE_TYPES,
} from "../utils/barcode";
import type { RootStackParamList } from "../navigation/types";

type ScannerProps = NativeStackScreenProps<RootStackParamList, "Scanner">;

/**
 * Continuous barcode scanner. Locks after the first accepted scan (spec:
 * duplicate-scan handling happens downstream in the trip flow), with a
 * manual-entry fallback for damaged labels.
 */
export function ScannerScreen({ navigation }: ScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const lockRef = useRef(false);

  if (permission === null) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-slate-950 px-6">
        <Text className="text-center text-xl font-semibold text-slate-50">
          Camera access needed
        </Text>
        <Text className="text-center text-slate-300">
          YetAnotherGroceryApp uses the camera only to scan barcodes so you can
          capture prices offline in the store. Nothing is uploaded without your
          confirmation.
        </Text>
        <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-slate-400">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const handleScan = ({ type, data }: { type: string; data: string }) => {
    if (lockRef.current) {
      return;
    }
    const format = formatFromCameraType(type);
    if (format === "unknown" && !isProbablyBarcode(data)) {
      return;
    }
    lockRef.current = true;
    setLocked(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("ProductResolve", { barcode: data, format });
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
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        onBarcodeScanned={locked ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: [...SCAN_BARCODE_TYPES] }}
        enableTorch={torchOn}
      />

      <View className="pointer-events-none absolute inset-x-0 top-24 items-center">
        <View className="h-48 w-72 rounded-2xl border-2 border-teal-300/80" />
        <Text className="mt-4 px-6 text-center text-slate-100">
          Point at a product barcode (EAN / UPC / QR)
        </Text>
      </View>

      {locked ? (
        <Pressable
          onPress={() => {
            lockRef.current = false;
            setLocked(false);
          }}
          className="absolute inset-x-0 bottom-40 items-center"
        >
          <View className="rounded-full bg-teal-600 px-5 py-2.5">
            <Text className="font-semibold text-white">Scanned — tap to scan again</Text>
          </View>
        </Pressable>
      ) : null}

      <View className="absolute inset-x-0 bottom-0 flex-row justify-between gap-3 bg-black/70 px-4 pb-10 pt-4">
        <Pressable
          onPress={() => setTorchOn((on) => !on)}
          className="rounded-xl bg-slate-800 px-4 py-2.5"
        >
          <Text className="font-medium text-slate-100">
            {torchOn ? "🔦 Torch on" : "🔦 Torch off"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setManualEntry((open) => !open)}
          className="rounded-xl bg-slate-800 px-4 py-2.5"
        >
          <Text className="font-medium text-slate-100">Type barcode</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.goBack()}
          className="rounded-xl bg-slate-800 px-4 py-2.5"
        >
          <Text className="font-medium text-slate-100">Close</Text>
        </Pressable>
      </View>

      {manualEntry ? (
        <View className="absolute inset-x-4 bottom-28 rounded-2xl bg-slate-900 p-4">
          <Text className="mb-2 text-sm font-medium text-slate-200">
            Enter the digits printed under the barcode:
          </Text>
          <AppTextInput
            value={manualValue}
            onChangeText={setManualValue}
            keyboardType="number-pad"
            placeholder="e.g. 4800017234567"
            onSubmitEditing={submitManual}
          />
          {manualError !== null ? (
            <Text className="mt-1 text-xs text-rose-400">{manualError}</Text>
          ) : null}
          <View className="mt-3">
            <PrimaryButton label="Look up" onPress={submitManual} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
