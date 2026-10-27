import { prisma } from "@/lib/db";
import { requirePageUser, STAFF } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { EmployeeManager, type EmployeeRow } from "./employee-manager";
import { currentMonth, dateKey } from "@/lib/time";
import { monthHoursFor } from "@/server/hours-service";

export const metadata = { title: "Mitarbeiter" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requirePageUser(STAFF);
  const { t } = await getT();
  const isAdmin = user.role === "ADMIN";
  const [employees, objects, qualifications] = await Promise.all([
    prisma.employee.findMany({ include: { user: { select: { role: true, lastLoginAt: true, totpEnabled: true } }, primaryObject: true, objectQualifications: true, qualifications: true }, orderBy: [{ status: "asc" }, { lastName: "asc" }] }),
    prisma.securityObject.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.qualification.findMany({ orderBy: { name: "asc" } }),
  ]);
  const cm = currentMonth();
  const hours = await monthHoursFor(cm.year, cm.month, employees.map((e) => e.id));
  const rows: EmployeeRow[] = employees
    .filter((e) => isAdmin || e.status === "AKTIV")
    .map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      personnelNumber: e.personnelNumber,
      // Schichtleiter sehen nur dienstliche Kontaktdaten
      email: e.email,
      phone: e.phone,
      entryDate: isAdmin ? dateKey(e.entryDate) : "",
      employmentType: e.employmentType,
      targetHours: e.targetHours,
      status: e.status,
      primaryObjectId: e.primaryObjectId,
      primaryObjectName: e.primaryObject?.name ?? null,
      role: e.user?.role ?? "EMPLOYEE",
      allowedShiftCodes: e.allowedShiftCodes,
      availableForReplacement: e.availableForReplacement,
      objectIds: e.objectQualifications.map((o) => o.objectId),
      qualificationIds: e.qualifications.map((q) => q.qualificationId),
      photoDataUrl: e.photoDataUrl,
      lastLoginAt: isAdmin ? e.user?.lastLoginAt?.toISOString() ?? null : null,
      totpEnabled: !!e.user?.totpEnabled,
      anonymized: !!e.anonymizedAt,
      monthPlanned: (hours.get(e.id)?.activePlanned ?? 0) + (hours.get(e.id)?.sick ?? 0) + (hours.get(e.id)?.vacation ?? 0),
    }));
  return (
    <div>
      <PageHeader title={t("nav.employees")} subtitle={t("emp.subtitle", { n: rows.filter((r) => r.status === "AKTIV").length })} />
      <EmployeeManager rows={rows} objects={objects.map((o) => ({ id: o.id, name: o.name }))} qualifications={qualifications.map((q) => ({ id: q.id, name: q.name }))} isAdmin={isAdmin} />
    </div>
  );
}
