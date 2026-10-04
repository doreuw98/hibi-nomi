import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import en, { type Dict } from "./en";
import id from "./id";
import ja from "./ja";

export type Lang = "en" | "id" | "ja";
export const LANGUAGES: Lang[] = ["en", "id", "ja"];
const STORAGE_KEY = "language";

const DICTS: Record<Lang, Dict> = { en, id, ja };

// Module-level current language so non-React helpers (dates, notifications)
// can read translations. The provider keeps this in sync.
let currentLang: Lang = "en";

export function getLang(): Lang {
  return currentLang;
}

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "id" || v === "ja";
}

type Params = Record<string, string | number>;

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{{${k}}}`));
}

type StringKey = { [K in keyof Dict]: Dict[K] extends string ? K : never }[keyof Dict];
type ArrayKey = { [K in keyof Dict]: Dict[K] extends string[] ? K : never }[keyof Dict];

export function t(key: StringKey, params?: Params): string {
  const v = (DICTS[currentLang][key] ?? en[key]) as string;
  return interpolate(v, params);
}

export function tArray(key: ArrayKey): string[] {
  return (DICTS[currentLang][key] ?? en[key]) as string[];
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: typeof t;
  tArray: typeof tArray;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage
      .getItem<string | null>(STORAGE_KEY, null)
      .then((saved) => {
        if (isLang(saved)) {
          currentLang = saved;
          setLangState(saved);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    currentLang = l;
    setLangState(l);
    await storage.setItem(STORAGE_KEY, l);
  }, []);

  // `lang` in deps forces consumers to re-render with the new dictionary.
  const value = useMemo<Ctx>(() => ({ lang, setLang, t, tArray }), [lang, setLang]);

  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
