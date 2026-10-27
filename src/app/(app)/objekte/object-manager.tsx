"use client";
import Link from "next/link";
import { useState } from "react";
import { Building2, CalendarDays, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
import { deleteObjectAction, deleteQualificationAction, saveObjectAction, saveQualificationAction } from "@/actions/admin";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ShiftChip } from "@/components/common";

interface Obj {
  id?: string;
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  notes: string;
  active: boolean;
  requiredEarly: number;
  requiredLate: number;
  requiredNight: number;
  employeeIds: string[];
  qualificationIds: string[];
}

export function ObjectManager({ objects, employees, qualifications }: { objects: Obj[]; employees: Array<{ id: string; name: string }>; qualifications: Array<{ id: string; name: string; description: string }> }) {
  const t = useT();
  const { run, pending } = useAction();
  const [edit, setEdit] = useState<Obj | null>(null);
  const [qual, setQual] = useState<{ id?: string; name: string; description: string } | null>(null);
  const toggle = (k: "employeeIds" | "qualificationIds", v: string) => setEdit((e) => (e ? { ...e, [k]: e[k].includes(v) ? e[k].filter((x) => x !== v) : [...e[k], v] } : e));
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button onClick={() => setEdit({ name: "", address: "", contactPerson: "", phone: "", notes: "", active: true, requiredEarly: 1, requiredLate: 1, requiredNight: 1, employeeIds: [], qualificationIds: [] })}><Plus className="h-4 w-4" />{t("obj.new")}</Button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {objects.map((o) => (
          <Card key={o.id} className={o.active ? "" : "opacity-60"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-navy-700" />{o.name}</CardTitle>
              <div className="flex gap-1">
                {!o.active ? <Badge>{t("emp.status.INAKTIV")}</Badge> : null}
                <Button size="icon" variant="ghost" onClick={() => setEdit(o)} aria-label={t("common.edit")}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteObjectAction(o.id!))} aria-label={t("common.delete")}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate-600">{o.address || "—"}</p>
              <p className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" />{o.contactPerson || "—"}</p>
              {o.phone ? <a href={`tel:${o.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 font-semibold text-blue-700"><Phone className="h-4 w-4" />{o.phone}</a> : null}
              <div className="flex gap-2 pt-1"><ShiftChip code="F" label={`F: ${o.requiredEarly}`} small /><ShiftChip code="S" label={`S: ${o.requiredLate}`} small /><ShiftChip code="N" label={`N: ${o.requiredNight}`} small /></div>
              <p className="text-xs text-slate-500">{t("obj.assigned", { n: o.employeeIds.length })}{o.qualificationIds.length ? ` · ${t("obj.requiredQuals")}: ${o.qualificationIds.map((q) => qualifications.find((x) => x.id === q)?.name).join(", ")}` : ""}</p>
              <Link href={`/dienstplanung?object=${o.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><CalendarDays className="h-4 w-4" />{t("obj.roster")}</Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{t("obj.qualifications")}</CardTitle><Button size="sm" onClick={() => setQual({ name: "", description: "" })}><Plus className="h-4 w-4" />{t("common.add")}</Button></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {qualifications.map((q) => (
            <span key={q.id} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm" title={q.description}>
              {q.name}
              <button onClick={() => setQual(q)} aria-label={t("common.edit")}><Pencil className="h-3 w-3" /></button>
              <button onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteQualificationAction(q.id))} aria-label={t("common.delete")}><Trash2 className="h-3 w-3 text-red-600" /></button>
            </span>
          ))}
        </CardContent>
      </Card>

      {edit ? (
        <Modal open wide onClose={() => setEdit(null)} title={edit.id ? t("obj.edit") : t("obj.new")} footer={<><Button variant="outline" onClick={() => setEdit(null)}>{t("common.cancel")}</Button><Button loading={pending} onClick={() => run(() => saveObjectAction(edit), { onSuccess: () => setEdit(null) })}>{t("common.save")}</Button></>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("obj.name")}><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t("obj.address")}><Input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            <Field label={t("obj.contact")}><Input value={edit.contactPerson} onChange={(e) => setEdit({ ...edit, contactPerson: e.target.value })} /></Field>
            <Field label={t("common.phone")}><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <Field label={`${t("obj.required")} F`}><Input type="number" min={0} value={edit.requiredEarly} onChange={(e) => setEdit({ ...edit, requiredEarly: Number(e.target.value) })} /></Field>
              <Field label={`${t("obj.required")} S`}><Input type="number" min={0} value={edit.requiredLate} onChange={(e) => setEdit({ ...edit, requiredLate: Number(e.target.value) })} /></Field>
              <Field label={`${t("obj.required")} N`}><Input type="number" min={0} value={edit.requiredNight} onChange={(e) => setEdit({ ...edit, requiredNight: Number(e.target.value) })} /></Field>
            </div>
            <Field label={t("obj.notes")} className="sm:col-span-2"><Textarea className="min-h-[70px]" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <Checkbox label={t("obj.active")} checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("obj.requiredQuals")}</div>
              <div className="flex flex-wrap gap-4">{qualifications.map((q) => <Checkbox key={q.id} label={q.name} checked={edit.qualificationIds.includes(q.id)} onChange={() => toggle("qualificationIds", q.id)} />)}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("obj.employees")}</div>
              <div className="grid max-h-60 gap-1 overflow-auto rounded-lg border p-2 sm:grid-cols-2">{employees.map((e) => <Checkbox key={e.id} label={e.name} checked={edit.employeeIds.includes(e.id)} onChange={() => toggle("employeeIds", e.id)} />)}</div>
            </div>
          </div>
        </Modal>
      ) : null}
      {qual ? (
        <Modal open onClose={() => setQual(null)} title={t("obj.qualifications")} footer={<Button loading={pending} onClick={() => run(() => saveQualificationAction(qual), { onSuccess: () => setQual(null) })}>{t("common.save")}</Button>}>
          <div className="space-y-3">
            <Field label={t("obj.name")}><Input value={qual.name} onChange={(e) => setQual({ ...qual, name: e.target.value })} /></Field>
            <Field label={t("tpl.description")}><Input value={qual.description} onChange={(e) => setQual({ ...qual, description: e.target.value })} /></Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
