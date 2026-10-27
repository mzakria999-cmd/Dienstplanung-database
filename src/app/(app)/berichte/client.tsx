"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Send, XCircle, FileText, Archive, RotateCcw } from "lucide-react";
import { archiveMonthAction, publishOnlyAction, retryBatchAction, retryEmailAction, sendScheduleAction } from "@/actions/dispatch";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, Td, Th } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DispatchResult } from "@/server/dispatch";

type Target = "ALL" | "F" | "S" | "N" | "SELECTED";

export function DispatchPanel(props: {
  year: number;
  month: number;
  monthLabel: string;
  plan: { status: string; version: number; publishedAt: string | null; archived: boolean };
  warnings: Array<{ level: "error" | "warning" | "info"; text: string }>;
  recipients: { ALL: number; F: number; S: number; N: number };
  drafts: number;
  employees: Array<{ id: string; name: string; pnr: string; hasEmail: boolean }>;
  mailProvider: string;
}) {
  const t = useT();
  const { run, pending } = useAction();
  const [target, setTarget] = useState<Target | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [selOpen, setSelOpen] = useState(false);
  const [q, setQ] = useState("");
  const blocked = props.drafts > 0 || props.plan.archived;
  const count = target === "SELECTED" ? selected.length : target ? props.recipients[target] : 0;
  const send = () => target && run(() => sendScheduleAction({ year: props.year, month: props.month, target, employeeIds: selected }), { onSuccess: (r) => { setResult(r); setTarget(null); }, success: t("dispatch.done") });

  const btn = (tg: Target, label: string, cls: string, n: number) => (
    <button disabled={blocked || pending} onClick={() => (tg === "SELECTED" ? setSelOpen(true) : setTarget(tg))} className={cn("flex items-center justify-between rounded-xl px-4 py-4 text-left font-bold shadow-sm transition hover:shadow-md disabled:opacity-50", cls)}>
      <span>{label}</span>
      <span className="rounded-full bg-white/30 px-2 py-0.5 text-sm">{n}</span>
    </button>
  );

  return (
    <Card className="border-2 border-navy-700">
      <CardHeader className="bg-navy-900 text-white">
        <CardTitle className="text-white">{t("dispatch.title")}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge tone={props.plan.status === "PUBLISHED" ? "green" : "yellow"}>{t(`plan.status.${props.plan.status}` as never)}{props.plan.version ? ` · v${props.plan.version}` : ""}</Badge>
          {props.plan.publishedAt ? <span className="text-xs text-blue-200">{t("dispatch.lastPublished")}: {props.plan.publishedAt}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-slate-600">{t("dispatch.explain", { month: props.monthLabel })}</p>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-slate-600">{t("dispatch.check")}</div>
          {props.warnings.length === 0 ? <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" />{t("dispatch.allGood")}</div> : null}
          {props.warnings.map((w, i) => (
            <div key={i} className={cn("flex items-start gap-2 rounded-lg p-3 text-sm", w.level === "error" ? "bg-red-50 text-red-800" : w.level === "warning" ? "bg-yellow-50 text-yellow-900" : "bg-slate-50 text-slate-700")}>
              {w.level === "error" ? <XCircle className="h-5 w-5 shrink-0" /> : w.level === "warning" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <Info className="h-5 w-5 shrink-0" />}
              {w.text}
            </div>
          ))}
          {props.drafts > 0 ? <Link href={`/muster?year=${props.year}&month=${props.month}`} className="text-sm font-semibold text-blue-700">{t("dispatch.toApproval")} →</Link> : null}
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="font-semibold text-blue-700" href={`/dienstplanung?year=${props.year}&month=${props.month}`}>{t("dispatch.checkPlan")} →</Link>
            <span className="text-slate-500">{t("dispatch.mailProvider")}: <b>{props.mailProvider === "none" ? t("dispatch.notConfigured") : props.mailProvider.toUpperCase()}</b></span>
          </div>
        </div>

        <button disabled={blocked || pending} onClick={() => setTarget("ALL")} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-6 text-lg font-extrabold uppercase tracking-wide text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-50 sm:text-xl">
          <Send className="h-7 w-7" />{t("dispatch.sendAll")}
        </button>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {btn("F", `🟢 ${t("dispatch.sendF")}`, "bg-shift-f text-white", props.recipients.F)}
          {btn("S", `🟡 ${t("dispatch.sendS")}`, "bg-shift-s text-slate-900", props.recipients.S)}
          {btn("N", `🟠 ${t("dispatch.sendN")}`, "bg-shift-n text-white", props.recipients.N)}
          {btn("SELECTED", `👤 ${t("dispatch.sendSelected")}`, "bg-slate-700 text-white", selected.length)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={blocked} loading={pending} onClick={() => run(() => publishOnlyAction({ year: props.year, month: props.month }))}>{t("dispatch.publishOnly")}</Button>
          <span className="text-xs text-slate-500">{t("dispatch.noAutoSend")}</span>
        </div>

        {result ? (
          <div className="space-y-2 rounded-xl border p-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">v{result.version}</Badge>
              <Badge tone="green">{t("dispatch.sentCount", { n: result.sent })}</Badge>
              <Badge tone={result.failed ? "red" : "green"}>{t("dispatch.failedCount", { n: result.failed })}</Badge>
              {result.failed ? <BatchRetry id={result.batchId} /> : null}
            </div>
            <div className="max-h-80 overflow-auto">
              <Table>
                <thead><tr><Th>{t("grid.employee")}</Th><Th>{t("emp.email")}</Th><Th>{t("dispatch.attachment")}</Th><Th>{t("emp.statusLabel")}</Th></tr></thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.employeeId}>
                      <Td className="font-semibold">{r.name}</Td>
                      <Td className="text-xs">{r.email || "—"}</Td>
                      <Td className="text-xs">{r.attachment ?? "—"}</Td>
                      <Td>{r.status === "SENT" ? <Badge tone="green">✓ {t("dispatch.ok")}</Badge> : <span><Badge tone="red">{t(`dispatch.${r.status}` as never)}</Badge> <span className="text-xs text-red-700">{r.error}</span></span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>

      <Modal open={!!target} onClose={() => setTarget(null)} title={t("dispatch.confirmTitle")} footer={<><Button variant="outline" onClick={() => setTarget(null)}>{t("common.cancel")}</Button><Button variant="primary" loading={pending} disabled={count === 0} onClick={send}><Send className="h-4 w-4" />{t("dispatch.confirmSend")}</Button></>}>
        <p className="text-base font-semibold">{t("dispatch.confirmText", { n: count, month: props.monthLabel })}</p>
        <p className="mt-2 text-sm text-slate-600">{t("dispatch.confirmHint")}</p>
        {props.warnings.some((w) => w.level !== "info") ? <p className="mt-2 text-sm font-semibold text-orange-700">{t("dispatch.warningsExist")}</p> : null}
      </Modal>

      <Modal open={selOpen} onClose={() => setSelOpen(false)} title={t("dispatch.sendSelected")} footer={<><Button variant="outline" onClick={() => setSelOpen(false)}>{t("common.cancel")}</Button><Button disabled={!selected.length} onClick={() => { setSelOpen(false); setTarget("SELECTED"); }}>{t("common.next")} ({selected.length})</Button></>}>
        <Input placeholder={t("grid.search")} value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
        <Button size="sm" variant="outline" className="mb-2" onClick={() => setSelected(selected.length ? [] : props.employees.map((e) => e.id))}>{t("common.selectAll")}</Button>
        <div className="max-h-80 space-y-1 overflow-auto">
          {props.employees.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase())).map((e) => (
            <Checkbox key={e.id} label={<span>{e.name} <span className="text-xs text-slate-500">{e.pnr}{e.hasEmail ? "" : " · ohne E-Mail"}</span></span>} checked={selected.includes(e.id)} onChange={() => setSelected((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]))} />
          ))}
        </div>
      </Modal>
    </Card>
  );
}

export function PdfPreview({ year, month, employees }: { year: number; month: number; employees: Array<{ id: string; name: string }> }) {
  const t = useT();
  const [id, setId] = useState(employees[0]?.id ?? "");
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={id} onChange={(e) => setId(e.target.value)} className="max-w-sm">{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
      <a className={buttonVariants({ variant: "outline" })} target="_blank" href={`/api/pdf/schedule?year=${year}&month=${month}&employeeId=${id}`}><FileText className="h-4 w-4" />{t("reports.openPdf")}</a>
      <a className={buttonVariants({ variant: "ghost" })} href={`/api/pdf/schedule?year=${year}&month=${month}&employeeId=${id}&download=1`}>{t("common.download")}</a>
    </div>
  );
}

export function EmailRetry({ id }: { id: string }) {
  const t = useT();
  const { run, pending } = useAction();
  return <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => retryEmailAction(id), { success: t("reports.retried") })}><RotateCcw className="h-3 w-3" />{t("reports.retry")}</Button>;
}

export function BatchRetry({ id }: { id: string }) {
  const t = useT();
  const { run, pending } = useAction();
  return <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => retryBatchAction(id), { onSuccess: (r) => alert(t("reports.retryResult", { n: r.retried, ok: r.sent })) })}><RotateCcw className="h-3 w-3" />{t("reports.retryFailed")}</Button>;
}

export function ArchiveButton({ year, month, archived }: { year: number; month: number; archived: boolean }) {
  const t = useT();
  const { run, pending } = useAction();
  return <Button size="sm" variant="outline" loading={pending} onClick={() => confirm(archived ? t("reports.confirmUnarchive") : t("reports.confirmArchive")) && run(() => archiveMonthAction({ year, month, archived: !archived }))}><Archive className="h-4 w-4" />{archived ? t("reports.unarchive") : t("reports.archive")}</Button>;
}
