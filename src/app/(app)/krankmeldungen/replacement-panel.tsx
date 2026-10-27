"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, PhoneCall, Send, UserCheck } from "lucide-react";
import { assignReplacementAction, candidatesAction, offerShiftAction } from "@/actions/sick";
import { useAction } from "@/components/use-action";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ShiftChip } from "@/components/common";
import { useToast } from "@/components/ui/toast";

type Data = Extract<Awaited<ReturnType<typeof candidatesAction>>, { ok: true }>["data"];

export function ReplacementPanel({ slotId, canAssign }: { slotId: string; canAssign: boolean }) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const { run, pending } = useAction();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [force, setForce] = useState<{ employeeId: string; message: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const r = await candidatesAction(slotId);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, [slotId]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Card><CardContent className="text-red-700">{error}</CardContent></Card>;
  if (!data) return <Card><CardContent className="text-slate-500">{t("common.loading")}</CardContent></Card>;
  const s = data.slot;
  const eligible = data.candidates.filter((c) => c.eligible);
  const others = data.candidates.filter((c) => !c.eligible);

  const assign = (employeeId: string, f = false) =>
    run(() => assignReplacementAction({ slotId, employeeId, force: f }), {
      onSuccess: load,
      onError: (r) => ((r.data as { needsForce?: boolean })?.needsForce ? setForce({ employeeId, message: r.error }) : toast("error", r.error)),
    });

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-blue-50/60">
        <div>
          <CardTitle className="text-blue-900">{t("repl.title")}</CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <ShiftChip code={s.shiftCode} label={locale === "de" ? s.shiftName : s.shiftNameEn} />
            <b>{new Date(`${s.date}T00:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</b>
            <span>{s.start}–{s.end}</span>
            <span className="text-slate-600">· {s.object}</span>
            {s.original ? <Badge tone="red">{t("repl.sickEmployee")}: {s.original}</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.assigned ? <div className="rounded-lg bg-green-50 p-3 font-semibold text-green-800">✓ {t("repl.assignedTo", { name: s.assigned })}</div> : null}
        {eligible.length === 0 ? <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">{t("repl.none")}</div> : null}
        {eligible.map((c, i) => (
          <div key={c.employeeId} className="rounded-xl border border-green-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">{i + 1}</div>
                <div>
                  <div className="text-base font-bold">{c.name} <span className="text-xs font-normal text-slate-500">{c.personnelNumber}</span></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                    <span>{t("repl.status")}:</span>
                    <Badge tone={c.dayStatus === "FREI" ? "green" : "yellow"}>{t(`day.${c.dayStatus}` as never)}</Badge>
                    {c.offerStatus ? <Badge tone={c.offerStatus === "ACCEPTED" ? "green" : c.offerStatus === "REJECTED" ? "red" : "blue"}>{t(`offer.${c.offerStatus}` as never)}</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-sm">{t("common.phone")}: <a className="font-semibold text-blue-700" href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone || "—"}</a></div>
                  <div className="text-xs text-slate-500">{t("repl.hours", { planned: c.plannedHours, target: c.targetHours, remaining: c.remainingHours })}</div>
                  {c.warnings.length ? <div className="text-xs text-orange-700">⚠ {c.warnings.join("; ")}</div> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="inline-flex h-10 items-center gap-1 rounded-lg bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-700"><PhoneCall className="h-4 w-4" />{t("repl.call")}</a>
                <a href={`mailto:${c.email}?subject=${encodeURIComponent(`Dienstübernahme ${s.date} ${s.shiftName}`)}`} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold"><Mail className="h-4 w-4" />{t("repl.email")}</a>
                <Button variant="primary" loading={pending} disabled={!!s.assigned} onClick={() => run(() => offerShiftAction({ slotId, employeeId: c.employeeId }), { onSuccess: load })}><Send className="h-4 w-4" />{t("repl.offer")}</Button>
                {canAssign ? <Button variant="success" loading={pending} disabled={!!s.assigned} onClick={() => confirm(t("repl.confirmAssign", { name: c.name })) && assign(c.employeeId)}><UserCheck className="h-4 w-4" />{t("repl.assign")}</Button> : null}
              </div>
            </div>
          </div>
        ))}
        {others.length ? (
          <div>
            <button className="text-sm font-semibold text-slate-600" onClick={() => setShowAll((v) => !v)}>{showAll ? "▾" : "▸"} {t("repl.notAvailable", { n: others.length })}</button>
            {showAll ? (
              <div className="mt-2 space-y-1">
                {others.map((c) => (
                  <div key={c.employeeId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span><b>{c.name}</b> · <Badge>{t(`day.${c.dayStatus}` as never)}</Badge> <span className="text-xs text-slate-500">{c.reasons.join("; ")}</span></span>
                    {canAssign && !s.assigned ? <button className="text-xs font-semibold text-blue-700" onClick={() => assign(c.employeeId)}>{t("repl.assign")}</button> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <Modal open={!!force} onClose={() => setForce(null)} title={t("grid.conflictTitle")} footer={<><Button variant="outline" onClick={() => setForce(null)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { const f = force!; setForce(null); assign(f.employeeId, true); }}>{t("grid.saveAnyway")}</Button></>}>
        <p className="text-sm">{force?.message}</p>
      </Modal>
    </Card>
  );
}
