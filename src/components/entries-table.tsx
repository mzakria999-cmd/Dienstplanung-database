"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Mail, Phone, UserX } from "lucide-react";
import type { DayEntry } from "@/server/queries";
import { useLocale, useT } from "./i18n-provider";
import { useAction } from "./use-action";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/form";
import { Modal } from "./ui/modal";
import { Table, Td, Th, Empty } from "./ui/table";
import { ShiftChip, TelLink } from "./common";
import { confirmAttendanceAction } from "@/actions/schedule";

export function EntriesTable({ entries, canConfirm, showDate }: { entries: DayEntry[]; canConfirm: boolean; showDate?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { run, pending } = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [actual, setActual] = useState<DayEntry | null>(null);
  const [as, setAs] = useState("");
  const [ae, setAe] = useState("");
  const selectable = entries.filter((e) => e.employee && e.status === "PLANNED");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  if (entries.length === 0) return <Empty>{t("common.noEntries")}</Empty>;
  const att = (e: DayEntry) => {
    if (e.status !== "PLANNED") return <Badge tone={e.status === "SICK" ? "red" : e.status === "VACATION" ? "blue" : "slate"}>{t(`status.${e.status}` as never)}</Badge>;
    if (e.running) return <Badge tone="green">● {t("attendance.running")}</Badge>;
    return <Badge tone={e.attendance === "CONFIRMED" ? "green" : e.attendance === "NO_SHOW" ? "red" : "slate"}>{t(`attendance.${e.attendance}` as never)}{e.actualStart ? ` ${e.actualStart}–${e.actualEnd}` : ""}</Badge>;
  };
  return (
    <div className="space-y-2">
      {canConfirm && selectable.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(selected.length === selectable.length ? [] : selectable.map((e) => e.id))}>{t("common.selectAll")}</Button>
          <Button size="sm" variant="success" disabled={!selected.length} loading={pending} onClick={() => run(() => confirmAttendanceAction({ ids: selected, status: "CONFIRMED" }), { onSuccess: () => setSelected([]) })}><CheckCircle2 className="h-4 w-4" />{t("attendance.confirmSelected", { n: selected.length })}</Button>
          <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => run(() => confirmAttendanceAction({ ids: selected, status: "NO_SHOW" }), { onSuccess: () => setSelected([]) })}><UserX className="h-4 w-4" />{t("attendance.noShow")}</Button>
        </div>
      ) : null}
      <Table>
        <thead>
          <tr>
            {canConfirm ? <Th className="w-8" /> : null}
            {showDate ? <Th>{t("common.date")}</Th> : null}
            <Th>{t("grid.shift")}</Th>
            <Th>{t("grid.employee")}</Th>
            <Th>{t("common.phone")}</Th>
            <Th>{t("common.time")}</Th>
            <Th>{t("grid.object")}</Th>
            <Th>{t("attendance.title")}</Th>
            {canConfirm ? <Th /> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className={e.isChanged ? "bg-red-50/40" : ""}>
              {canConfirm ? <Td>{e.employee && e.status === "PLANNED" ? <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} aria-label="auswählen" /> : null}</Td> : null}
              {showDate ? <Td className="whitespace-nowrap">{new Date(`${e.date}T00:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" })}</Td> : null}
              <Td><ShiftChip code={e.code} changed={e.isChanged} small /></Td>
              <Td>
                {e.employee ? (
                  <div>
                    <div className="font-semibold">{e.employee.name}</div>
                    <div className="text-xs text-slate-500">{e.employee.pnr}{e.replacesName ? ` · ${t("dash.insteadOf")} ${e.replacesName}` : ""}</div>
                  </div>
                ) : (
                  <Link href={`/krankmeldungen?slot=${e.id}`} className="font-semibold text-orange-600">{t("grid.unassigned")} → {t("dash.findReplacement")}</Link>
                )}
              </Td>
              <Td>{e.employee ? <div className="flex items-center gap-2"><TelLink phone={e.employee.phone} />{e.employee.phone ? <a href={`tel:${e.employee.phone.replace(/[^+\d]/g, "")}`} className="rounded bg-green-600 p-1 text-white" aria-label="Anrufen"><Phone className="h-3 w-3" /></a> : null}{e.employee.email ? <a href={`mailto:${e.employee.email}`} className="rounded bg-slate-200 p-1" aria-label="E-Mail"><Mail className="h-3 w-3" /></a> : null}</div> : "—"}</Td>
              <Td className="whitespace-nowrap">{e.start}–{e.end}</Td>
              <Td>{e.object}</Td>
              <Td>{att(e)}</Td>
              {canConfirm ? <Td>{e.employee && e.status === "PLANNED" ? <button className="text-xs font-semibold text-blue-700" onClick={() => { setActual(e); setAs(e.actualStart ?? e.start); setAe(e.actualEnd ?? e.end); }}>{t("attendance.actualTimes")}</button> : null}</Td> : null}
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal
        open={!!actual}
        onClose={() => setActual(null)}
        title={t("attendance.actualTimes")}
        footer={<Button loading={pending} onClick={() => run(() => confirmAttendanceAction({ ids: [actual!.id], status: "CONFIRMED", actualStart: as, actualEnd: ae }), { onSuccess: () => setActual(null) })}>{t("attendance.confirm")}</Button>}
      >
        <p className="mb-3 text-sm">{actual?.employee?.name} · {actual?.start}–{actual?.end}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input type="time" value={as} onChange={(e) => setAs(e.target.value)} aria-label={t("common.start")} />
          <Input type="time" value={ae} onChange={(e) => setAe(e.target.value)} aria-label={t("common.end")} />
        </div>
      </Modal>
    </div>
  );
}
