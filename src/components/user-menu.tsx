"use client";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { useT } from "./i18n-provider";
import { initials } from "@/lib/utils";

export function UserMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const t = useT();
  const [first, ...rest] = name.split(" ");
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-semibold leading-tight">{name}</div>
        <div className="text-xs text-slate-500">{roleLabel}</div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">{initials(first ?? "", rest.join(" ") || "")}</div>
      <form action={logoutAction}>
        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title={t("nav.logout")} aria-label={t("nav.logout")}>
          <LogOut className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
