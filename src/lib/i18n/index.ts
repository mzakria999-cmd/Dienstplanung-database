import { de } from "./de";
import { en } from "./en";

export type Locale = "de" | "en";
export type TKey = keyof typeof de;
export type Dict = Record<TKey, string>;

export const dictionaries: Record<Locale, Dict> = { de, en };

export function translate(locale: Locale, key: TKey, params?: Record<string, string | number>): string {
  let s: string = dictionaries[locale][key] ?? de[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
