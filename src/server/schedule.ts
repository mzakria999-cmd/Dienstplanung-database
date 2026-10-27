import "server-only";
import type { Assignment, AssignmentStatus, ChangeType, Employee, Prisma, SecurityObject, ShiftType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkConflicts, type RuleIssue, type TimeWindow } from "@/lib/rules";
import { addDays, dateKey, DAY_MS, durationHours, formatDate, formatTime, monthRange, parseDateKey, round2, shiftWindow } from "@/lib/time";
import { AppError } from "./errors";
import { getSettings, ruleSettings, appUrl } from "./settings";
import type { SessionUser } from "./session";
import { audit } from "./audit";
import { notifyEmployees } from "./notify";
import { queueEmail, sendMany } from "./mail";
import { genericChangeMail, newShiftMail, sickChangeMail, type ShiftInfo } from "./email-templates";
import { renderEmployeeSchedulePdf } from "./pdf/render";

export const assignmentInclude = { shiftType: true, object: true, employee: true } satisfies Prisma.AssignmentInclude;
export type FullAssignment = Assignment & { shiftType: ShiftType; object: SecurityObject; employee: Employee | null };

export const fullName = (e: { firstName: string; lastName: string } | null | undefined) => (e ? `${e.firstName} ${e.lastName}` : "—");

// ------------------------------------------------------------------ Monatsplan

export async function getPlan(year: number, month: number) {
  return prisma.monthPlan.upsert({ where: { year_month: { year, month } }, update: {}, create: { year, month } });
}

const ym = (d: Date) => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });

export async function isPublishedDate(date: Date): Promise<boolean> {
  const { year, month } = ym(date);
  const plan = await prisma.monthPlan.findUnique({ where: { year_month: { year, month } } });
  return plan?.status === "PUBLISHED";
}

export async function assertEditable(date: Date) {
  const { year, month } = ym(date);
  const plan = await prisma.monthPlan.findUnique({ where: { year_month: { year, month } } });
  if (plan?.archived) throw new AppError("Dieser Monat ist archiviert und kann nicht mehr geändert werden.", "This month is archived and can no longer be changed.");
}

// ------------------------------------------------------------------ Konfliktprüfung

export async function activeWindows(employeeId: string, from: Date, to: Date, excludeIds: string[] = []): Promise<TimeWindow[]> {
  const rows = await prisma.assignment.findMany({
    where: {
      employeeId,
      status: "PLANNED",
      attendance: { not: "NO_SHOW" },
      startAt: { lt: to },
      endAt: { gt: from },
      id: excludeIds.length ? { notIn: excludeIds } : undefined,
    },
    include: { shiftType: true },
  });
  return rows.map((r) => ({ id: r.id, date: dateKey(r.date), startAt: r.startAt, endAt: r.endAt, breakMinutes: r.breakMinutes, code: r.shiftType.code }));
}

export async function conflictsFor(employeeId: string, date: Date, startAt: Date, endAt: Date, breakMinutes: number, excludeIds: string[] = []): Promise<RuleIssue[]> {
  const s = await getSettings();
  const span = (s.maxConsecutiveDays + 1) * DAY_MS;
  const windows = await activeWindows(employeeId, new Date(startAt.getTime() - span), new Date(endAt.getTime() + span), excludeIds);
  const issues = checkConflicts({ date: dateKey(date), startAt, endAt, breakMinutes }, windows, ruleSettings(s));
  const unavailable = await prisma.availability.findFirst({ where: { employeeId, date, type: "UNAVAILABLE" } });
  if (unavailable) issues.push({ code: "DOUBLE_DAY", severity: "warning", message: "Mitarbeiter hat sich für diesen Tag als nicht verfügbar gemeldet" });
  const absence = await prisma.absence.findFirst({ where: { employeeId, date, type: { in: ["SICK", "VACATION", "UNEXCUSED"] } } });
  if (absence) issues.push({ code: "OVERLAP", severity: "error", message: absence.type === "SICK" ? "Mitarbeiter ist an diesem Tag krank gemeldet" : absence.type === "VACATION" ? "Mitarbeiter hat an diesem Tag Urlaub" : "Fehltag eingetragen" });
  return issues;
}

function raiseIfBlocked(issues: RuleIssue[], force: boolean) {
  const blocking = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (blocking.length && !force) throw new AppError(`Konflikt: ${blocking.map((i) => i.message).join("; ")}`, `Conflict: ${blocking.map((i) => i.message).join("; ")}`, { issues, needsForce: true });
  if (warnings.length && !force) throw new AppError(`Warnung: ${warnings.map((i) => i.message).join("; ")}`, `Warning: ${warnings.map((i) => i.message).join("; ")}`, { issues, needsForce: true });
}

// ------------------------------------------------------------------ Änderungshistorie

export interface ChangeRecordInput {
  type: ChangeType;
  assignment: FullAssignment;
  originalEmployee?: Employee | null;
  newEmployee?: Employee | null;
  originalStartAt?: Date | null;
  originalEndAt?: Date | null;
  reason?: string;
  actor: SessionUser | null;
  notify: boolean;
}

export async function recordChange(c: ChangeRecordInput) {
  const a = c.assignment;
  return prisma.scheduleChange.create({
    data: {
      assignmentId: a.id,
      type: c.type,
      date: a.date,
      shiftCode: a.shiftType.code,
      shiftName: a.shiftType.nameDe,
      objectName: a.object.name,
      originalEmployeeId: c.originalEmployee?.id ?? null,
      originalEmployeeName: c.originalEmployee ? fullName(c.originalEmployee) : null,
      newEmployeeId: c.newEmployee?.id ?? null,
      newEmployeeName: c.newEmployee ? fullName(c.newEmployee) : null,
      originalStartAt: c.originalStartAt ?? null,
      originalEndAt: c.originalEndAt ?? null,
      newStartAt: a.startAt,
      newEndAt: a.endAt,
      originalHours: c.originalStartAt && c.originalEndAt ? durationHours(c.originalStartAt, c.originalEndAt, a.breakMinutes) : durationHours(a.startAt, a.endAt, a.breakMinutes),
      reason: c.reason ?? "",
      changedById: c.actor?.id ?? null,
      changedByName: c.actor?.name ?? "System",
      notificationStatus: c.notify ? "PENDING" : "NOT_REQUIRED",
    },
  });
}

export function shiftInfo(a: FullAssignment, locale: "de" | "en" = "de"): ShiftInfo {
  return {
    date: a.date,
    shiftName: locale === "de" ? a.shiftType.nameDe : a.shiftType.nameEn,
    start: formatTime(a.startAt),
    end: formatTime(a.endAt),
    objectName: a.object.name,
  };
}

export type ChangeNotice =
  | { kind: "new"; employeeId: string; assignment: FullAssignment; note?: string }
  | { kind: "sick"; employeeId: string; assignment: FullAssignment }
  | { kind: "line"; employeeId: string; assignment: FullAssignment; de: string; en: string };

/**
 * Benachrichtigt betroffene Mitarbeiter über Änderungen eines veröffentlichten Plans:
 * App-Benachrichtigung + E-Mail mit aktualisiertem Dienstplan-PDF. Aktualisiert den Benachrichtigungsstatus.
 */
export async function notifyChanges(notices: ChangeNotice[], changeIds: string[]) {
  if (notices.length === 0) {
    if (changeIds.length) await prisma.scheduleChange.updateMany({ where: { id: { in: changeIds } }, data: { notificationStatus: "NOT_REQUIRED" } });
    return;
  }
  const settings = await getSettings();
  const byEmp = new Map<string, ChangeNotice[]>();
  for (const n of notices) byEmp.set(n.employeeId, [...(byEmp.get(n.employeeId) ?? []), n]);
  const emailIds: string[] = [];
  for (const [employeeId, list] of byEmp) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
    if (!emp || emp.status !== "AKTIV") continue;
    const locale = emp.user?.locale ?? "de";
    const first = list[0].assignment;
    const { year, month } = ym(first.date);
    const link = appUrl(`/mein-dienstplan?year=${year}&month=${month}`);
    let mail;
    if (list.length === 1 && list[0].kind === "new") mail = newShiftMail(locale, settings, shiftInfo(list[0].assignment, locale), link, list[0].note);
    else if (list.every((n) => n.kind === "sick")) mail = sickChangeMail(locale, settings, list.map((n) => shiftInfo(n.assignment, locale)), link);
    else
      mail = genericChangeMail(
        locale,
        settings,
        list.map((n) => {
          const si = shiftInfo(n.assignment, locale);
          const base = `${formatDate(si.date, locale)} ${si.shiftName} ${si.start}–${si.end} (${si.objectName})`;
          if (n.kind === "new") return locale === "de" ? `Neuer Dienst: ${base}` : `New shift: ${base}`;
          if (n.kind === "sick") return locale === "de" ? `${base}: Krank / Nicht gearbeitet` : `${base}: sick / not worked`;
          return `${base}: ${locale === "de" ? n.de : n.en}`;
        }),
        link,
      );
    await notifyEmployees([employeeId], {
      type: list.some((n) => n.kind === "new") ? "SHIFT_TAKEOVER" : "SCHEDULE_CHANGED",
      title: locale === "de" ? "Dienstplanänderung" : "Roster change",
      body: list.map((n) => `${formatDate(n.assignment.date, locale)} ${locale === "de" ? n.assignment.shiftType.nameDe : n.assignment.shiftType.nameEn}`).join(", "),
      link: `/mein-dienstplan?year=${year}&month=${month}`,
    });
    if (emp.email) {
      const pdf = await renderEmployeeSchedulePdf(emp.id, year, month, locale);
      const log = await queueEmail({ ...mail, to: emp.email, employeeId: emp.id, attachment: pdf.buffer, attachmentName: pdf.filename });
      emailIds.push(log.id);
    }
  }
  const results = await sendMany(emailIds);
  const allOk = [...results.values()].every((r) => r.ok);
  const anyOk = [...results.values()].some((r) => r.ok);
  await prisma.scheduleChange.updateMany({
    where: { id: { in: changeIds } },
    data: { notificationStatus: emailIds.length === 0 ? "SENT" : allOk ? "SENT" : anyOk ? "PARTIAL" : "FAILED" },
  });
}

// ------------------------------------------------------------------ CRUD

export interface AssignmentInput {
  date: string;
  shiftTypeId: string;
  objectId: string;
  employeeId: string | null;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  note?: string;
  force?: boolean;
}

async function windowFor(input: { date: string; shiftTypeId: string; startTime?: string; endTime?: string; breakMinutes?: number }) {
  const st = await prisma.shiftType.findUnique({ where: { id: input.shiftTypeId } });
  if (!st) throw new AppError("Schichtart nicht gefunden", "Shift type not found");
  const { startAt, endAt } = shiftWindow(input.date, input.startTime || st.startTime, input.endTime || st.endTime);
  return { st, startAt, endAt, breakMinutes: input.breakMinutes ?? st.breakMinutes };
}

export async function createAssignment(input: AssignmentInput, actor: SessionUser, source: "MANUAL" | "COPY" = "MANUAL") {
  const date = parseDateKey(input.date);
  await assertEditable(date);
  const { startAt, endAt, breakMinutes } = await windowFor(input);
  if (input.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!emp || emp.status !== "AKTIV") throw new AppError("Mitarbeiter ist nicht aktiv", "Employee is not active");
    raiseIfBlocked(await conflictsFor(input.employeeId, date, startAt, endAt, breakMinutes), !!input.force);
  }
  const published = await isPublishedDate(date);
  const a = await prisma.assignment.create({
    data: {
      date,
      shiftTypeId: input.shiftTypeId,
      objectId: input.objectId,
      employeeId: input.employeeId,
      startAt,
      endAt,
      breakMinutes,
      source,
      isChanged: published && !!input.employeeId,
      changeNote: input.note || null,
    },
    include: assignmentInclude,
  });
  const change = await recordChange({ type: "CREATED", assignment: a, newEmployee: a.employee, actor, reason: input.note ?? "Dienst hinzugefügt", notify: published && !!a.employeeId });
  await audit(actor.id, "ASSIGNMENT_CREATE", "Assignment", a.id, { date: input.date, employeeId: input.employeeId, force: !!input.force });
  if (published && a.employeeId) await notifyChanges([{ kind: "new", employeeId: a.employeeId, assignment: a }], [change.id]);
  return a;
}

export interface AssignmentUpdate {
  date?: string;
  employeeId?: string | null;
  shiftTypeId?: string;
  objectId?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  note?: string;
  force?: boolean;
}

export async function updateAssignment(id: string, upd: AssignmentUpdate, actor: SessionUser) {
  const old = await prisma.assignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!old) throw new AppError("Dienst nicht gefunden", "Shift not found");
  await assertEditable(old.date);
  const date = upd.date ?? dateKey(old.date);
  await assertEditable(parseDateKey(date));
  const shiftTypeId = upd.shiftTypeId ?? old.shiftTypeId;
  const timesChanged = upd.date || upd.shiftTypeId || upd.startTime || upd.endTime;
  const keepTimes = !upd.shiftTypeId && !upd.startTime && !upd.endTime;
  const { startAt, endAt, breakMinutes } = await windowFor({
    date,
    shiftTypeId,
    startTime: upd.startTime ?? (keepTimes ? formatTime(old.startAt) : undefined),
    endTime: upd.endTime ?? (keepTimes ? formatTime(old.endAt) : undefined),
    breakMinutes: upd.breakMinutes ?? (upd.shiftTypeId ? undefined : old.breakMinutes),
  });
  const employeeId = upd.employeeId === undefined ? old.employeeId : upd.employeeId;
  if (employeeId && old.status === "PLANNED") {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp || emp.status !== "AKTIV") throw new AppError("Mitarbeiter ist nicht aktiv", "Employee is not active");
    raiseIfBlocked(await conflictsFor(employeeId, parseDateKey(date), startAt, endAt, breakMinutes, [id]), !!upd.force);
  }
  const published = (await isPublishedDate(old.date)) || (await isPublishedDate(parseDateKey(date)));
  const a = await prisma.assignment.update({
    where: { id },
    data: {
      date: parseDateKey(date),
      shiftTypeId,
      objectId: upd.objectId ?? old.objectId,
      employeeId,
      startAt,
      endAt,
      breakMinutes,
      isChanged: old.isChanged || (published && !old.isDraft),
      changeNote: upd.note ?? old.changeNote,
    },
    include: assignmentInclude,
  });
  const empChanged = old.employeeId !== a.employeeId;
  const notify = published && !old.isDraft;
  const change = await recordChange({
    type: empChanged && !timesChanged ? "REPLACEMENT" : "MODIFIED",
    assignment: a,
    originalEmployee: old.employee,
    newEmployee: a.employee,
    originalStartAt: old.startAt,
    originalEndAt: old.endAt,
    reason: upd.note ?? (empChanged ? "Mitarbeiter getauscht" : "Dienst geändert"),
    actor,
    notify,
  });
  await audit(actor.id, "ASSIGNMENT_UPDATE", "Assignment", id, { ...upd, force: !!upd.force } as Prisma.InputJsonValue);
  if (notify) {
    const notices: ChangeNotice[] = [];
    if (a.employeeId) notices.push(empChanged ? { kind: "new", employeeId: a.employeeId, assignment: a } : { kind: "line", employeeId: a.employeeId, assignment: a, de: `geändert (vorher ${formatDate(old.date)} ${formatTime(old.startAt)}–${formatTime(old.endAt)})`, en: `changed (previously ${formatDate(old.date, "en")} ${formatTime(old.startAt)}–${formatTime(old.endAt)})` });
    if (empChanged && old.employeeId) notices.push({ kind: "line", employeeId: old.employeeId, assignment: old, de: "Dienst entfällt für Sie", en: "this shift has been removed from your roster" });
    await notifyChanges(notices, [change.id]);
  }
  return a;
}

export async function deleteAssignment(id: string, actor: SessionUser, reason = "Dienst entfernt") {
  const a = await prisma.assignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!a) throw new AppError("Dienst nicht gefunden", "Shift not found");
  await assertEditable(a.date);
  const published = (await isPublishedDate(a.date)) && !a.isDraft;
  const change = await recordChange({ type: "DELETED", assignment: a, originalEmployee: a.employee, originalStartAt: a.startAt, originalEndAt: a.endAt, reason, actor, notify: published && !!a.employeeId });
  await prisma.assignment.delete({ where: { id } });
  await audit(actor.id, "ASSIGNMENT_DELETE", "Assignment", id, { date: dateKey(a.date), employeeId: a.employeeId });
  if (published && a.employeeId) await notifyChanges([{ kind: "line", employeeId: a.employeeId, assignment: a, de: "Dienst entfällt", en: "shift cancelled" }], [change.id]);
}

/** Erstellt für einen ausgefallenen Dienst eine offene Schicht zur Neubesetzung */
export async function createOpenSlotFor(orig: Assignment, tx: Prisma.TransactionClient = prisma) {
  const existing = await tx.assignment.findUnique({ where: { replacesAssignmentId: orig.id } });
  if (existing) return existing;
  return tx.assignment.create({
    data: {
      date: orig.date,
      shiftTypeId: orig.shiftTypeId,
      objectId: orig.objectId,
      employeeId: null,
      startAt: orig.startAt,
      endAt: orig.endAt,
      breakMinutes: orig.breakMinutes,
      replacesAssignmentId: orig.id,
      source: "REPLACEMENT",
      isDraft: orig.isDraft,
    },
  });
}

export function dailyCreditHours(e: { targetHours: number }): number {
  return round2(e.targetHours / 21.75);
}

/**
 * Tageszelle im Monatsplan setzen: F/S/N (Schicht), FREI, FT (Fehltag), U (Urlaub).
 * K (Krank) wird über das Krankmeldungsmodul abgewickelt.
 */
export async function setDayCode(employeeId: string, day: string, code: string, objectId: string | null, actor: SessionUser, force = false) {
  const date = parseDateKey(day);
  await assertEditable(date);
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new AppError("Mitarbeiter nicht gefunden", "Employee not found");
  const dayAssignments = await prisma.assignment.findMany({ where: { employeeId, date }, include: assignmentInclude, orderBy: { startAt: "asc" } });
  const planned = dayAssignments.filter((a) => a.status === "PLANNED");
  const published = await isPublishedDate(date);

  if (["F", "S", "N"].includes(code)) {
    const st = await prisma.shiftType.findUnique({ where: { code } });
    if (!st) throw new AppError("Schichtart nicht gefunden", "Shift type not found");
    if (planned.length > 0) {
      if (planned[0].shiftTypeId === st.id) return;
      return updateAssignment(planned[0].id, { shiftTypeId: st.id, force }, actor);
    }
    const obj = objectId ?? emp.primaryObjectId ?? (await prisma.securityObject.findFirst({ where: { active: true }, orderBy: { name: "asc" } }))?.id;
    if (!obj) throw new AppError("Bitte zuerst ein Objekt anlegen", "Please create a location first");
    await prisma.absence.deleteMany({ where: { employeeId, date, type: { in: ["VACATION", "UNEXCUSED", "DAY_OFF"] } } });
    return createAssignment({ date: day, shiftTypeId: st.id, objectId: obj, employeeId, force }, actor);
  }

  if (code === "FREI") {
    for (const a of dayAssignments.filter((x) => x.status !== "SICK")) await deleteAssignment(a.id, actor, "auf FREI gesetzt");
    await prisma.absence.deleteMany({ where: { employeeId, date, type: { in: ["VACATION", "UNEXCUSED", "DAY_OFF"] } } });
    await audit(actor.id, "DAY_FREE", "Employee", employeeId, { day });
    return;
  }

  if (code === "FT" || code === "U") {
    const status: AssignmentStatus = code === "FT" ? "ABSENT" : "VACATION";
    if (planned.length > 0) {
      const changeIds: string[] = [];
      const notices: ChangeNotice[] = [];
      for (const a of planned) {
        const upd = await prisma.$transaction(async (tx) => {
          await createOpenSlotFor(a, tx);
          return tx.assignment.update({ where: { id: a.id }, data: { status, attendance: code === "FT" ? "NO_SHOW" : "PENDING" }, include: assignmentInclude });
        });
        const ch = await recordChange({ type: code === "FT" ? "ABSENT" : "VACATION", assignment: upd, originalEmployee: emp, originalStartAt: a.startAt, originalEndAt: a.endAt, reason: code === "FT" ? "Fehltag (unentschuldigt)" : "Urlaub", actor, notify: published && code === "U" });
        changeIds.push(ch.id);
        if (code === "U") notices.push({ kind: "line", employeeId, assignment: upd, de: "Urlaub – Dienst entfällt", en: "vacation – shift removed" });
      }
      if (published && code === "U") await notifyChanges(notices, changeIds);
    } else {
      await prisma.absence.upsert({
        where: { employeeId_date_type: { employeeId, date, type: code === "FT" ? "UNEXCUSED" : "VACATION" } },
        update: {},
        create: { employeeId, date, type: code === "FT" ? "UNEXCUSED" : "VACATION", hours: code === "U" ? dailyCreditHours(emp) : 0, createdById: actor.id },
      });
    }
    await audit(actor.id, code === "FT" ? "DAY_ABSENT" : "DAY_VACATION", "Employee", employeeId, { day });
    return;
  }
  throw new AppError(`Unbekannter Code ${code}`, `Unknown code ${code}`);
}

// ------------------------------------------------------------------ Kopieren

export interface CopyResult {
  created: number;
  skipped: Array<{ date: string; employee: string; reason: string }>;
}

/** Kopiert alle aktiven Dienste aus [sourceFrom, sourceTo] mit Tagesversatz nach target */
async function copyWithMapping(sourceFrom: Date, sourceTo: Date, mapDate: (d: Date) => Date | null, actor: SessionUser): Promise<CopyResult> {
  const src = await prisma.assignment.findMany({
    where: { date: { gte: sourceFrom, lte: sourceTo }, status: { in: ["PLANNED", "SICK", "VACATION", "ABSENT"] }, isDraft: false, replacesAssignmentId: null },
    include: assignmentInclude,
    orderBy: { startAt: "asc" },
  });
  const result: CopyResult = { created: 0, skipped: [] };
  for (const a of src) {
    const target = mapDate(a.date);
    if (!target) continue;
    const day = dateKey(target);
    const name = a.employee ? fullName(a.employee) : "offen";
    if (a.employee && a.employee.status !== "AKTIV") {
      result.skipped.push({ date: day, employee: name, reason: "inaktiv" });
      continue;
    }
    if (a.employeeId) {
      const dup = await prisma.assignment.findFirst({ where: { employeeId: a.employeeId, date: target, shiftTypeId: a.shiftTypeId } });
      if (dup) {
        result.skipped.push({ date: day, employee: name, reason: "bereits vorhanden" });
        continue;
      }
    }
    try {
      await createAssignment({ date: day, shiftTypeId: a.shiftTypeId, objectId: a.objectId, employeeId: a.employeeId, startTime: formatTime(a.startAt), endTime: formatTime(a.endAt), breakMinutes: a.breakMinutes }, actor, "COPY");
      result.created++;
    } catch (e) {
      result.skipped.push({ date: day, employee: name, reason: e instanceof AppError ? e.de : String(e) });
    }
  }
  return result;
}

export async function copyDay(from: string, to: string, actor: SessionUser) {
  const f = parseDateKey(from);
  const t = parseDateKey(to);
  return copyWithMapping(f, f, () => t, actor);
}

export async function copyWeek(fromMonday: string, toMonday: string, actor: SessionUser) {
  const f = parseDateKey(fromMonday);
  const offset = parseDateKey(toMonday).getTime() - f.getTime();
  return copyWithMapping(f, addDays(f, 6), (d) => new Date(d.getTime() + offset), actor);
}

/** Monat kopieren – wochentagsgenau (Montag -> Montag), damit Wochenmuster erhalten bleiben */
export async function copyMonth(fromYear: number, fromMonth: number, toYear: number, toMonth: number, actor: SessionUser) {
  const src = monthRange(fromYear, fromMonth);
  const dst = monthRange(toYear, toMonth);
  const weeks = Math.round((dst.from.getTime() - src.from.getTime()) / (7 * DAY_MS));
  const offset = weeks * 7 * DAY_MS;
  // Quelltage so abbilden, dass jeder Zieltag genau einmal belegt wird
  const mapping = new Map<string, Date>();
  for (let d = dst.from; d < dst.toExclusive; d = addDays(d, 1)) {
    let s = new Date(d.getTime() - offset);
    if (s < src.from) s = addDays(s, 7);
    if (s >= src.toExclusive) s = addDays(s, -7);
    if (s >= src.from && s < src.toExclusive) mapping.set(dateKey(s), d);
  }
  return copyWithMapping(src.from, src.to, (d) => mapping.get(dateKey(d)) ?? null, actor);
}
