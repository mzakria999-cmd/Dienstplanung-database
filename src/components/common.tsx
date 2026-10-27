import Link from "next/link";
import * as React from "react";
import { cn, SHIFT_STYLE } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="muted mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ShiftChip({ code, label, changed, small, className }: { code: string; label?: string; changed?: boolean; small?: boolean; className?: string }) {
  const s = SHIFT_STYLE[code] ?? SHIFT_STYLE.FREI;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border font-bold", s.bg, s.text, changed ? "border-red-600 ring-1 ring-red-600" : s.border, small ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs", className)}>
      {label ?? code}
      {changed ? <span className="rounded bg-red-600 px-1 text-[9px] font-bold uppercase text-white">Änderung</span> : null}
    </span>
  );
}

export function StatCard({ label, value, hint, tone = "slate", href, icon }: { label: string; value: React.ReactNode; hint?: string; tone?: "slate" | "green" | "yellow" | "orange" | "red" | "blue"; href?: string; icon?: React.ReactNode }) {
  const tones = { slate: "text-slate-900", green: "text-green-700", yellow: "text-yellow-700", orange: "text-orange-700", red: "text-red-700", blue: "text-blue-700" };
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {icon}
      </div>
      <div className={cn("mt-1 text-2xl font-bold", tones[tone])}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Progress({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full", value > max ? "bg-orange-500" : "bg-blue-600")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TelLink({ phone, className }: { phone: string; className?: string }) {
  if (!phone) return <span className="text-slate-400">—</span>;
  return (
    <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className={cn("font-medium text-blue-700 hover:underline", className)}>
      {phone}
    </a>
  );
}
