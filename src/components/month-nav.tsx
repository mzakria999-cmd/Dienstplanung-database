"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "./i18n-provider";

export function MonthNav({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const locale = useLocale();
  const go = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y--;
    }
    if (m > 12) {
      m = 1;
      y++;
    }
    const p = new URLSearchParams(sp.toString());
    p.set("year", String(y));
    p.set("month", String(m));
    router.push(`${path}?${p.toString()}`);
  };
  const label = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
      <button onClick={() => go(-1)} className="p-2 hover:bg-slate-50" aria-label="Vorheriger Monat">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[140px] px-2 text-center text-sm font-semibold capitalize">{label}</span>
      <button onClick={() => go(1)} className="p-2 hover:bg-slate-50" aria-label="Nächster Monat">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function QuerySelect({ name, value, options, className }: { name: string; value: string; options: Array<{ value: string; label: string }>; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <select
      className={className ?? "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"}
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        if (e.target.value) p.set(name, e.target.value);
        else p.delete(name);
        router.push(`${path}?${p.toString()}`);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
