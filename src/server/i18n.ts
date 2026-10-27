import "server-only";
import { cookies } from "next/headers";
import { translate, type Locale, type TKey } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("locale")?.value;
  return c === "en" ? "en" : "de";
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: TKey, params?: Record<string, string | number>) => translate(locale, key, params) };
}
