"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, Trash2, CheckCircle2, UserX, Search, Printer } from "lucide-react";
import type { GridData, CellItem } from "@/server/queries";
import { useLocale, useT } from "@/components/i18n-provider";
import { useAction } from "@/components/use-action";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn, SHIFT_STYLE } from "@/lib/utils";
import { assignReplacementAction } from "@/actions/sick";
import { confirmAttendanceAction, copyAction, createAssignmentAction, deleteAssignmentAction, setDayCodeAction, updateAssignmentAction } from "@/actions/schedule";
import type { ActionResult } from "@/server/errors";

type Sel = { employeeId: string; day: string } | null;
type Pending = { message: string; retry: () => Promise<unknown> } | null;

const fmtH = (n: number) => (Math.round(n * 10) / 10).toLocaleString("de-DE");

function chipLabel(i: CellItem) {
  if (i.status === "SICK") return "K";
  if (i.status === "ABSENT") return "FT";
  if (i.status === "VACATION") return "U";
  return i.code;
}

export function PlanningGrid({ data, canEdit }: { data: GridData; canEdit: boolean }) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const { run, pending } = useAction();
  const [sel, setSel] = useState<Sel>(null);
  const [copyMode, setCopyMode] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);

  const employees = useMemo(() => data.employees.filter((e) => !filter || e.name.toLowerCase().includes(filter.toLowerCase()) || e.pnr.toLowerCase().includes(filter.toLowerCase())), [data.employees, filter]);
  const wd = (dow: number) => (locale === "de" ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"])[dow - 1];

  /** Führt Aktion aus; bei Konflikt/Warnung Rückfrage "trotzdem speichern" */
  const exec = <T,>(fn: (force: boolean) => Promise<ActionResult<T>>, onDone?: () => void) =>
    run(() => fn(false), {
      onSuccess: () => onDone?.(),
      onError: (r) => {
        const d = r.data as { needsForce?: boolean } | undefined;
        if (d?.needsForce) setConfirm({ message: r.error, retry: () => run(() => fn(true), { onSuccess: () => onDone?.() }) });
        else toast("error", r.error);
      },
    });

  const onDrop = (e: React.DragEvent, employeeId: string, day: string) => {
    e.preventDefault();
    setDragOver(null);
    if (!canEdit) return;
    const raw = e.dataTransfer.getData("application/x-sdm");
    if (!raw) return;
    const p = JSON.parse(raw) as { id: string; kind: "assignment" | "open"; day: string };
    if (p.kind === "open") {
      if (p.day !== day) return toast("error", t("grid.openSameDay"));
      exec((force) => assignReplacementAction({ slotId: p.id, employeeId, force }));
    } else {
      const copy = copyMode || e.altKey || e.ctrlKey || e.metaKey;
      exec((force) => updateAssignmentAction({ id: p.id, employeeId, date: day, copy, force }));
    }
  };

  const selEmployee = sel ? data.employees.find((e) => e.id === sel.employeeId) : null;
  const selItems = sel ? data.cells[sel.employeeId]?.[sel.day] ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Input placeholder={t("grid.search")} value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 max-w-xs" />
        {canEdit ? (
          <>
            <Checkbox label={t("grid.copyMode")} checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />
            <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}><Copy className="h-4 w-4" />{t("grid.copyTools")}</Button>
          </>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />{t("common.print")}</Button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
          {["F", "S", "N", "FREI", "K", "FT", "U"].map((c) => (
            <span key={c} className={cn("rounded border px-1.5 py-0.5 font-bold", SHIFT_STYLE[c].bg, SHIFT_STYLE[c].border, SHIFT_STYLE[c].text)}>{c}</span>
          ))}
          <span className="rounded border-2 border-red-600 px-1.5 py-0.5 font-bold text-red-600">{t("grid.changed")}</span>
          <span className="rounded border border-dashed border-slate-500 px-1.5 py-0.5">{t("grid.draft")}</span>
        </div>
      </div>
      {canEdit ? <p className="no-print text-xs text-slate-500">{t("grid.help")}</p> : null}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm" style={{ maxHeight: "calc(100vh - 230px)" }}>
        <table className="border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-white">
            <tr>
              <th className="sticky left-0 z-30 min-w-[180px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">{t("grid.employee")}</th>
              {data.days.map((d) => (
                <th key={d.key} title={d.holiday ?? undefined} className={cn("border-b border-r border-slate-100 px-1 py-1 text-center font-semibold", d.weekend && "bg-slate-50 text-red-600", d.holiday && "bg-purple-50 text-purple-700", d.today && "bg-blue-100 text-blue-800")}>
                  <div>{d.day}</div>
                  <div className="font-normal">{wd(d.dow)}</div>
                </th>
              ))}
              <th className="sticky right-0 z-30 min-w-[110px] border-b border-l border-slate-200 bg-slate-50 px-2 text-right">{t("grid.hours")}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="group">
                <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-1 group-hover:bg-slate-50">
                  <div className="font-semibold text-slate-900">{e.name}</div>
                  <div className="text-[11px] text-slate-500">{e.pnr}</div>
                </td>
                {data.days.map((d) => {
                  const items = data.cells[e.id]?.[d.key] ?? [];
                  const abs = data.absences[e.id]?.[d.key];
                  const key = `${e.id}|${d.key}`;
                  return (
                    <td
                      key={d.key}
                      className={cn("grid-cell cursor-pointer", d.weekend && "bg-slate-50/60", d.today && "bg-blue-50/60", dragOver === key && "bg-blue-100")}
                      onClick={() => setSel({ employeeId: e.id, day: d.key })}
                      onDragOver={(ev) => {
                        if (!canEdit) return;
                        ev.preventDefault();
                        setDragOver(key);
                      }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(ev) => onDrop(ev, e.id, d.key)}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {items.map((i) => {
                          const lbl = chipLabel(i);
                          const st = SHIFT_STYLE[lbl] ?? SHIFT_STYLE.FREI;
                          return (
                            <span
                              key={i.id}
                              draggable={canEdit && i.status === "PLANNED"}
                              onDragStart={(ev) => ev.dataTransfer.setData("application/x-sdm", JSON.stringify({ id: i.id, kind: "assignment", day: d.key }))}
                              title={`${i.objectName} ${i.start}–${i.end}${i.note ? ` · ${i.note}` : ""}${i.status !== "PLANNED" ? ` (${i.code})` : ""}`}
                              className={cn(
                                "relative inline-flex min-w-[2rem] items-center justify-center rounded border px-1 py-0.5 font-bold",
                                st.bg,
                                st.text,
                                i.isChanged ? "border-2 border-red-600" : st.border,
                                i.isDraft && "border-dashed opacity-80",
                              )}
                            >
                              {lbl}
                              {i.status !== "PLANNED" ? <sub className="ml-0.5 text-[8px] opacity-70">{i.code}</sub> : null}
                              {i.attendance === "CONFIRMED" ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-600" /> : null}
                              {i.isChanged ? <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-600" /> : null}
                            </span>
                          );
                        })}
                        {items.length === 0 && abs ? (
                          <span className={cn("inline-flex min-w-[2rem] justify-center rounded border px-1 py-0.5 font-bold", (SHIFT_STYLE[abs] ?? SHIFT_STYLE.FREI).bg, (SHIFT_STYLE[abs] ?? SHIFT_STYLE.FREI).border, (SHIFT_STYLE[abs] ?? SHIFT_STYLE.FREI).text)}>{abs === "W" ? "W" : abs}</span>
                        ) : null}
                        {items.length === 0 && !abs ? <span className="text-slate-300">·</span> : null}
                      </div>
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 border-b border-l border-slate-200 bg-white px-2 text-right group-hover:bg-slate-50">
                  <div className={cn("font-bold", e.hours.activePlanned + e.hours.sick + e.hours.vacation > e.hours.target ? "text-orange-600" : "text-slate-900")}>
                    {fmtH(e.hours.activePlanned + e.hours.sick + e.hours.vacation)} / {fmtH(e.hours.target)}
                  </div>
                  <div className="text-[11px] text-slate-500">{t("grid.remaining")}: {fmtH(e.hours.remainingToPlan)}</div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-white">
            <tr>
              <td className="sticky left-0 z-30 border-r border-t-2 border-slate-200 bg-orange-50 px-3 py-1 font-semibold text-orange-800">{t("grid.openShifts")}</td>
              {data.days.map((d) => (
                <td key={d.key} className="border-r border-t-2 border-slate-100 bg-orange-50/40 p-0.5 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    {(data.open[d.key] ?? []).map((o) => (
                      <Link
                        key={o.id}
                        href={`/krankmeldungen?slot=${o.id}`}
                        draggable={canEdit}
                        onDragStart={(ev) => ev.dataTransfer.setData("application/x-sdm", JSON.stringify({ id: o.id, kind: "open", day: d.key }))}
                        title={`${t("grid.unassigned")}: ${o.objectName} ${o.start}–${o.end}${o.replacesName ? ` (${t("dash.insteadOf")} ${o.replacesName})` : ""}`}
                        className={cn("inline-flex min-w-[2rem] justify-center rounded border-2 border-dashed px-1 font-bold", SHIFT_STYLE[o.code].text, "border-orange-500 bg-white")}
                      >
                        {o.code}?
                      </Link>
                    ))}
                  </div>
                </td>
              ))}
              <td className="sticky right-0 border-l border-t-2 border-slate-200 bg-orange-50" />
            </tr>
            <tr>
              <td className="sticky left-0 z-30 border-r border-t border-slate-200 bg-slate-50 px-3 py-1 font-semibold">{t("grid.coverage")}</td>
              {data.days.map((d) => {
                const c = data.coverage[d.key];
                return (
                  <td key={d.key} className="border-r border-t border-slate-100 bg-slate-50 px-0.5 text-center text-[10px] leading-tight">
                    {(["F", "S", "N"] as const).map((code) => {
                      const req = c[`req${code}` as "reqF"];
                      const ok = c[code] >= req;
                      return (
                        <div key={code} className={cn("font-semibold", ok ? "text-slate-500" : "text-red-600")}>
                          {code}:{c[code]}/{req}
                        </div>
                      );
                    })}
                  </td>
                );
              })}
              <td className="sticky right-0 border-l border-t border-slate-200 bg-slate-50" />
            </tr>
          </tfoot>
        </table>
      </div>

      {sel && selEmployee ? (
        <CellDialog
          key={`${sel.employeeId}${sel.day}`}
          data={data}
          employeeName={selEmployee.name}
          employeeId={sel.employeeId}
          primaryObjectId={selEmployee.primaryObjectId}
          day={sel.day}
          items={selItems}
          absence={data.absences[sel.employeeId]?.[sel.day]}
          canEdit={canEdit}
          onClose={() => setSel(null)}
          exec={exec}
          pending={pending}
        />
      ) : null}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t("grid.conflictTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={async () => { const c = confirm; setConfirm(null); await c?.retry(); }}>{t("grid.saveAnyway")}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">{confirm?.message}</p>
        <p className="mt-3 text-xs text-slate-500">{t("grid.conflictHint")}</p>
      </Modal>

      {copyOpen ? <CopyDialog year={data.year} month={data.month} onClose={() => setCopyOpen(false)} /> : null}
    </div>
  );
}

function CellDialog(props: {
  data: GridData;
  employeeName: string;
  employeeId: string;
  primaryObjectId: string | null;
  day: string;
  items: CellItem[];
  absence?: string;
  canEdit: boolean;
  onClose: () => void;
  exec: <T>(fn: (force: boolean) => Promise<ActionResult<T>>, onDone?: () => void) => Promise<unknown>;
  pending: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [objectId, setObjectId] = useState(props.primaryObjectId ?? props.data.objects[0]?.id ?? "");
  const [edit, setEdit] = useState<CellItem | null>(props.items.find((i) => i.status === "PLANNED") ?? null);
  const [start, setStart] = useState(edit?.start ?? "");
  const [end, setEnd] = useState(edit?.end ?? "");
  const date = new Date(`${props.day}T00:00:00Z`).toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const setCode = (code: string) => props.exec((force) => setDayCodeAction({ employeeId: props.employeeId, date: props.day, code, objectId, force }), props.onClose);

  return (
    <Modal open onClose={props.onClose} title={`${props.employeeName} · ${date}`}>
      <div className="space-y-4">
        {props.items.length ? (
          <div className="space-y-2">
            {props.items.map((i) => (
              <div key={i.id} className={cn("flex items-center justify-between rounded-lg border p-2 text-sm", i.isChanged ? "border-2 border-red-600" : "border-slate-200")}>
                <div>
                  <b>{t(`shift.${i.code}` as never)}</b> · {i.start}–{i.end} · {i.objectName}
                  <div className="text-xs text-slate-500">
                    {t(`status.${i.status}` as never)} · {t(`attendance.${i.attendance}` as never)}
                    {i.isDraft ? ` · ${t("grid.draft")}` : ""}
                    {i.note ? ` · ${i.note}` : ""}
                  </div>
                </div>
                {props.canEdit && i.status === "PLANNED" ? (
                  <button className={cn("rounded px-2 py-1 text-xs font-semibold", edit?.id === i.id ? "bg-navy-800 text-white" : "bg-slate-100")} onClick={() => { setEdit(i); setStart(i.start); setEnd(i.end); }}>
                    {t("common.edit")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">{props.absence ? t(`absence.${props.absence}` as never) : t("grid.free")}</p>
        )}

        {props.canEdit ? (
          <>
            <Field label={t("grid.object")}>
              <Select value={objectId} onChange={(e) => setObjectId(e.target.value)}>
                {props.data.objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-slate-600">{t("grid.setDay")}</div>
              <div className="grid grid-cols-4 gap-2">
                <Button variant="early" size="lg" onClick={() => setCode("F")} disabled={props.pending}>F</Button>
                <Button variant="late" size="lg" onClick={() => setCode("S")} disabled={props.pending}>S</Button>
                <Button variant="night" size="lg" onClick={() => setCode("N")} disabled={props.pending}>N</Button>
                <Button variant="outline" size="lg" onClick={() => setCode("FREI")} disabled={props.pending}>FREI</Button>
                <Button variant="danger" size="lg" onClick={() => setCode("K")} disabled={props.pending}>K</Button>
                <Button className="bg-slate-600 hover:bg-slate-700" size="lg" onClick={() => setCode("FT")} disabled={props.pending}>FT</Button>
                <Button className="bg-sky-600 hover:bg-sky-700" size="lg" onClick={() => setCode("U")} disabled={props.pending}>U</Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">{t("grid.codeHelp")}</p>
            </div>

            {edit ? (
              <div className="space-y-3 rounded-lg bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-600">{t("grid.editShift")}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("common.start")}><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
                  <Field label={t("common.end")}><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => props.exec((force) => updateAssignmentAction({ id: edit.id, startTime: start, endTime: end, objectId, force }), props.onClose)} loading={props.pending}>{t("common.save")}</Button>
                  <Button size="sm" variant="success" onClick={() => props.exec(() => confirmAttendanceAction({ ids: [edit.id], status: "CONFIRMED" }), props.onClose)}><CheckCircle2 className="h-4 w-4" />{t("attendance.confirm")}</Button>
                  <Button size="sm" variant="outline" onClick={() => props.exec(() => confirmAttendanceAction({ ids: [edit.id], status: "NO_SHOW" }), props.onClose)}><UserX className="h-4 w-4" />{t("attendance.noShow")}</Button>
                  <Button size="sm" variant="danger" onClick={() => props.exec(() => deleteAssignmentAction(edit.id), props.onClose)}><Trash2 className="h-4 w-4" />{t("common.delete")}</Button>
                </div>
              </div>
            ) : null}
            {props.items.length > 0 && props.items.every((i) => i.status !== "PLANNED") ? (
              <Link href="/krankmeldungen" className="flex items-center gap-2 text-sm font-semibold text-blue-700"><Search className="h-4 w-4" />{t("dash.findReplacement")}</Link>
            ) : null}
            <AddExtraShift data={props.data} employeeId={props.employeeId} day={props.day} objectId={objectId} exec={props.exec} onDone={props.onClose} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function AddExtraShift({ data, employeeId, day, objectId, exec, onDone }: { data: GridData; employeeId: string; day: string; objectId: string; exec: <T>(fn: (force: boolean) => Promise<ActionResult<T>>, onDone?: () => void) => Promise<unknown>; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [shiftTypeId, setShiftTypeId] = useState(data.shiftTypes[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  if (!open) return <button className="text-xs font-semibold text-blue-700" onClick={() => setOpen(true)}>+ {t("grid.addCustom")}</button>;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
      <Field label={t("grid.shift")}>
        <Select value={shiftTypeId} onChange={(e) => setShiftTypeId(e.target.value)}>
          {data.shiftTypes.map((s) => <option key={s.id} value={s.id}>{s.code} ({s.startTime}–{s.endTime})</option>)}
        </Select>
      </Field>
      <Field label={t("common.start")}><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label={t("common.end")}><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      <div className="flex items-end"><Button size="sm" onClick={() => exec((force) => createAssignmentAction({ date: day, shiftTypeId, objectId, employeeId, startTime: start, endTime: end, force }), onDone)}>{t("common.add")}</Button></div>
    </div>
  );
}

function CopyDialog({ year, month, onClose }: { year: number; month: number; onClose: () => void }) {
  const t = useT();
  const { run, pending } = useAction();
  const [mode, setMode] = useState<"day" | "week" | "month">("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const [src, setSrc] = useState(`${prev.y}-${String(prev.m).padStart(2, "0")}`);
  const [result, setResult] = useState<{ created: number; skipped: Array<{ date: string; employee: string; reason: string }> } | null>(null);
  const submit = () => {
    const payload = mode === "month" ? { mode, fromYear: Number(src.slice(0, 4)), fromMonth: Number(src.slice(5, 7)), toYear: year, toMonth: month } : { mode, from, to };
    run(() => copyAction(payload), { onSuccess: (r) => setResult(r), success: t("grid.copyDone") });
  };
  return (
    <Modal open onClose={onClose} title={t("grid.copyTools")} footer={<><Button variant="outline" onClick={onClose}>{t("common.close")}</Button><Button onClick={submit} loading={pending}>{t("grid.copyNow")}</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["day", "week", "month"] as const).map((m) => (
            <Button key={m} variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{t(`grid.copy.${m}` as never)}</Button>
          ))}
        </div>
        {mode === "month" ? (
          <Field label={t("grid.copy.sourceMonth")} hint={t("grid.copy.monthHint")}>
            <Input type="month" value={src} onChange={(e) => setSrc(e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === "week" ? t("grid.copy.fromMonday") : t("grid.copy.from")}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={mode === "week" ? t("grid.copy.toMonday") : t("grid.copy.to")}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        )}
        {result ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <b>{t("grid.copy.created", { n: result.created })}</b>
            {result.skipped.length ? (
              <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-xs text-slate-600">
                {result.skipped.map((s, i) => <li key={i}>{s.date} · {s.employee}: {s.reason}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
