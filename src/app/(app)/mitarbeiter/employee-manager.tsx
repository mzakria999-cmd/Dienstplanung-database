"use client";
import { useMemo, useState } from "react";
import { Download, KeyRound, Mail, Pencil, Phone, Plus, Trash2, UserMinus } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, Td, Th, Empty } from "@/components/ui/table";
import { TelLink } from "@/components/common";
import { anonymizeEmployeeAction, deleteEmployeeAction, resetPasswordAction, saveEmployeeAction } from "@/actions/employees";
import { initials } from "@/lib/utils";

export interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  personnelNumber: string;
  email: string;
  phone: string;
  entryDate: string;
  employmentType: "VOLLZEIT" | "TEILZEIT" | "MINIJOB";
  targetHours: number;
  status: "AKTIV" | "INAKTIV";
  primaryObjectId: string | null;
  primaryObjectName: string | null;
  role: "ADMIN" | "SUPERVISOR" | "EMPLOYEE";
  allowedShiftCodes: string[];
  availableForReplacement: boolean;
  objectIds: string[];
  qualificationIds: string[];
  photoDataUrl: string | null;
  lastLoginAt: string | null;
  totpEnabled: boolean;
  anonymized: boolean;
  monthPlanned: number;
}

type Opt = { id: string; name: string };

const empty = (): Omit<EmployeeRow, "id" | "primaryObjectName" | "lastLoginAt" | "totpEnabled" | "anonymized" | "monthPlanned"> & { id?: string; password: string } => ({
  firstName: "",
  lastName: "",
  personnelNumber: "",
  email: "",
  phone: "",
  entryDate: new Date().toISOString().slice(0, 10),
  employmentType: "VOLLZEIT",
  targetHours: 160,
  status: "AKTIV",
  primaryObjectId: null,
  role: "EMPLOYEE",
  allowedShiftCodes: ["F", "S", "N"],
  availableForReplacement: true,
  objectIds: [],
  qualificationIds: [],
  photoDataUrl: null,
  password: "",
});

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const size = 256;
  const c = document.createElement("canvas");
  const s = Math.min(img.width, img.height);
  c.width = size;
  c.height = size;
  c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.85);
}

export function EmployeeManager({ rows, objects, qualifications, isAdmin }: { rows: EmployeeRow[]; objects: Opt[]; qualifications: Opt[]; isAdmin: boolean }) {
  const t = useT();
  const { run, pending } = useAction();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("AKTIV");
  const [form, setForm] = useState<ReturnType<typeof empty> | null>(null);
  const [secret, setSecret] = useState<{ name: string; password: string } | null>(null);

  const list = useMemo(
    () => rows.filter((r) => (!status || r.status === status) && (!q || `${r.firstName} ${r.lastName} ${r.personnelNumber} ${r.email}`.toLowerCase().includes(q.toLowerCase()))),
    [rows, q, status],
  );
  const set = <K extends keyof ReturnType<typeof empty>>(k: K, v: ReturnType<typeof empty>[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const toggleIn = (k: "objectIds" | "qualificationIds" | "allowedShiftCodes", v: string) => setForm((f) => (f ? { ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] } : f));

  const save = () =>
    form &&
    run(() => saveEmployeeAction({ ...form, password: form.password || undefined }), {
      onSuccess: (d) => {
        if (d.initialPassword) setSecret({ name: `${form.firstName} ${form.lastName}`, password: d.initialPassword });
        setForm(null);
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder={t("grid.search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {isAdmin ? (
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="AKTIV">{t("emp.status.AKTIV")}</option>
              <option value="INAKTIV">{t("emp.status.INAKTIV")}</option>
              <option value="">{t("common.all")}</option>
            </Select>
            <Button className="ml-auto" onClick={() => setForm(empty())}><Plus className="h-4 w-4" />{t("emp.new")}</Button>
          </>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? <div className="p-5"><Empty>{t("common.noEntries")}</Empty></div> : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("emp.name")}</Th>
                  <Th>{t("emp.pnr")}</Th>
                  <Th>{t("common.phone")}</Th>
                  <Th className="hidden md:table-cell">{t("emp.email")}</Th>
                  <Th className="hidden lg:table-cell">{t("emp.type")}</Th>
                  <Th className="hidden lg:table-cell">{t("emp.object")}</Th>
                  <Th className="text-right">{t("emp.hoursMonth")}</Th>
                  <Th>{t("emp.statusLabel")}</Th>
                  {isAdmin ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td>
                      <div className="flex items-center gap-3">
                        {r.photoDataUrl ? <img src={r.photoDataUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{initials(r.firstName, r.lastName)}</div>}
                        <div>
                          <div className="font-semibold">{r.lastName}, {r.firstName}</div>
                          <div className="text-xs text-slate-500">{t(`role.${r.role}` as never)}{r.totpEnabled ? " · 2FA" : ""}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">{r.personnelNumber}</Td>
                    <Td><div className="flex items-center gap-2"><TelLink phone={r.phone} />{r.phone ? <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`} className="rounded bg-green-600 p-1 text-white" aria-label="Anrufen"><Phone className="h-3 w-3" /></a> : null}</div></Td>
                    <Td className="hidden md:table-cell">{r.email ? <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-blue-700"><Mail className="h-3 w-3" />{r.email}</a> : "—"}</Td>
                    <Td className="hidden lg:table-cell">{t(`emp.type.${r.employmentType}` as never)} · {r.targetHours} h</Td>
                    <Td className="hidden lg:table-cell">{r.primaryObjectName ?? "—"}</Td>
                    <Td className="text-right">{Math.round(r.monthPlanned * 10) / 10} / {r.targetHours}</Td>
                    <Td><Badge tone={r.status === "AKTIV" ? "green" : "slate"}>{t(`emp.status.${r.status}` as never)}</Badge></Td>
                    {isAdmin ? (
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title={t("common.edit")} onClick={() => setForm({ ...r, password: "" })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title={t("emp.resetPassword")} onClick={() => confirm(t("emp.confirmReset")) && run(() => resetPasswordAction(r.id), { onSuccess: (d) => setSecret({ name: `${r.firstName} ${r.lastName}`, password: d.password }) })}><KeyRound className="h-4 w-4" /></Button>
                          <a className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100" title={t("emp.gdprExport")} href={`/api/employees/export?id=${r.id}`}><Download className="h-4 w-4" /></a>
                          {r.status === "INAKTIV" && !r.anonymized ? <Button size="icon" variant="ghost" title={t("emp.anonymize")} onClick={() => confirm(t("emp.confirmAnonymize")) && run(() => anonymizeEmployeeAction(r.id))}><UserMinus className="h-4 w-4" /></Button> : null}
                          <Button size="icon" variant="ghost" title={t("common.delete")} onClick={() => confirm(t("emp.confirmDelete")) && run(() => deleteEmployeeAction(r.id), { success: t("emp.deletedOrDeactivated") })}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {form ? (
        <Modal open wide onClose={() => setForm(null)} title={form.id ? t("emp.edit") : t("emp.new")} footer={<><Button variant="outline" onClick={() => setForm(null)}>{t("common.cancel")}</Button><Button onClick={save} loading={pending}>{t("common.save")}</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={`${t("emp.firstName")} *`}><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required /></Field>
            <Field label={`${t("emp.lastName")} *`}><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required /></Field>
            <Field label={`${t("emp.pnr")} *`} hint={t("emp.pnrHint")}><Input value={form.personnelNumber} onChange={(e) => set("personnelNumber", e.target.value.toUpperCase())} placeholder="SD001" /></Field>
            <Field label={`${t("emp.email")} *`}><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label={t("common.phone")}><Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49 176 …" /></Field>
            <Field label={t("emp.entryDate")}><Input type="date" value={form.entryDate} onChange={(e) => set("entryDate", e.target.value)} /></Field>
            <Field label={t("emp.type")}>
              <Select value={form.employmentType} onChange={(e) => { const v = e.target.value as EmployeeRow["employmentType"]; set("employmentType", v); if (!form.id) set("targetHours", v === "VOLLZEIT" ? 160 : v === "TEILZEIT" ? 80 : 40); }}>
                <option value="VOLLZEIT">{t("emp.type.VOLLZEIT")}</option>
                <option value="TEILZEIT">{t("emp.type.TEILZEIT")}</option>
                <option value="MINIJOB">{t("emp.type.MINIJOB")}</option>
              </Select>
            </Field>
            <Field label={t("emp.targetHours")}><Input type="number" min={0} max={300} step="0.5" value={form.targetHours} onChange={(e) => set("targetHours", Number(e.target.value))} /></Field>
            <Field label={t("emp.statusLabel")}>
              <Select value={form.status} onChange={(e) => set("status", e.target.value as EmployeeRow["status"])}>
                <option value="AKTIV">{t("emp.status.AKTIV")}</option>
                <option value="INAKTIV">{t("emp.status.INAKTIV")}</option>
              </Select>
            </Field>
            <Field label={t("emp.object")}>
              <Select value={form.primaryObjectId ?? ""} onChange={(e) => set("primaryObjectId", e.target.value || null)}>
                <option value="">—</option>
                {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
            <Field label={t("emp.role")}>
              <Select value={form.role} onChange={(e) => set("role", e.target.value as EmployeeRow["role"])}>
                <option value="EMPLOYEE">{t("role.EMPLOYEE")}</option>
                <option value="SUPERVISOR">{t("role.SUPERVISOR")}</option>
                <option value="ADMIN">{t("role.ADMIN")}</option>
              </Select>
            </Field>
            <Field label={form.id ? t("emp.newPassword") : t("emp.initialPassword")} hint={t("emp.passwordHint")}>
              <Input type="text" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("emp.allowedShifts")}</div>
              <div className="flex flex-wrap gap-4">
                {["F", "S", "N"].map((c) => <Checkbox key={c} label={t(`shift.${c}` as never)} checked={form.allowedShiftCodes.includes(c)} onChange={() => toggleIn("allowedShiftCodes", c)} />)}
                <Checkbox label={t("emp.availableForReplacement")} checked={form.availableForReplacement} onChange={(e) => set("availableForReplacement", e.target.checked)} />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("emp.objectsQualified")}</div>
              <div className="flex flex-wrap gap-4">{objects.map((o) => <Checkbox key={o.id} label={o.name} checked={form.objectIds.includes(o.id) || form.primaryObjectId === o.id} onChange={() => toggleIn("objectIds", o.id)} />)}</div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mb-1 text-xs font-semibold uppercase text-slate-600">{t("emp.qualifications")}</div>
              <div className="flex flex-wrap gap-4">{qualifications.map((o) => <Checkbox key={o.id} label={o.name} checked={form.qualificationIds.includes(o.id)} onChange={() => toggleIn("qualificationIds", o.id)} />)}</div>
            </div>
            <Field label={t("emp.photo")} className="sm:col-span-2">
              <div className="flex items-center gap-3">
                {form.photoDataUrl ? <img src={form.photoDataUrl} alt="" className="h-14 w-14 rounded-full object-cover" /> : null}
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set("photoDataUrl", await resizeImage(f)); }} />
                {form.photoDataUrl ? <Button size="sm" variant="ghost" onClick={() => set("photoDataUrl", null)}>{t("common.remove")}</Button> : null}
              </div>
            </Field>
          </div>
        </Modal>
      ) : null}

      <Modal open={!!secret} onClose={() => setSecret(null)} title={t("emp.credentials")} footer={<Button onClick={() => setSecret(null)}>{t("common.close")}</Button>}>
        <p className="text-sm">{t("emp.credentialsHint", { name: secret?.name ?? "" })}</p>
        <p className="mt-3 select-all rounded-lg bg-slate-100 p-3 text-center font-mono text-lg font-bold">{secret?.password}</p>
      </Modal>
    </div>
  );
}
