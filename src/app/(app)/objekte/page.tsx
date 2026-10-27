import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { ObjectManager } from "./object-manager";

export const metadata = { title: "Objektverwaltung" };
export const dynamic = "force-dynamic";

export default async function ObjectsPage() {
  await requirePageUser(ADMIN);
  const { t } = await getT();
  const [objects, employees, qualifications] = await Promise.all([
    prisma.securityObject.findMany({ include: { qualifiedEmployees: true, requiredQualifications: true, primaryEmployees: { where: { status: "AKTIV" } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.employee.findMany({ where: { status: "AKTIV" }, orderBy: { lastName: "asc" } }),
    prisma.qualification.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title={t("nav.objects")} subtitle={t("obj.subtitle")} />
      <ObjectManager
        objects={objects.map((o) => ({
          id: o.id,
          name: o.name,
          address: o.address,
          contactPerson: o.contactPerson,
          phone: o.phone,
          notes: o.notes,
          active: o.active,
          requiredEarly: o.requiredEarly,
          requiredLate: o.requiredLate,
          requiredNight: o.requiredNight,
          employeeIds: [...new Set([...o.qualifiedEmployees.map((q) => q.employeeId), ...o.primaryEmployees.map((p) => p.id)])],
          qualificationIds: o.requiredQualifications.map((q) => q.qualificationId),
        }))}
        employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))}
        qualifications={qualifications.map((q) => ({ id: q.id, name: q.name, description: q.description }))}
      />
    </div>
  );
}
