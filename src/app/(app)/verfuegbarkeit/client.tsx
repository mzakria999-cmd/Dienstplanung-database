"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAvailabilityAction, saveAvailabilityAction } from "@/actions/employees";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

export function AvailabilityForm() {
  const t = useT();
  const { run, pending } = useAction();
  const [date, setDate] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [type, setType] = useState("UNAVAILABLE");
  const [shiftCode, setShift] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t("avail.type")}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="UNAVAILABLE">{t("avail.UNAVAILABLE")}</option>
            <option value="PREFERRED_OFF">{t("avail.PREFERRED_OFF")}</option>
            <option value="AVAILABLE">{t("avail.AVAILABLE")}</option>
          </Select>
        </Field>
      </div>
      <Field label={t("grid.shift")}>
        <Select value={shiftCode} onChange={(e) => setShift(e.target.value)}>
          <option value="">{t("avail.wholeDay")}</option>
          <option value="F">{t("shift.F")}</option>
          <option value="S">{t("shift.S")}</option>
          <option value="N">{t("shift.N")}</option>
        </Select>
      </Field>
      <Field label={t("sick.note")}><Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button loading={pending} onClick={() => run(() => saveAvailabilityAction({ date, type, shiftCode: shiftCode || null, note }), { success: t("common.saved") })}>{t("common.save")}</Button>
    </div>
  );
}

export function DeleteAvailability({ id }: { id: string }) {
  const { run, pending } = useAction();
  return <Button size="icon" variant="ghost" loading={pending} onClick={() => run(() => deleteAvailabilityAction(id))} aria-label="Löschen"><Trash2 className="h-4 w-4 text-red-600" /></Button>;
}
