"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { createAnnouncementAction, previewRecipientsAction } from "@/actions/announcements";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Mode = "SHIFT_F" | "SHIFT_S" | "SHIFT_N" | "ALL" | "SELECTED";
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function AnnouncementEditor({ employees, objects }: { employees: Array<{ id: string; name: string; pnr: string }>; objects: Array<{ id: string; name: string }> }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("ALL");
  const [when, setWhen] = useState<"today" | "tomorrow" | "date" | "range">("today");
  const [dateFrom, setDateFrom] = useState(iso(new Date()));
  const [dateTo, setDateTo] = useState(iso(new Date()));
  const [objectId, setObjectId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState<"NORMAL" | "WICHTIG" | "DRINGEND">("NORMAL");
  const [channel, setChannel] = useState<"EMAIL" | "APP" | "BOTH">("BOTH");
  const [requireAck, setRequireAck] = useState(false);
  const [later, setLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<{ count: number; names: string[]; withoutEmail: number } | null>(null);
  const [empFilter, setEmpFilter] = useState("");

  const range = () => {
    if (mode === "ALL" || mode === "SELECTED") return { dateFrom: null, dateTo: null };
    const today = new Date();
    if (when === "today") return { dateFrom: iso(today), dateTo: iso(today) };
    if (when === "tomorrow") { const d = new Date(Date.now() + 86_400_000); return { dateFrom: iso(d), dateTo: iso(d) }; }
    if (when === "date") return { dateFrom, dateTo: dateFrom };
    return { dateFrom, dateTo };
  };
  const recipientPayload = () => ({ mode, ...range(), objectId: objectId || null, selectedEmployeeIds: selected });

  const openConfirm = () => {
    if (!subject.trim() || !message.trim()) return run(async () => ({ ok: false as const, error: t("ann.missing") }));
    run(() => previewRecipientsAction(recipientPayload()), { onSuccess: setPreview });
  };
  const send = () =>
    run(
      () => createAnnouncementAction({ ...recipientPayload(), subject, message, priority, channel, requireAck, scheduledAt: later && scheduledAt ? new Date(scheduledAt).toISOString() : null }),
      {
        onSuccess: (r) => {
          setPreview(null);
          router.push(`/mitteilungen/gesendet/${r.id}`);
        },
        success: later ? t("ann.scheduledOk") : t("ann.sentOk"),
      },
    );

  const modeBtn = (m: Mode, label: string, cls: string) => (
    <button type="button" onClick={() => setMode(m)} className={cn("rounded-xl border-2 px-4 py-4 text-left text-sm font-bold transition", mode === m ? `${cls} ring-4 ring-offset-1` : "border-slate-200 bg-white hover:bg-slate-50")} aria-pressed={mode === m}>
      {label}
    </button>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardContent className="space-y-4">
          <Field label={t("ann.subject")}><Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label={t("ann.message")}><Textarea value={message} maxLength={10000} className="min-h-[200px]" onChange={(e) => setMessage(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("ann.priority")}>
              <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="NORMAL">{t("priority.NORMAL")}</option>
                <option value="WICHTIG">{t("priority.WICHTIG")}</option>
                <option value="DRINGEND">{t("priority.DRINGEND")}</option>
              </Select>
            </Field>
            <Field label={t("ann.channel")}>
              <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="EMAIL">{t("channel.EMAIL")}</option>
                <option value="APP">{t("channel.APP")}</option>
                <option value="BOTH">{t("channel.BOTH")}</option>
              </Select>
            </Field>
            <Field label={t("ann.sendTime")}>
              <Select value={later ? "later" : "now"} onChange={(e) => setLater(e.target.value === "later")}>
                <option value="now">{t("ann.now")}</option>
                <option value="later">{t("ann.later")}</option>
              </Select>
            </Field>
          </div>
          {later ? <Field label={t("ann.scheduledAt")}><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></Field> : null}
          <Checkbox label={<b>{t("ann.requireAck")}</b>} checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <div className="text-xs font-semibold uppercase text-slate-600">{t("ann.recipients")}</div>
          <div className="grid gap-2">
            {modeBtn("SHIFT_F", `🟢 ${t("ann.onlyF")}`, "border-shift-f bg-shift-fbg ring-shift-f/40")}
            {modeBtn("SHIFT_S", `🟡 ${t("ann.onlyS")}`, "border-shift-s bg-shift-sbg ring-shift-s/40")}
            {modeBtn("SHIFT_N", `🟠 ${t("ann.onlyN")}`, "border-shift-n bg-shift-nbg ring-shift-n/40")}
            {modeBtn("ALL", `🔵 ${t("ann.all")}`, "border-blue-500 bg-blue-50 ring-blue-300")}
            {modeBtn("SELECTED", `👤 ${t("ann.selected")}`, "border-slate-600 bg-slate-100 ring-slate-300")}
          </div>
          {mode.startsWith("SHIFT_") ? (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div className="grid grid-cols-2 gap-2">
                {(["today", "tomorrow", "date", "range"] as const).map((w) => <Button key={w} size="sm" variant={when === w ? "default" : "outline"} onClick={() => setWhen(w)}>{t(`ann.when.${w}` as never)}</Button>)}
              </div>
              {when === "date" || when === "range" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label={t("common.from")} />
                  {when === "range" ? <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label={t("common.to")} /> : null}
                </div>
              ) : null}
              <Select value={objectId} onChange={(e) => setObjectId(e.target.value)}>
                <option value="">{t("planning.allObjects")}</option>
                {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </div>
          ) : null}
          {mode === "SELECTED" ? (
            <div className="space-y-2">
              <Input placeholder={t("grid.search")} value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="h-8" />
              <div className="max-h-64 space-y-1 overflow-auto rounded-lg border p-2">
                {employees.filter((e) => !empFilter || e.name.toLowerCase().includes(empFilter.toLowerCase())).map((e) => (
                  <Checkbox key={e.id} label={`${e.name} (${e.pnr})`} checked={selected.includes(e.id)} onChange={() => setSelected((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]))} />
                ))}
              </div>
              <div className="text-xs text-slate-500">{selected.length} {t("ann.chosen")}</div>
            </div>
          ) : null}
          <Button size="xl" variant="primary" className="w-full" loading={pending} onClick={openConfirm}><Send className="h-5 w-5" />{later ? t("ann.schedule") : t("ann.sendNow")}</Button>
        </CardContent>
      </Card>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={t("ann.confirmTitle")} footer={<><Button variant="outline" onClick={() => setPreview(null)}>{t("common.cancel")}</Button><Button variant="primary" disabled={!preview?.count} loading={pending} onClick={send}>{t("ann.continue")}</Button></>}>
        <p className="text-base font-semibold">{t("ann.confirmText", { n: preview?.count ?? 0 })}</p>
        <p className="mt-1 text-sm text-slate-600">{t("ann.confirmQuestion")}</p>
        {preview?.withoutEmail ? <p className="mt-2 text-sm text-orange-700">{t("ann.withoutEmail", { n: preview.withoutEmail })}</p> : null}
        {preview?.names.length ? <p className="mt-3 max-h-40 overflow-auto text-xs text-slate-500">{preview.names.join(", ")}{preview.count > preview.names.length ? " …" : ""}</p> : null}
      </Modal>
    </div>
  );
}
