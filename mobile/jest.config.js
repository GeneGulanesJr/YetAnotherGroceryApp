// Mirrors jest-expo's transformIgnorePatterns with `uuid` added (ESM-only
// package that babel-jest must transpile; Metro handles it natively).
module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/", "/e2e/"],
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|uuid))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
};
