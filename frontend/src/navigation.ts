import { Platform } from "react-native";

// iOS 26+ gets the native liquid-glass tab bar. Everything else (older iOS,
// Android, web) falls back to the classic JS Tabs bar.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
