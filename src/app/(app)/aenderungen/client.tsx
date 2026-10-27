"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { decideChangeRequestAction } from "@/actions/schedule";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

export function ChangeFilters() {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.push(`${path}?${p.toString()}`);
  };
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); set("q", q); }}>
      <Input placeholder={t("changes.search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <Select className="w-44" value={sp.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}>
        <option value="">{t("changes.allTypes")}</option>
        {["CREATED", "MODIFIED", "DELETED", "SICK", "REPLACEMENT", "ABSENT", "VACATION", "ATTENDANCE", "RESTORED"].map((x) => <option key={x} value={x}>{t(`changeType.${x}` as never)}</option>)}
      </Select>
      <Select className="w-36" value={sp.get("shift") ?? ""} onChange={(e) => set("shift", e.target.value)}>
        <option value="">{t("changes.allShifts")}</option>
        {["F", "S", "N"].map((c) => <option key={c} value={c}>{t(`shift.${c}` as never)}</option>)}
      </Select>
      <Input type="date" className="w-40" value={sp.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} aria-label={t("common.from")} />
      <Input type="date" className="w-40" value={sp.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} aria-label={t("common.to")} />
      <Button type="submit" variant="outline">{t("common.search")}</Button>
    </form>
  );
}

export function RequestActions({ id }: { id: string }) {
  const t = useT();
  const { run, pending } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Input placeholder={t("changes.note")} value={note} onChange={(e) => setNote(e.target.value)} className="h-8 flex-1" />
      <Button size="sm" variant="success" loading={pending} onClick={() => run(() => decideChangeRequestAction({ id, approve: true, note }))}>{t("changes.approve")}</Button>
      <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => decideChangeRequestAction({ id, approve: false, note }))}>{t("changes.reject")}</Button>
    </div>
  );
}
