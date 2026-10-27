import "server-only";
import { prisma } from "@/lib/db";
import { holidayMap } from "@/lib/holidays";
import { addDays, berlinNow, dateKey, isoWeekday, monthDays, monthRange, parseDateKey, formatTime } from "@/lib/time";
import { getSettings } from "./settings";
import { monthHoursFor } from "./hours-service";
import type { MonthHours } from "@/lib/hours";

export interface CellItem {
  id: string;
  code: string;
  status: string;
  attendance: string;
  isChanged: boolean;
  isDraft: boolean;
  objectId: string;
  objectName: string;
  start: string;
  end: string;
  note: string | null;
  replacesName: string | null;
}

export interface GridData {
  year: number;
  month: number;
  days: Array<{ key: string; day: number; dow: number; weekend: boolean; holiday: string | null; today: boolean }>;
  employees: Array<{ id: string; name: string; pnr: string; phone: string; primaryObjectId: string | null; hours: Pick<MonthHours, "target" | "planned" | "activePlanned" | "actual" | "sick" | "vacation" | "remainingToPlan" | "overtime"> }>;
  cells: Record<string, Record<string, CellItem[]>>;
  absences: Record<string, Record<string, string>>;
  open: Record<string, CellItem[]>;
  coverage: Record<string, { F: number; S: number; N: number; reqF: number; reqS: number; reqN: number }>;
  shiftTypes: Array<{ id: string; code: string; nameDe: string; nameEn: string; startTime: string; endTime: string; color: string }>;
  objects: Array<{ id: string; name: string }>;
  plan: { status: string; version: number; archived: boolean; publishedAt: string | null; drafts: number };
}

function toCell(a: { id: string; status: string; attendance: string; isChanged: boolean; isDraft: boolean; objectId: string; startAt: Date; endAt: Date; changeNote: string | null; shiftType: { code: string }; object: { name: string }; replacesAssignment?: { employee: { firstName: string; lastName: string } | null } | null }): CellItem {
  return {
    id: a.id,
    code: a.shiftType.code,
    status: a.status,
    attendance: a.attendance,
    isChanged: a.isChanged,
    isDraft: a.isDraft,
    objectId: a.objectId,
    objectName: a.object.name,
    start: formatTime(a.startAt),
    end: formatTime(a.endAt),
    note: a.changeNote,
    replacesName: a.replacesAssignment?.employee ? `${a.replacesAssignment.employee.firstName} ${a.replacesAssignment.employee.lastName}` : null,
  };
}

export async function monthGrid(year: number, month: number, objectId?: string | null): Promise<GridData> {
  const settings = await getSettings();
  const { from, to } = monthRange(year, month);
  const holidays = holidayMap([year], settings.bundesland);
  const today = dateKey(berlinNow());
  const objFilter = objectId ? { objectId } : {};
  const [assignments, absences, objects, shiftTypes, plan] = await Promise.all([
    prisma.assignment.findMany({
      where: { date: { gte: from, lte: to }, ...objFilter },
      include: { shiftType: true, object: true, replacesAssignment: { include: { employee: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.absence.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.securityObject.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.shiftType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.monthPlan.findUnique({ where: { year_month: { year, month } } }),
  ]);
  const empIdsWithShifts = new Set(assignments.map((a) => a.employeeId).filter(Boolean) as string[]);
  const employees = await prisma.employee.findMany({
    where: objectId
      ? { OR: [{ id: { in: [...empIdsWithShifts] } }, { status: "AKTIV", OR: [{ primaryObjectId: objectId }, { objectQualifications: { some: { objectId } } }] }] }
      : { OR: [{ status: "AKTIV" }, { id: { in: [...empIdsWithShifts] } }] },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const hours = await monthHoursFor(year, month, employees.map((e) => e.id));

  const cells: GridData["cells"] = {};
  const open: GridData["open"] = {};
  for (const a of assignments) {
    const k = dateKey(a.date);
    if (!a.employeeId) (open[k] ??= []).push(toCell(a));
    else ((cells[a.employeeId] ??= {})[k] ??= []).push(toCell(a));
  }
  const abs: GridData["absences"] = {};
  for (const a of absences) (abs[a.employeeId] ??= {})[dateKey(a.date)] = a.type === "SICK" ? "K" : a.type === "VACATION" ? "U" : a.type === "UNEXCUSED" ? "FT" : "W";

  const reqObjects = objectId ? objects.filter((o) => o.id === objectId) : objects;
  const req = reqObjects.reduce((acc, o) => ({ F: acc.F + o.requiredEarly, S: acc.S + o.requiredLate, N: acc.N + o.requiredNight }), { F: 0, S: 0, N: 0 });
  const coverage: GridData["coverage"] = {};
  for (const d of monthDays(year, month)) coverage[dateKey(d)] = { F: 0, S: 0, N: 0, reqF: req.F, reqS: req.S, reqN: req.N };
  for (const a of assignments) if (a.employeeId && a.status === "PLANNED") coverage[dateKey(a.date)][a.shiftType.code as "F"]++;

  return {
    year,
    month,
    days: monthDays(year, month).map((d) => ({ key: dateKey(d), day: d.getUTCDate(), dow: isoWeekday(d), weekend: isoWeekday(d) >= 6, holiday: holidays.get(dateKey(d)) ?? null, today: dateKey(d) === today })),
    employees: employees.map((e) => {
      const h = hours.get(e.id)!;
      return { id: e.id, name: `${e.lastName}, ${e.firstName}`, pnr: e.personnelNumber, phone: e.phone, primaryObjectId: e.primaryObjectId, hours: { target: h.target, planned: h.planned, activePlanned: h.activePlanned, actual: h.actual, sick: h.sick, vacation: h.vacation, remainingToPlan: h.remainingToPlan, overtime: h.overtime } };
    }),
    cells,
    absences: abs,
    open,
    coverage,
    shiftTypes: shiftTypes.map((s) => ({ id: s.id, code: s.code, nameDe: s.nameDe, nameEn: s.nameEn, startTime: s.startTime, endTime: s.endTime, color: s.color })),
    objects: objects.map((o) => ({ id: o.id, name: o.name })),
    plan: {
      status: plan?.status ?? "DRAFT",
      version: plan?.version ?? 0,
      archived: plan?.archived ?? false,
      publishedAt: plan?.publishedAt?.toISOString() ?? null,
      drafts: assignments.filter((a) => a.isDraft).length,
    },
  };
}

export interface DayEntry {
  id: string;
  date: string;
  code: string;
  shiftName: string;
  start: string;
  end: string;
  object: string;
  status: string;
  attendance: string;
  isChanged: boolean;
  employee: { id: string; name: string; phone: string; email: string; pnr: string } | null;
  running: boolean;
  actualStart: string | null;
  actualEnd: string | null;
  replacesName: string | null;
}

/** Dienste in einem Zeitraum (optional nach Schichtart/Objekt), für Tagesansicht & Schicht-Seiten */
export async function shiftEntries(from: Date, to: Date, opts: { code?: string; objectId?: string | null; includeOpen?: boolean } = {}): Promise<DayEntry[]> {
  const now = berlinNow();
  const rows = await prisma.assignment.findMany({
    where: {
      date: { gte: from, lte: to },
      isDraft: false,
      shiftType: opts.code ? { code: opts.code } : undefined,
      objectId: opts.objectId || undefined,
      employeeId: opts.includeOpen ? undefined : { not: null },
    },
    include: { shiftType: true, object: true, employee: true, replacesAssignment: { include: { employee: true } } },
    orderBy: [{ startAt: "asc" }, { employee: { lastName: "asc" } }],
  });
  return rows.map((a) => ({
    id: a.id,
    date: dateKey(a.date),
    code: a.shiftType.code,
    shiftName: a.shiftType.nameDe,
    start: formatTime(a.startAt),
    end: formatTime(a.endAt),
    object: a.object.name,
    status: a.status,
    attendance: a.attendance,
    isChanged: a.isChanged,
    employee: a.employee ? { id: a.employee.id, name: `${a.employee.firstName} ${a.employee.lastName}`, phone: a.employee.phone, email: a.employee.email, pnr: a.employee.personnelNumber } : null,
    running: a.status === "PLANNED" && !!a.employeeId && a.startAt <= now && a.endAt > now,
    actualStart: a.actualStartAt ? formatTime(a.actualStartAt) : null,
    actualEnd: a.actualEndAt ? formatTime(a.actualEndAt) : null,
    replacesName: a.replacesAssignment?.employee ? `${a.replacesAssignment.employee.firstName} ${a.replacesAssignment.employee.lastName}` : null,
  }));
}

/** Mitarbeiter, die an einem Tag frei & verfügbar sind */
export async function availableEmployees(day: Date) {
  const [emps, busy, absent, unavailable] = await Promise.all([
    prisma.employee.findMany({ where: { status: "AKTIV", availableForReplacement: true }, orderBy: { lastName: "asc" } }),
    prisma.assignment.findMany({ where: { date: day, employeeId: { not: null }, isDraft: false }, select: { employeeId: true } }),
    prisma.absence.findMany({ where: { date: day, type: { in: ["SICK", "VACATION", "UNEXCUSED"] } }, select: { employeeId: true } }),
    prisma.availability.findMany({ where: { date: day, type: "UNAVAILABLE", shiftCode: null }, select: { employeeId: true } }),
  ]);
  const blocked = new Set([...busy, ...absent, ...unavailable].map((x) => x.employeeId));
  return emps.filter((e) => !blocked.has(e.id)).map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, phone: e.phone, email: e.email, pnr: e.personnelNumber }));
}

export async function dashboardData() {
  const now = berlinNow();
  const today = parseDateKey(dateKey(now));
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const { from, to } = monthRange(year, month);
  const weekEnd = addDays(today, 6);
  const [todayEntries, yesterdayNight, available, openSlots, pendingRequests, acceptedOffers, scheduledAnn, objects, weekAssignments, sickToday, hours] = await Promise.all([
    shiftEntries(today, today, { includeOpen: true }),
    shiftEntries(addDays(today, -1), addDays(today, -1), { code: "N" }),
    availableEmployees(today),
    prisma.assignment.findMany({ where: { employeeId: null, isDraft: false, date: { gte: today, lte: addDays(today, 13) } }, include: { shiftType: true, object: true, replacesAssignment: { include: { employee: true } } }, orderBy: { startAt: "asc" }, take: 20 }),
    prisma.changeRequest.count({ where: { status: "OPEN" } }),
    prisma.shiftOffer.count({ where: { status: "ACCEPTED" } }),
    prisma.announcement.count({ where: { status: "SCHEDULED" } }),
    prisma.securityObject.findMany({ where: { active: true } }),
    prisma.assignment.findMany({ where: { date: { gte: today, lte: weekEnd }, isDraft: false, status: "PLANNED", employeeId: { not: null } }, include: { shiftType: true } }),
    prisma.assignment.findMany({ where: { date: today, status: "SICK" }, include: { employee: true, shiftType: true } }),
    monthHoursFor(year, month),
  ]);
  const active = todayEntries.filter((e) => e.employee && e.status === "PLANNED");
  const running = [...active, ...yesterdayNight.filter((e) => e.running)].filter((e) => e.running);
  const sickAbs = await prisma.absence.findMany({ where: { date: today, type: "SICK" }, include: { employee: true } });
  const sickNames = [...new Set([...sickToday.map((s) => `${s.employee!.firstName} ${s.employee!.lastName}`), ...sickAbs.map((a) => `${a.employee.firstName} ${a.employee.lastName}`)])];

  const req = objects.reduce((acc, o) => ({ F: acc.F + o.requiredEarly, S: acc.S + o.requiredLate, N: acc.N + o.requiredNight }), { F: 0, S: 0, N: 0 });
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const k = dateKey(d);
    const list = weekAssignments.filter((a) => dateKey(a.date) === k);
    const c = (code: string) => list.filter((a) => a.shiftType.code === code).length;
    return { key: k, F: c("F"), S: c("S"), N: c("N"), req };
  });
  const missingToday = (["F", "S", "N"] as const).reduce((acc, code) => acc + Math.max(0, req[code] - active.filter((e) => e.code === code).length), 0);

  let planned = 0;
  let actual = 0;
  let target = 0;
  for (const h of hours.values()) {
    planned += h.activePlanned + h.sick + h.vacation;
    actual += h.actual;
    target += h.target;
  }
  return {
    today: dateKey(today),
    counts: { F: active.filter((e) => e.code === "F").length, S: active.filter((e) => e.code === "S").length, N: active.filter((e) => e.code === "N").length },
    running,
    scheduledToday: active,
    sick: sickNames,
    available,
    openSlots: openSlots.map((o) => ({ id: o.id, date: dateKey(o.date), code: o.shiftType.code, start: formatTime(o.startAt), end: formatTime(o.endAt), object: o.object.name, replaces: o.replacesAssignment?.employee ? `${o.replacesAssignment.employee.firstName} ${o.replacesAssignment.employee.lastName}` : null })),
    upcoming: active.filter((e) => !e.running && e.start >= formatTime(now)).slice(0, 8),
    pending: { requests: pendingRequests, offers: acceptedOffers, announcements: scheduledAnn },
    week,
    missingToday,
    month: { year, month, planned: Math.round(planned), actual: Math.round(actual), target: Math.round(target) },
  };
}

export async function employeeDashboard(employeeId: string) {
  const now = berlinNow();
  const today = parseDateKey(dateKey(now));
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const publishedMonths = await prisma.monthPlan.findMany({ where: { status: "PUBLISHED" }, select: { year: true, month: true } });
  const isPub = (d: Date) => publishedMonths.some((p) => p.year === d.getUTCFullYear() && p.month === d.getUTCMonth() + 1);
  const upcoming = (
    await prisma.assignment.findMany({
      where: { employeeId, isDraft: false, endAt: { gt: now }, status: "PLANNED" },
      include: { shiftType: true, object: true },
      orderBy: { startAt: "asc" },
      take: 20,
    })
  )
    .filter((a) => isPub(a.date))
    .slice(0, 6);
  const hours = (await monthHoursFor(year, month, [employeeId])).get(employeeId)!;
  const [offers, unackd] = await Promise.all([
    prisma.shiftOffer.count({ where: { employeeId, status: "OFFERED", assignment: { employeeId: null } } }),
    prisma.announcementRecipient.findMany({ where: { employeeId, acknowledgedAt: null, announcement: { requireAck: true } }, include: { announcement: true }, take: 5 }),
  ]);
  return {
    upcoming: upcoming.map((a) => ({ id: a.id, date: dateKey(a.date), code: a.shiftType.code, name: a.shiftType.nameDe, nameEn: a.shiftType.nameEn, start: formatTime(a.startAt), end: formatTime(a.endAt), object: a.object.name, changed: a.isChanged })),
    hours,
    offers,
    unackd: unackd.map((r) => ({ id: r.announcementId, subject: r.announcement.subject, priority: r.announcement.priority })),
    year,
    month,
  };
}
