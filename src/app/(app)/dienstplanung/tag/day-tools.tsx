"use client";
import { useState } from "react";
import { createAssignmentAction, copyAction } from "@/actions/schedule";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

/** Offene Schichten (Sollbesetzung) anlegen & Tag kopieren */
export function DayTools({ day, shiftTypes, objects }: { day: string; shiftTypes: Array<{ id: string; code: string; label: string }>; objects: Array<{ id: string; name: string }> }) {
  const t = useT();
  const { run, pending } = useAction();
  const [shiftTypeId, setShiftTypeId] = useState(shiftTypes[0]?.id ?? "");
  const [objectId, setObjectId] = useState(objects[0]?.id ?? "");
  const [count, setCount] = useState(1);
  const [target, setTarget] = useState("");
  return (
    <Card>
      <CardContent className="grid gap-3 md:grid-cols-6">
        <Field label={t("grid.shift")}><Select value={shiftTypeId} onChange={(e) => setShiftTypeId(e.target.value)}>{shiftTypes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
        <Field label={t("grid.object")}><Select value={objectId} onChange={(e) => setObjectId(e.target.value)}>{objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
        <Field label={t("daily.count")}><Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
        <div className="flex items-end"><Button className="w-full" loading={pending} onClick={() => run(() => createAssignmentAction({ date: day, shiftTypeId, objectId, employeeId: null, count }))}>{t("daily.addOpen")}</Button></div>
        <Field label={t("daily.copyTo")}><Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <div className="flex items-end"><Button variant="outline" className="w-full" disabled={!target} loading={pending} onClick={() => run(() => copyAction({ mode: "day", from: day, to: target }), { onSuccess: (r) => alert(`${t("grid.copy.created", { n: r.created })}${r.skipped.length ? `\n${r.skipped.map((s) => `${s.employee}: ${s.reason}`).join("\n")}` : ""}`) })}>{t("daily.copyDay")}</Button></div>
      </CardContent>
    </Card>
  );
}
