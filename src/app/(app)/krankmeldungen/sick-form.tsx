"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { registerSickAction } from "@/actions/sick";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

export function SickForm({ employees, self }: { employees: Array<{ id: string; name: string }>; self: boolean }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [fromDate, setFrom] = useState(today);
  const [toDate, setTo] = useState(today);
  const [certificate, setCert] = useState(false);
  const [note, setNote] = useState("");
  const submit = () =>
    run(() => registerSickAction({ employeeId: self ? undefined : employeeId, fromDate, toDate, certificate, note }), {
      onSuccess: (r) => {
        setNote("");
        if (!self && r.openSlots.length) router.push(`/krankmeldungen?slot=${r.openSlots[0]}`, { scroll: false });
      },
    });
  return (
    <div className="space-y-3">
      {!self ? (
        <Field label={t("grid.employee")}>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.from")}><Input type="date" value={fromDate} onChange={(e) => { setFrom(e.target.value); if (e.target.value > toDate) setTo(e.target.value); }} /></Field>
        <Field label={t("common.to")}><Input type="date" value={toDate} min={fromDate} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Checkbox label={t("sick.certificateLabel")} checked={certificate} onChange={(e) => setCert(e.target.checked)} />
      <Field label={t("sick.note")} hint={t("sick.noDiagnosis")}><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button variant="danger" size="lg" className="w-full" loading={pending} onClick={submit}><HeartPulse className="h-5 w-5" />{self ? t("sick.reportMe") : t("sick.register")}</Button>
    </div>
  );
}
