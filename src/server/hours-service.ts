import "server-only";
import { prisma } from "@/lib/db";
import { computeMonthHours, emptyMonthHours, shiftHours, type MonthHours } from "@/lib/hours";
import { berlinNow, monthRange } from "@/lib/time";
import { getSettings, hourRules } from "./settings";

/** Monatsstunden je Mitarbeiter – wird bei jedem Aufruf frisch aus Diensten/Abwesenheiten berechnet. */
export async function monthHoursFor(year: number, month: number, employeeIds?: string[]): Promise<Map<string, MonthHours>> {
  const settings = await getSettings();
  const { from, to } = monthRange(year, month);
  const rules = hourRules(settings, [year, month === 12 ? year + 1 : year]);
  const employees = await prisma.employee.findMany({ where: employeeIds ? { id: { in: employeeIds } } : {}, select: { id: true, targetHours: true } });
  const ids = employees.map((e) => e.id);
  const [assignments, absences] = await Promise.all([
    prisma.assignment.findMany({ where: { employeeId: { in: ids }, date: { gte: from, lte: to }, isDraft: false } }),
    prisma.absence.findMany({ where: { employeeId: { in: ids }, date: { gte: from, lte: to } } }),
  ]);
  const now = berlinNow();
  const map = new Map<string, MonthHours>();
  for (const e of employees) {
    const as = assignments.filter((a) => a.employeeId === e.id);
    const ab = absences.filter((a) => a.employeeId === e.id);
    map.set(e.id, as.length || ab.length ? computeMonthHours(e.targetHours, as, ab, rules, now) : emptyMonthHours(e.targetHours));
  }
  return map;
}

/** Planstunden inkl. Entwürfe (für den Auto-Planer und die Planungsansicht) */
export async function plannedHoursInclDrafts(year: number, month: number): Promise<Map<string, number>> {
  const settings = await getSettings();
  const { from, to } = monthRange(year, month);
  const rules = hourRules(settings, [year]);
  const rows = await prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, employeeId: { not: null }, status: { not: "CANCELLED" } } });
  const absences = await prisma.absence.findMany({ where: { date: { gte: from, lte: to } } });
  const map = new Map<string, number>();
  for (const a of rows) {
    if (a.status === "ABSENT") continue;
    const h = shiftHours(a.startAt, a.endAt, a.breakMinutes, rules).total;
    map.set(a.employeeId!, (map.get(a.employeeId!) ?? 0) + h);
  }
  for (const ab of absences) if (ab.hours) map.set(ab.employeeId, (map.get(ab.employeeId) ?? 0) + ab.hours);
  return map;
}
