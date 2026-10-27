"use client";
import { useState } from "react";
import { saveSettingsAction } from "@/actions/admin";
import { saveShiftTypeAction } from "@/actions/schedule";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ShiftChip } from "@/components/common";
import { BUNDESLAENDER } from "@/lib/holidays";
import type { TKey } from "@/lib/i18n";

type ST = { id: string; code: string; nameDe: string; nameEn: string; startTime: string; endTime: string; breakMinutes: number; color: string };

export function ShiftTypesForm({ shiftTypes }: { shiftTypes: ST[] }) {
  const t = useT();
  const { run, pending } = useAction();
  const [rows, setRows] = useState(shiftTypes);
  const upd = (id: string, patch: Partial<ST>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader><CardTitle>{t("settings.shifts")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">{t("settings.shiftsHint")}</p>
        {rows.map((s) => (
          <div key={s.id} className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-7">
            <div className="flex items-center"><ShiftChip code={s.code} /></div>
            <Field label="Name (DE)"><Input value={s.nameDe} onChange={(e) => upd(s.id, { nameDe: e.target.value })} /></Field>
            <Field label="Name (EN)"><Input value={s.nameEn} onChange={(e) => upd(s.id, { nameEn: e.target.value })} /></Field>
            <Field label={t("common.start")}><Input type="time" value={s.startTime} onChange={(e) => upd(s.id, { startTime: e.target.value })} /></Field>
            <Field label={t("common.end")}><Input type="time" value={s.endTime} onChange={(e) => upd(s.id, { endTime: e.target.value })} /></Field>
            <Field label={t("settings.break")}><Input type="number" min={0} value={s.breakMinutes} onChange={(e) => upd(s.id, { breakMinutes: Number(e.target.value) })} /></Field>
            <Button loading={pending} onClick={() => run(() => saveShiftTypeAction(s))}>{t("common.save")}</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const t = useT();
  const { run, pending } = useAction();
  const [s, setS] = useState<Record<string, unknown>>(initial);
  const v = (k: string) => (s[k] ?? "") as string | number;
  const inp = (k: string, label: TKey, type = "text") => <Field label={t(label)}><Input type={type} value={v(k)} onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })} /></Field>;
  const logo = async (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setS((x) => ({ ...x, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(f);
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{t("settings.company")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {inp("companyName", "settings.companyName")}
          {inp("address", "obj.address")}
          {inp("phone", "common.phone")}
          {inp("email", "emp.email")}
          <Field label={t("settings.logo")} className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {s.logoDataUrl ? <img src={String(s.logoDataUrl)} alt="Logo" className="h-12 max-w-[160px] object-contain" /> : null}
              <Input type="file" accept="image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && logo(e.target.files[0])} />
              {s.logoDataUrl ? <Button size="sm" variant="ghost" onClick={() => setS({ ...s, logoDataUrl: null })}>{t("common.remove")}</Button> : null}
            </div>
          </Field>
          <Field label={t("settings.signature")} className="sm:col-span-2"><Textarea className="min-h-[60px]" value={String(v("emailSignature"))} onChange={(e) => setS({ ...s, emailSignature: e.target.value })} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("settings.rules")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("settings.bundesland")}>
            <Select value={String(v("bundesland"))} onChange={(e) => setS({ ...s, bundesland: e.target.value })}>{Object.entries(BUNDESLAENDER).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select>
          </Field>
          {inp("minRestHours", "settings.minRest", "number")}
          {inp("maxConsecutiveDays", "settings.maxConsecutive", "number")}
          {inp("maxDailyHours", "settings.maxDaily", "number")}
          {inp("nightStart", "settings.nightStart", "time")}
          {inp("nightEnd", "settings.nightEnd", "time")}
          {inp("overtimeTolerance", "settings.overtimeTolerance", "number")}
          {inp("minijobMaxHours", "settings.minijobMax", "number")}
          {inp("reminderHoursBefore", "settings.reminder", "number")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("settings.gdpr")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {inp("retentionMonthsLogs", "settings.retLogs", "number")}
          {inp("retentionMonthsNotifications", "settings.retNotif", "number")}
          {inp("retentionMonthsSickLeave", "settings.retSick", "number")}
          <p className="text-xs text-slate-500 sm:col-span-3">{t("settings.gdprHint")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>DATEV</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {inp("datevBeraterNr", "settings.datevBerater")}
          {inp("datevMandantNr", "settings.datevMandant")}
          {inp("datevLohnartWorked", "settings.laWorked")}
          {inp("datevLohnartOvertime", "settings.laOvertime")}
          {inp("datevLohnartNight", "settings.laNight")}
          {inp("datevLohnartSunday", "settings.laSunday")}
          {inp("datevLohnartHoliday", "settings.laHoliday")}
          {inp("datevLohnartSick", "settings.laSick")}
          {inp("datevLohnartVacation", "settings.laVacation")}
        </CardContent>
      </Card>
      <div className="sticky bottom-4 flex justify-end"><Button size="lg" loading={pending} onClick={() => run(() => saveSettingsAction(s))}>{t("common.save")}</Button></div>
    </div>
  );
}
