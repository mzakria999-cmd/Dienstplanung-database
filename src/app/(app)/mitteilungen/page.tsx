import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { AnnouncementEditor } from "./editor";

export const metadata = { title: "Mitteilungen & Ankündigungen" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requirePageUser(ADMIN);
  const { t } = await getT();
  const [employees, objects] = await Promise.all([
    prisma.employee.findMany({ where: { status: "AKTIV" }, orderBy: { lastName: "asc" } }),
    prisma.securityObject.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title={t("nav.announcements")} subtitle={t("ann.subtitle")} />
      <AnnouncementEditor employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}`, pnr: e.personnelNumber }))} objects={objects.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}
