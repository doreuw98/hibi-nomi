import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import {
  ThemeContext,
  defaultScheme,
  themes,
  type ColorScheme,
  type ThemeContextValue,
  type ThemePreference,
} from "@/src/theme";

const STORAGE_KEY = "theme";

function isPreference(v: unknown): v is ThemePreference {
  return v === "system" || v === "light" || v === "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage
      .getItem<string | null>(STORAGE_KEY, null)
      .then((saved) => {
        if (isPreference(saved)) setPreferenceState(saved);
      })
      .finally(() => setReady(true));
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPreferenceState(p);
    // Keep native UI (pickers, switches, keyboard) in sync where supported.
    Appearance.setColorScheme?.(p === "system" ? "unspecified" : p);
    await storage.setItem(STORAGE_KEY, p);
  }, []);

  const scheme: ColorScheme =
    preference === "system" ? (system === "dark" ? "dark" : defaultScheme) : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: themes[scheme], preference, setPreference }),
    [scheme, preference, setPreference],
  );

  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
