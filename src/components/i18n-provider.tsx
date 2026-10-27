"use client";
import * as React from "react";
import { translate, type Locale, type TKey } from "@/lib/i18n";

const Ctx = React.createContext<Locale>("de");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return React.useContext(Ctx);
}

export function useT() {
  const locale = React.useContext(Ctx);
  return React.useCallback((key: TKey, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
}
