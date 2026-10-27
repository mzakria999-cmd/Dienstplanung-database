import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { MonthNav } from "@/components/month-nav";
import { nextMonth, dateKey, monthRange } from "@/lib/time";
import { TemplateManager } from "./template-manager";
import type { GenerationReport } from "@/server/generator";

export const metadata = { title: "Muster-Dienstplan" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(ADMIN);
  const { t } = await getT();
  const sp = await searchParams;
  const nm = nextMonth();
  const year = Number(sp.year) || nm.year;
  const month = Number(sp.month) || nm.month;
  const { from, to } = monthRange(year, month);
  const [templates, shiftTypes, objects, employees, plan, drafts] = await Promise.all([
    prisma.shiftTemplate.findMany({ include: { items: true, members: true }, orderBy: { name: "asc" } }),
    prisma.shiftType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.securityObject.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { status: "AKTIV" }, orderBy: { lastName: "asc" } }),
    prisma.monthPlan.findUnique({ where: { year_month: { year, month } } }),
    prisma.assignment.count({ where: { date: { gte: from, lte: to }, isDraft: true } }),
  ]);
  return (
    <div>
      <PageHeader title={t("nav.templates")} subtitle={t("tpl.subtitle")} actions={<MonthNav year={year} month={month} />} />
      <TemplateManager
        year={year}
        month={month}
        planStatus={plan?.status ?? "DRAFT"}
        drafts={drafts}
        report={(plan?.generationReport as unknown as GenerationReport | null) ?? null}
        templates={templates.map((x) => ({
          id: x.id,
          name: x.name,
          type: x.type,
          description: x.description,
          objectId: x.objectId,
          skipHolidays: x.skipHolidays,
          rotationPattern: x.rotationPattern,
          rotationStart: x.rotationStart ? dateKey(x.rotationStart) : null,
          items: x.items.map((i) => ({ dayKey: i.dayKey, shiftTypeId: i.shiftTypeId, objectId: i.objectId, requiredCount: i.requiredCount })),
          members: x.members.map((m) => ({ employeeId: m.employeeId, offset: m.offset })),
        }))}
        shiftTypes={shiftTypes.map((s) => ({ id: s.id, code: s.code, label: `${s.code} ${s.startTime}–${s.endTime}` }))}
        objects={objects.map((o) => ({ id: o.id, name: o.name, req: { F: o.requiredEarly, S: o.requiredLate, N: o.requiredNight } }))}
        employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))}
      />
    </div>
  );
}
