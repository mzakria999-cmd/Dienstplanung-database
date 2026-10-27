import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { planMonth, rotationCode, type PlannerEmployee, type PlannerSlot } from "@/lib/scheduler";
import { addDays, dateKey, DAY_MS, isoWeekday, monthDays, monthRange, shiftWindow } from "@/lib/time";
import { holidayMap } from "@/lib/holidays";
import { AppError } from "./errors";
import { audit } from "./audit";
import { getSettings, ruleSettings } from "./settings";
import type { SessionUser } from "./session";
import { assertEditable, fullName, getPlan } from "./schedule";
import { plannedHoursInclDrafts } from "./hours-service";

export interface GenerationReport {
  templateName: string;
  generatedAt: string;
  slotsTotal: number;
  required: number;
  filled: number;
  unfilled: Array<{ date: string; shift: string; object: string; missing: number; reasons: string[] }>;
  hours: Array<{ employeeId: string; name: string; target: number; planned: number }>;
}

/**
 * MONATSDIENSTPLAN AUTOMATISCH ERSTELLEN
 * Lädt den Muster-Dienstplan, prüft Verfügbarkeit, freie Tage, bestehende Dienste, Sollstunden,
 * Überschneidungen und Ruhezeiten, weist geeignete Mitarbeiter zu und markiert unbesetzte Schichten.
 * Ergebnis wird als ENTWURF gespeichert und muss vom Administrator freigegeben werden.
 */
export async function generateMonth(templateId: string, year: number, month: number, actor: SessionUser): Promise<GenerationReport> {
  const template = await prisma.shiftTemplate.findUnique({ where: { id: templateId }, include: { items: { include: { shiftType: true, object: true } }, members: true } });
  if (!template) throw new AppError("Muster-Dienstplan nicht gefunden", "Template not found");
  const { from, to } = monthRange(year, month);
  await assertEditable(from);
  const plan = await getPlan(year, month);
  if (plan.status === "PUBLISHED") throw new AppError("Der Monat ist bereits veröffentlicht. Änderungen bitte direkt im Dienstplan vornehmen.", "This month is already published. Please edit the roster directly.");

  const settings = await getSettings();
  const rs = ruleSettings(settings);
  const holidays = holidayMap([year], settings.bundesland);
  const shiftTypes = await prisma.shiftType.findMany({ where: { active: true } });
  const byCode = new Map(shiftTypes.map((s) => [s.code, s]));

  // vorherigen Entwurf verwerfen (Neuberechnung)
  await prisma.assignment.deleteMany({ where: { date: { gte: from, lte: to }, isDraft: true } });

  const days = monthDays(year, month);
  type SlotDef = { date: Date; shiftTypeId: string; objectId: string; required: number; presets: string[] };
  const defs = new Map<string, SlotDef>();
  const addDef = (date: Date, shiftTypeId: string, objectId: string, required: number, preset?: string) => {
    const key = `${dateKey(date)}|${shiftTypeId}|${objectId}`;
    const d = defs.get(key) ?? { date, shiftTypeId, objectId, required: 0, presets: [] };
    if (preset) {
      d.presets.push(preset);
      d.required = Math.max(d.required, d.presets.length);
    } else d.required = Math.max(d.required, required);
    defs.set(key, d);
  };

  for (const day of days) {
    if (template.skipHolidays && holidays.has(dateKey(day))) continue;
    for (const item of template.items) {
      if (template.type === "DAILY" || template.type === "ROTATION") addDef(day, item.shiftTypeId, item.objectId, item.requiredCount);
      else if (template.type === "WEEKLY" && item.dayKey === isoWeekday(day)) addDef(day, item.shiftTypeId, item.objectId, item.requiredCount);
      else if (template.type === "MONTHLY" && item.dayKey === day.getUTCDate()) addDef(day, item.shiftTypeId, item.objectId, item.requiredCount);
    }
    if (template.type === "ROTATION" && template.objectId && template.rotationStart) {
      for (const m of template.members) {
        const code = rotationCode(template.rotationPattern, dateKey(template.rotationStart), dateKey(day), m.offset);
        const st = byCode.get(code);
        if (st) addDef(day, st.id, template.objectId, 1, m.employeeId);
      }
    }
  }

  // bestehende Besetzungen zählen
  const existing = await prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, status: "PLANNED", isDraft: false } });
  const stById = new Map(shiftTypes.map((s) => [s.id, s]));
  const slots: PlannerSlot[] = [...defs.values()].map((d) => {
    const st = stById.get(d.shiftTypeId)!;
    const w = shiftWindow(d.date, st.startTime, st.endTime);
    return {
      date: dateKey(d.date),
      shiftTypeId: st.id,
      shiftCode: st.code,
      objectId: d.objectId,
      startAt: w.startAt,
      endAt: w.endAt,
      breakMinutes: st.breakMinutes,
      required: d.required,
      alreadyAssigned: existing.filter((e) => e.employeeId && dateKey(e.date) === dateKey(d.date) && e.shiftTypeId === st.id && e.objectId === d.objectId).length,
      presetEmployeeIds: d.presets,
    };
  });

  // Mitarbeiterdaten
  const span = (settings.maxConsecutiveDays + 1) * DAY_MS;
  const [employees, required, absences, availability, windows, sickLeaves, planned] = await Promise.all([
    prisma.employee.findMany({ where: { status: "AKTIV" }, include: { objectQualifications: true, qualifications: true } }),
    prisma.objectRequiredQualification.findMany(),
    prisma.absence.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.availability.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.assignment.findMany({ where: { status: "PLANNED", employeeId: { not: null }, startAt: { lt: new Date(to.getTime() + DAY_MS + span) }, endAt: { gt: new Date(from.getTime() - span) } }, include: { shiftType: true } }),
    prisma.sickLeave.findMany({ where: { revokedAt: null, fromDate: { lte: to }, toDate: { gte: from } } }),
    plannedHoursInclDrafts(year, month),
  ]);
  const absentShifts = await prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, status: { in: ["SICK", "VACATION", "ABSENT"] }, employeeId: { not: null } }, select: { employeeId: true, date: true } });

  const objectIds = new Set(slots.map((s) => s.objectId));
  const pe: PlannerEmployee[] = employees.map((e) => {
    const qualifiedObjectIds = new Set<string>();
    for (const oid of objectIds) {
      const hasObject = e.primaryObjectId === oid || e.objectQualifications.some((q) => q.objectId === oid);
      const req = required.filter((r) => r.objectId === oid);
      const hasQuals = req.every((r) => e.qualifications.some((q) => q.qualificationId === r.qualificationId && (!q.validUntil || q.validUntil >= from)));
      if (hasObject && hasQuals) qualifiedObjectIds.add(oid);
    }
    const blockedDates = new Set<string>();
    const blockedShifts = new Set<string>();
    const preferredOff = new Set<string>();
    for (const a of absences.filter((x) => x.employeeId === e.id)) {
      if (a.type === "DAY_OFF") preferredOff.add(dateKey(a.date));
      else blockedDates.add(dateKey(a.date));
    }
    for (const a of availability.filter((x) => x.employeeId === e.id)) {
      if (a.type === "UNAVAILABLE") {
        if (a.shiftCode) blockedShifts.add(`${dateKey(a.date)}|${a.shiftCode}`);
        else blockedDates.add(dateKey(a.date));
      } else if (a.type === "PREFERRED_OFF") preferredOff.add(dateKey(a.date));
    }
    for (const sl of sickLeaves.filter((x) => x.employeeId === e.id)) for (let d = sl.fromDate; d <= sl.toDate; d = addDays(d, 1)) blockedDates.add(dateKey(d));
    // Tage mit Krank/Urlaub/Fehltag-Diensten blockieren
    for (const a of absentShifts) if (a.employeeId === e.id) blockedDates.add(dateKey(a.date));
    return {
      id: e.id,
      name: fullName(e),
      targetHours: e.targetHours,
      employmentType: e.employmentType,
      allowedShiftCodes: e.allowedShiftCodes,
      qualifiedObjectIds,
      primaryObjectId: e.primaryObjectId,
      blockedDates,
      blockedShifts,
      preferredOff,
      existing: windows.filter((w) => w.employeeId === e.id).map((w) => ({ id: w.id, date: dateKey(w.date), startAt: w.startAt, endAt: w.endAt, breakMinutes: w.breakMinutes, code: w.shiftType.code })),
      plannedHours: planned.get(e.id) ?? 0,
    };
  });

  const result = planMonth(slots, pe, rs);

  // Entwurf speichern
  const data: Prisma.AssignmentCreateManyInput[] = result.assignments.map((a) => {
    const s = slots[a.slotIndex];
    return { date: new Date(`${s.date}T00:00:00Z`), shiftTypeId: s.shiftTypeId, objectId: s.objectId, employeeId: a.employeeId, startAt: s.startAt, endAt: s.endAt, breakMinutes: s.breakMinutes, source: "GENERATED", isDraft: true };
  });
  for (const u of result.unfilled) {
    const s = slots[u.slotIndex];
    for (let i = 0; i < u.missing; i++) data.push({ date: new Date(`${s.date}T00:00:00Z`), shiftTypeId: s.shiftTypeId, objectId: s.objectId, employeeId: null, startAt: s.startAt, endAt: s.endAt, breakMinutes: s.breakMinutes, source: "GENERATED", isDraft: true });
  }
  if (data.length) await prisma.assignment.createMany({ data });

  const objects = await prisma.securityObject.findMany({ where: { id: { in: [...objectIds] } } });
  const objName = new Map(objects.map((o) => [o.id, o.name]));
  const report: GenerationReport = {
    templateName: template.name,
    generatedAt: new Date().toISOString(),
    slotsTotal: slots.length,
    required: slots.reduce((a, s) => a + Math.max(0, s.required - s.alreadyAssigned), 0),
    filled: result.assignments.length,
    unfilled: result.unfilled.map((u) => {
      const s = slots[u.slotIndex];
      return { date: s.date, shift: s.shiftCode, object: objName.get(s.objectId) ?? "", missing: u.missing, reasons: u.reasons };
    }),
    hours: pe
      .filter((e) => e.plannedHours > 0)
      .map((e) => ({ employeeId: e.id, name: e.name, target: e.targetHours, planned: Math.round(e.plannedHours * 100) / 100 }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { status: "PENDING_APPROVAL", generationReport: report as unknown as Prisma.InputJsonValue } });
  await audit(actor.id, "SCHEDULE_GENERATE", "MonthPlan", plan.id, { templateId, year, month, filled: report.filled, unfilled: report.unfilled.length });
  return report;
}

/** Entwurf freigeben – erst danach kann veröffentlicht werden */
export async function approveGenerated(year: number, month: number, actor: SessionUser) {
  const { from, to } = monthRange(year, month);
  const n = await prisma.assignment.updateMany({ where: { date: { gte: from, lte: to }, isDraft: true }, data: { isDraft: false } });
  const plan = await getPlan(year, month);
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { status: plan.status === "PUBLISHED" ? "PUBLISHED" : "APPROVED", approvedAt: new Date(), approvedById: actor.id } });
  await audit(actor.id, "SCHEDULE_APPROVE", "MonthPlan", plan.id, { count: n.count });
  return n.count;
}

export async function discardGenerated(year: number, month: number, actor: SessionUser) {
  const { from, to } = monthRange(year, month);
  const n = await prisma.assignment.deleteMany({ where: { date: { gte: from, lte: to }, isDraft: true } });
  const plan = await getPlan(year, month);
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { status: "DRAFT", generationReport: undefined } });
  await audit(actor.id, "SCHEDULE_DISCARD", "MonthPlan", plan.id, { count: n.count });
  return n.count;
}
