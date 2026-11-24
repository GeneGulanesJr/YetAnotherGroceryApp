const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const KEY = "com.google.mlkit.vision.DEPENDENCIES";

// expo-camera declares this key as barcode_ui, so the app manifest must carry both or the merge fails.
module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    mod.modResults.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    app["meta-data"] = [
      ...(app["meta-data"] ?? []).filter((entry) => entry.$["android:name"] !== KEY),
      { $: { "android:name": KEY, "android:value": "barcode_ui,subject_segment", "tools:replace": "android:value" } },
    ];
    return mod;
  });
