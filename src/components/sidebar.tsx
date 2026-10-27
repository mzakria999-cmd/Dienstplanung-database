"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { Menu, ShieldCheck, X } from "lucide-react";
import { NAV, type NavRole } from "./nav";
import { useT } from "./i18n-provider";
import { cn } from "@/lib/utils";

export function Sidebar({ role, hasEmployee, company }: { role: NavRole; hasEmployee: boolean; company: string }) {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const items = NAV.filter((n) => n.roles.includes(role) && (hasEmployee || !["/mein-dienstplan", "/angebote", "/verfuegbarkeit", "/meine-mitteilungen"].includes(n.href)));

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
      {items.map((n) => {
        const active = path === n.href || (n.href !== "/dashboard" && path.startsWith(n.href) && !(n.href === "/mitteilungen" && path.startsWith("/mitteilungen/gesendet")));
        const Icon = n.icon === "dot" ? null : (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[n.icon];
        return (
          <div key={n.href}>
            {n.section ? <div className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300/70">{t(n.section)}</div> : null}
            <Link href={n.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-white/10 text-white" : "text-blue-100/80 hover:bg-white/5 hover:text-white")}>
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className={cn("ml-0.5 h-3 w-3 shrink-0 rounded-full", n.color)} />}
              {t(n.key)}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-white">SecurityDienst</div>
        <div className="truncate text-xs text-blue-200">{company}</div>
      </div>
    </div>
  );

  return (
    <>
      <button className="fixed left-3 top-3 z-40 rounded-lg bg-navy-900 p-2 text-white shadow lg:hidden" onClick={() => setOpen(true)} aria-label="Menü öffnen">
        <Menu className="h-5 w-5" />
      </button>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-900 lg:flex">
        {brand}
        {nav}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy-900 shadow-xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button onClick={() => setOpen(false)} className="rounded p-1 text-white" aria-label="Menü schließen">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
