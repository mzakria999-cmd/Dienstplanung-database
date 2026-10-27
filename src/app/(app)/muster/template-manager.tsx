"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Sparkles, Trash2, XCircle } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { useAction } from "@/components/use-action";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Empty, Table, Td, Th } from "@/components/ui/table";
import { ShiftChip } from "@/components/common";
import { approveAction, deleteTemplateAction, discardAction, generateAction, saveTemplateAction } from "@/actions/templates";
import type { GenerationReport } from "@/server/generator";
import { cn, SHIFT_STYLE } from "@/lib/utils";

type TType = "DAILY" | "WEEKLY" | "MONTHLY" | "ROTATION";
interface Tpl {
  id?: string;
  name: string;
  type: TType;
  description: string;
  objectId: string | null;
  skipHolidays: boolean;
  rotationPattern: string[];
  rotationStart: string | null;
  items: Array<{ dayKey: number; shiftTypeId: string; objectId: string; requiredCount: number }>;
  members: Array<{ employeeId: string; offset: number }>;
}
type Obj = { id: string; name: string; req: { F: number; S: number; N: number } };

export function TemplateManager(props: { year: number; month: number; planStatus: string; drafts: number; report: GenerationReport | null; templates: Tpl[]; shiftTypes: Array<{ id: string; code: string; label: string }>; objects: Obj[]; employees: Array<{ id: string; name: string }> }) {
  const t = useT();
  const { run, pending } = useAction();
  const [edit, setEdit] = useState<Tpl | null>(null);
  const [templateId, setTemplateId] = useState(props.templates[0]?.id ?? "");
  const [report, setReport] = useState<GenerationReport | null>(props.report);
  const monthLabel = new Date(Date.UTC(props.year, props.month - 1, 1)).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" />{t("tpl.generateTitle")} – {monthLabel}</CardTitle>
          <Badge tone={props.planStatus === "PUBLISHED" ? "green" : props.planStatus === "PENDING_APPROVAL" ? "yellow" : "slate"}>{t(`plan.status.${props.planStatus}` as never)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((n) => <li key={n}>{n}. {t(`tpl.step${n}` as never)}</li>)}
          </ol>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("tpl.select")} className="min-w-[240px]">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {props.templates.map((x) => <option key={x.id} value={x.id}>{x.name} ({t(`tpl.type.${x.type}` as never)})</option>)}
              </Select>
            </Field>
            <Button size="lg" variant="primary" disabled={!templateId || props.planStatus === "PUBLISHED"} loading={pending} onClick={() => run(() => generateAction({ templateId, year: props.year, month: props.month }), { onSuccess: setReport, success: t("tpl.generated") })}>
              <Sparkles className="h-5 w-5" />{t("tpl.generateButton")}
            </Button>
          </div>
          {props.planStatus === "PUBLISHED" ? <p className="text-sm text-slate-600">{t("tpl.alreadyPublished")}</p> : null}
          {props.drafts > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <div className="flex-1 text-sm"><b>{t("tpl.pendingApproval", { n: props.drafts })}</b><br />{t("tpl.reviewHint")}</div>
              <Link href={`/dienstplanung?year=${props.year}&month=${props.month}`} className={buttonVariants({ variant: "outline" })}>{t("tpl.review")}</Link>
              <Button variant="success" loading={pending} onClick={() => run(() => approveAction({ year: props.year, month: props.month }))}><CheckCircle2 className="h-4 w-4" />{t("tpl.approve")}</Button>
              <Button variant="danger" loading={pending} onClick={() => confirm(t("tpl.confirmDiscard")) && run(() => discardAction({ year: props.year, month: props.month }), { onSuccess: () => setReport(null) })}><XCircle className="h-4 w-4" />{t("tpl.discard")}</Button>
            </div>
          ) : null}
          {report ? <ReportView report={report} /> : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("tpl.list")}</h2>
        <Button onClick={() => setEdit({ name: "", type: "DAILY", description: "", objectId: props.objects[0]?.id ?? null, skipHolidays: false, rotationPattern: ["F", "F", "S", "S", "N", "N", "FREI", "FREI"], rotationStart: `${props.year}-${String(props.month).padStart(2, "0")}-01`, items: [], members: [] })}><Plus className="h-4 w-4" />{t("tpl.new")}</Button>
      </div>
      {props.templates.length === 0 ? <Empty>{t("tpl.empty")}</Empty> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.templates.map((x) => {
          const sums = { F: 0, S: 0, N: 0 } as Record<string, number>;
          for (const i of x.items) sums[props.shiftTypes.find((s) => s.id === i.shiftTypeId)?.code ?? "F"] += i.requiredCount;
          return (
            <Card key={x.id}>
              <CardHeader>
                <div>
                  <CardTitle>{x.name}</CardTitle>
                  <div className="text-xs text-slate-500">{t(`tpl.type.${x.type}` as never)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(x)} aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteTemplateAction(x.id!))} aria-label={t("common.delete")}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {x.description ? <p className="text-slate-600">{x.description}</p> : null}
                {x.type === "ROTATION" ? (
                  <div className="flex flex-wrap gap-1">{x.rotationPattern.map((c, i) => <ShiftChip key={i} code={c} small />)} <span className="text-xs text-slate-500">· {x.members.length} {t("dash.employees")}</span></div>
                ) : null}
                {x.items.length ? (
                  <div className="flex gap-2">{(["F", "S", "N"] as const).map((c) => <ShiftChip key={c} code={c} label={`${c}: ${sums[c]}`} small />)} <span className="text-xs text-slate-500">{t("tpl.slotsTotal")}</span></div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {edit ? <TemplateEditor tpl={edit} onClose={() => setEdit(null)} shiftTypes={props.shiftTypes} objects={props.objects} employees={props.employees} /> : null}
    </div>
  );
}

function ReportView({ report }: { report: GenerationReport }) {
  const t = useT();
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge tone="blue">{report.templateName}</Badge>
        <Badge tone="green">{t("tpl.filled", { n: report.filled, total: report.required })}</Badge>
        <Badge tone={report.unfilled.length ? "red" : "green"}>{t("tpl.unfilled", { n: report.unfilled.reduce((a, u) => a + u.missing, 0) })}</Badge>
      </div>
      {report.unfilled.length ? (
        <div>
          <div className="mb-1 text-sm font-semibold text-red-700">{t("tpl.unfilledList")}</div>
          <div className="max-h-56 overflow-auto rounded-lg border border-red-200">
            <Table>
              <thead><tr><Th>{t("common.date")}</Th><Th>{t("grid.shift")}</Th><Th>{t("grid.object")}</Th><Th>{t("tpl.missing")}</Th><Th>{t("tpl.reasons")}</Th></tr></thead>
              <tbody>
                {report.unfilled.map((u, i) => <tr key={i} className="bg-red-50/50"><Td>{u.date.split("-").reverse().join(".")}</Td><Td><ShiftChip code={u.shift} small /></Td><Td>{u.object}</Td><Td className="font-bold text-red-700">{u.missing}</Td><Td className="text-xs text-slate-600">{u.reasons.join(", ")}</Td></tr>)}
              </tbody>
            </Table>
          </div>
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">{t("tpl.hoursPerEmployee")}</summary>
        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {report.hours.map((h) => <div key={h.employeeId} className={cn("flex justify-between rounded border px-2 py-1", h.planned > h.target ? "border-orange-300 bg-orange-50" : h.planned < h.target * 0.9 ? "border-yellow-300 bg-yellow-50" : "border-slate-200")}><span>{h.name}</span><b>{h.planned} / {h.target} h</b></div>)}
        </div>
      </details>
    </div>
  );
}

function TemplateEditor({ tpl, onClose, shiftTypes, objects, employees }: { tpl: Tpl; onClose: () => void; shiftTypes: Array<{ id: string; code: string; label: string }>; objects: Obj[]; employees: Array<{ id: string; name: string }> }) {
  const t = useT();
  const { run, pending } = useAction();
  const [x, setX] = useState<Tpl>(tpl);
  const [objIds, setObjIds] = useState<string[]>(() => (tpl.items.length ? [...new Set(tpl.items.map((i) => i.objectId))] : objects.map((o) => o.id)));
  const counts = new Map(x.items.map((i) => [`${i.objectId}|${i.shiftTypeId}|${i.dayKey}`, i.requiredCount]));
  const keys = x.type === "WEEKLY" ? [1, 2, 3, 4, 5, 6, 7] : x.type === "MONTHLY" ? Array.from({ length: 31 }, (_, i) => i + 1) : [0];
  const dayLabel = (k: number) => (x.type === "WEEKLY" ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][k - 1] : x.type === "MONTHLY" ? String(k) : t("tpl.everyDay"));
  const setCount = (objectId: string, shiftTypeId: string, dayKey: number, n: number) =>
    setX((p) => ({ ...p, items: [...p.items.filter((i) => !(i.objectId === objectId && i.shiftTypeId === shiftTypeId && i.dayKey === dayKey)), ...(n > 0 ? [{ objectId, shiftTypeId, dayKey, requiredCount: n }] : [])] }));
  const prefill = () => {
    const items: Tpl["items"] = [];
    for (const o of objects.filter((o) => objIds.includes(o.id))) for (const s of shiftTypes) for (const k of keys) {
      const n = o.req[s.code as "F"] ?? 0;
      if (n > 0) items.push({ objectId: o.id, shiftTypeId: s.id, dayKey: k, requiredCount: n });
    }
    setX((p) => ({ ...p, items }));
  };
  const changeType = (type: TType) => setX((p) => ({ ...p, type, items: type === p.type ? p.items : p.items.filter(() => false) }));

  return (
    <Modal open wide onClose={onClose} title={tpl.id ? t("tpl.edit") : t("tpl.new")} footer={<><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button><Button loading={pending} onClick={() => run(() => saveTemplateAction(x), { onSuccess: onClose })}>{t("common.save")}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("tpl.name")}><Input value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} placeholder="Standard 2-2-1" /></Field>
          <Field label={t("tpl.typeLabel")}>
            <Select value={x.type} onChange={(e) => changeType(e.target.value as TType)}>
              {(["DAILY", "WEEKLY", "MONTHLY", "ROTATION"] as const).map((ty) => <option key={ty} value={ty}>{t(`tpl.type.${ty}` as never)}</option>)}
            </Select>
          </Field>
          <div className="flex items-end"><Checkbox label={t("tpl.skipHolidays")} checked={x.skipHolidays} onChange={(e) => setX({ ...x, skipHolidays: e.target.checked })} /></div>
        </div>
        <Field label={t("tpl.description")}><Textarea className="min-h-[60px]" value={x.description} onChange={(e) => setX({ ...x, description: e.target.value })} /></Field>

        {x.type === "ROTATION" ? (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-600">{t("tpl.rotationHelp")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("grid.object")}><Select value={x.objectId ?? ""} onChange={(e) => setX({ ...x, objectId: e.target.value })}>{objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
              <Field label={t("tpl.rotationStart")}><Input type="date" value={x.rotationStart ?? ""} onChange={(e) => setX({ ...x, rotationStart: e.target.value })} /></Field>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("tpl.pattern")} ({x.rotationPattern.length} {t("tpl.days")})</div>
              <div className="flex flex-wrap gap-1">
                {x.rotationPattern.map((c, i) => (
                  <button key={i} onClick={() => setX({ ...x, rotationPattern: x.rotationPattern.filter((_, j) => j !== i) })} className={cn("rounded border px-2 py-1 text-xs font-bold", SHIFT_STYLE[c].bg, SHIFT_STYLE[c].border, SHIFT_STYLE[c].text)} title={t("common.remove")}>{c}</button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">{["F", "S", "N", "FREI"].map((c) => <Button key={c} size="sm" variant="outline" onClick={() => setX({ ...x, rotationPattern: [...x.rotationPattern, c] })}>+ {c}</Button>)}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("tpl.members")}</div>
              <div className="max-h-60 space-y-1 overflow-auto">
                {employees.map((e) => {
                  const m = x.members.find((mm) => mm.employeeId === e.id);
                  return (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <Checkbox label={e.name} checked={!!m} onChange={() => setX({ ...x, members: m ? x.members.filter((mm) => mm.employeeId !== e.id) : [...x.members, { employeeId: e.id, offset: x.members.length % Math.max(1, x.rotationPattern.length) }] })} className="flex-1" />
                      {m ? <label className="flex items-center gap-1 text-xs">{t("tpl.offset")}<Input type="number" min={0} max={56} value={m.offset} className="h-8 w-16" onChange={(ev) => setX({ ...x, members: x.members.map((mm) => (mm.employeeId === e.id ? { ...mm, offset: Number(ev.target.value) } : mm)) })} /></label> : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-slate-500">{t("tpl.rotationItemsHint")}</p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase text-slate-600">{t("tpl.requirements")}</span>
            {objects.map((o) => <Checkbox key={o.id} label={o.name} checked={objIds.includes(o.id)} onChange={() => setObjIds((s) => (s.includes(o.id) ? s.filter((v) => v !== o.id) : [...s, o.id]))} />)}
            <Button size="sm" variant="outline" onClick={prefill}>{t("tpl.prefill")}</Button>
          </div>
          <div className="overflow-auto rounded-lg border">
            <table className="text-xs">
              <thead>
                <tr><th className="sticky left-0 bg-slate-50 px-2 py-1 text-left">{t("grid.object")} / {t("grid.shift")}</th>{keys.map((k) => <th key={k} className="bg-slate-50 px-1 py-1">{dayLabel(k)}</th>)}</tr>
              </thead>
              <tbody>
                {objects.filter((o) => objIds.includes(o.id)).flatMap((o) =>
                  shiftTypes.map((s) => (
                    <tr key={`${o.id}${s.id}`} className="border-t">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1"><span className="font-semibold">{o.name}</span> <ShiftChip code={s.code} small /></td>
                      {keys.map((k) => (
                        <td key={k} className="px-0.5 py-0.5">
                          <input type="number" min={0} max={50} aria-label={`${o.name} ${s.code} ${dayLabel(k)}`} className="h-8 w-11 rounded border border-slate-300 text-center" value={counts.get(`${o.id}|${s.id}|${k}`) ?? 0} onChange={(e) => setCount(o.id, s.id, k, Number(e.target.value))} />
                        </td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
