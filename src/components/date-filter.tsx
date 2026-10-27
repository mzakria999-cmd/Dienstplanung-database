"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "./i18n-provider";
import { Button } from "./ui/button";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function DateFilter({ value, to, single }: { value: string; to?: string; single?: boolean }) {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    router.push(`${path}?${p.toString()}`);
  };
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  if (single)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => set({ date: iso(today) })}>{t("common.today")}</Button>
        <Button size="sm" variant="outline" onClick={() => set({ date: iso(tomorrow) })}>{t("common.tomorrow")}</Button>
        <input type="date" value={value} onChange={(e) => e.target.value && set({ date: e.target.value })} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" />
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => set({ from: iso(today), to: iso(today) })}>{t("common.today")}</Button>
      <Button size="sm" variant="outline" onClick={() => set({ from: iso(tomorrow), to: iso(tomorrow) })}>{t("common.tomorrow")}</Button>
      <Button size="sm" variant="outline" onClick={() => set({ from: iso(today), to: iso(new Date(Date.now() + 6 * 86_400_000)) })}>{t("common.next7")}</Button>
      <input type="date" value={value} onChange={(e) => e.target.value && set({ from: e.target.value })} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" aria-label={t("common.from")} />
      <span className="text-slate-400">–</span>
      <input type="date" value={to} onChange={(e) => e.target.value && set({ to: e.target.value })} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" aria-label={t("common.to")} />
    </div>
  );
}
