"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/actions/auth";
import { useLocale } from "./i18n-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitch({ dark }: { dark?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (l: "de" | "en") => start(async () => {
    await setLocaleAction(l);
    router.refresh();
  });
  return (
    <div className={cn("inline-flex rounded-lg border p-0.5 text-xs font-bold", dark ? "border-white/20" : "border-slate-300", pending && "opacity-60")} role="group" aria-label="Sprache / Language">
      {(["de", "en"] as const).map((l) => (
        <button key={l} onClick={() => set(l)} className={cn("rounded-md px-2 py-1 uppercase", locale === l ? (dark ? "bg-white text-navy-900" : "bg-navy-800 text-white") : dark ? "text-white/80" : "text-slate-600")} aria-pressed={locale === l}>
          {l}
        </button>
      ))}
    </div>
  );
}
