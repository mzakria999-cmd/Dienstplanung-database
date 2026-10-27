"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { combine, addDays, isValidTime } from "@/lib/time";
import { act } from "@/server/action";
import { AppError } from "@/server/errors";
import { ADMIN, STAFF, requireUser } from "@/server/session";
import { audit } from "@/server/audit";
import { copyDay, copyMonth, copyWeek, createAssignment, deleteAssignment, setDayCode, updateAssignment, assignmentInclude, recordChange } from "@/server/schedule";
import { registerSickLeave } from "@/server/sick";
import { dateStr, id, month, timeStr, year } from "@/server/validation";

const createSchema = z.object({
  date: dateStr,
  shiftTypeId: id,
  objectId: id,
  employeeId: id.nullable(),
  startTime: timeStr.optional().or(z.literal("")),
  endTime: timeStr.optional().or(z.literal("")),
  breakMinutes: z.coerce.number().int().min(0).max(240).optional(),
  note: z.string().max(300).optional(),
  force: z.boolean().optional(),
  count: z.coerce.number().int().min(1).max(20).default(1),
});

export async function createAssignmentAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = createSchema.parse(raw);
      const n = d.employeeId ? 1 : d.count;
      for (let i = 0; i < n; i++) await createAssignment({ ...d, startTime: d.startTime || undefined, endTime: d.endTime || undefined }, actor);
    },
    { message: { de: "Dienst gespeichert", en: "Shift saved" } },
  );
}

const updateSchema = z.object({
  id,
  date: dateStr.optional(),
  employeeId: id.nullable().optional(),
  shiftTypeId: id.optional(),
  objectId: id.optional(),
  startTime: timeStr.optional(),
  endTime: timeStr.optional(),
  breakMinutes: z.coerce.number().int().min(0).max(240).optional(),
  note: z.string().max(300).optional(),
  force: z.boolean().optional(),
  copy: z.boolean().optional(),
});

/** Ändern / Drag-and-Drop (Verschieben oder mit copy=true Kopieren) */
export async function updateAssignmentAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = updateSchema.parse(raw);
      if (d.copy) {
        const src = await prisma.assignment.findUnique({ where: { id: d.id } });
        if (!src) throw new AppError("Dienst nicht gefunden", "Shift not found");
        await createAssignment(
          {
            date: d.date ?? src.date.toISOString().slice(0, 10),
            shiftTypeId: d.shiftTypeId ?? src.shiftTypeId,
            objectId: d.objectId ?? src.objectId,
            employeeId: d.employeeId === undefined ? src.employeeId : d.employeeId,
            startTime: src.startAt.toISOString().slice(11, 16),
            endTime: src.endAt.toISOString().slice(11, 16),
            breakMinutes: src.breakMinutes,
            force: d.force,
          },
          actor,
          "COPY",
        );
        return;
      }
      const { id: aid, copy: _c, ...rest } = d;
      await updateAssignment(aid, rest, actor);
    },
    { message: { de: "Dienstplan aktualisiert", en: "Roster updated" } },
  );
}

export async function deleteAssignmentAction(assignmentId: string, reason?: string) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      await deleteAssignment(id.parse(assignmentId), actor, reason || "Dienst entfernt");
    },
    { message: { de: "Dienst entfernt", en: "Shift removed" } },
  );
}

/** Zelle im Monatsplan: F/S/N/FREI/K/FT/U */
export async function setDayCodeAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ employeeId: id, date: dateStr, code: z.enum(["F", "S", "N", "FREI", "K", "FT", "U"]), objectId: id.nullable().optional(), force: z.boolean().optional() }).parse(raw);
    if (d.code === "K") {
      const r = await registerSickLeave({ employeeId: d.employeeId, fromDate: d.date, toDate: d.date, certificate: false }, actor);
      return { openSlots: r.openSlots.map((s) => s.id) };
    }
    await setDayCode(d.employeeId, d.date, d.code, d.objectId ?? null, actor, !!d.force);
    return { openSlots: [] as string[] };
  });
}

export async function copyAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("day"), from: dateStr, to: dateStr }),
        z.object({ mode: z.literal("week"), from: dateStr, to: dateStr }),
        z.object({ mode: z.literal("month"), fromYear: year, fromMonth: month, toYear: year, toMonth: month }),
      ])
      .parse(raw);
    const res = d.mode === "day" ? await copyDay(d.from, d.to, actor) : d.mode === "week" ? await copyWeek(d.from, d.to, actor) : await copyMonth(d.fromYear, d.fromMonth, d.toYear, d.toMonth, actor);
    await audit(actor.id, "SCHEDULE_COPY", "MonthPlan", null, { ...d, created: res.created, skipped: res.skipped.length });
    return res;
  });
}

/** Anwesenheit bestätigen (Grundlage der Lohnabrechnung) */
export async function confirmAttendanceAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(STAFF);
      const d = z.object({ ids: z.array(id).min(1).max(500), status: z.enum(["CONFIRMED", "NO_SHOW", "PENDING"]), actualStart: timeStr.optional(), actualEnd: timeStr.optional() }).parse(raw);
      for (const aid of d.ids) {
        const a = await prisma.assignment.findUnique({ where: { id: aid }, include: assignmentInclude });
        if (!a || !a.employeeId || a.status !== "PLANNED") continue;
        let actualStartAt: Date | null = null;
        let actualEndAt: Date | null = null;
        if (d.status === "CONFIRMED" && d.actualStart && d.actualEnd && isValidTime(d.actualStart) && isValidTime(d.actualEnd)) {
          actualStartAt = combine(a.date, d.actualStart);
          actualEndAt = combine(a.date, d.actualEnd);
          if (actualEndAt <= actualStartAt) actualEndAt = addDays(actualEndAt, 1);
        }
        const upd = await prisma.assignment.update({
          where: { id: aid },
          data: { attendance: d.status, actualStartAt, actualEndAt, attendanceConfirmedById: actor.id, attendanceConfirmedAt: new Date() },
          include: assignmentInclude,
        });
        if (d.status === "NO_SHOW") await recordChange({ type: "ABSENT", assignment: upd, originalEmployee: a.employee, reason: "Nicht erschienen (Fehltag)", actor, notify: false });
        if (d.actualStart) await recordChange({ type: "ATTENDANCE", assignment: upd, newEmployee: a.employee, originalStartAt: a.startAt, originalEndAt: a.endAt, reason: `Ist-Zeit ${d.actualStart}–${d.actualEnd}`, actor, notify: false });
      }
      await audit(actor.id, "ATTENDANCE", "Assignment", null, { count: d.ids.length, status: d.status });
    },
    { message: { de: "Anwesenheit gespeichert", en: "Attendance saved" } },
  );
}

const shiftTypeSchema = z.object({
  id,
  nameDe: z.string().trim().min(1).max(40),
  nameEn: z.string().trim().min(1).max(40),
  startTime: timeStr,
  endTime: timeStr,
  breakMinutes: z.coerce.number().int().min(0).max(240),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

/** Schichtzeiten anpassen (wirkt auf neue Dienste; bestehende Dienste behalten ihre Zeiten) */
export async function saveShiftTypeAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = shiftTypeSchema.parse(raw);
      await prisma.shiftType.update({ where: { id: d.id }, data: d });
      await audit(actor.id, "SHIFT_TYPE_UPDATE", "ShiftType", d.id, d);
    },
    { message: { de: "Schicht gespeichert", en: "Shift saved" } },
  );
}

export async function createChangeRequestAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser();
      const d = z.object({ assignmentId: id.optional().nullable(), message: z.string().trim().min(3).max(1000) }).parse(raw);
      if (d.assignmentId && actor.role === "EMPLOYEE") {
        const a = await prisma.assignment.findUnique({ where: { id: d.assignmentId } });
        if (a?.employeeId !== actor.employeeId) throw new AppError("Nicht erlaubt", "Not allowed");
      }
      const r = await prisma.changeRequest.create({ data: { assignmentId: d.assignmentId ?? null, message: d.message, requestedById: actor.id, requestedByName: actor.name } });
      const { notifyRoles } = await import("@/server/notify");
      await notifyRoles(["ADMIN"], { type: "REQUEST", title: `Änderungswunsch von ${actor.name}`, body: d.message.slice(0, 160), link: "/aenderungen?tab=requests" });
      await audit(actor.id, "CHANGE_REQUEST", "ChangeRequest", r.id);
    },
    { message: { de: "Änderungswunsch gesendet", en: "Change request sent" } },
  );
}

export async function decideChangeRequestAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ id, approve: z.boolean(), note: z.string().max(500).default("") }).parse(raw);
    const r = await prisma.changeRequest.update({ where: { id: d.id }, data: { status: d.approve ? "APPROVED" : "REJECTED", decidedById: actor.id, decidedAt: new Date(), decisionNote: d.note } });
    const { notifyUsers } = await import("@/server/notify");
    await notifyUsers([r.requestedById], { type: "REQUEST", title: `Änderungswunsch ${d.approve ? "genehmigt" : "abgelehnt"}`, body: d.note || r.message.slice(0, 120), link: "/dashboard" });
    await audit(actor.id, "CHANGE_REQUEST_DECIDE", "ChangeRequest", r.id, { approve: d.approve });
  });
}

/** Alle vergangenen, noch unbestätigten Dienste eines Monats als "wie geplant gearbeitet" bestätigen */
export async function confirmPastMonthAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ year, month }).parse(raw);
    const { monthRange, berlinNow } = await import("@/lib/time");
    const { from, to } = monthRange(d.year, d.month);
    const r = await prisma.assignment.updateMany({
      where: { date: { gte: from, lte: to }, status: "PLANNED", attendance: "PENDING", isDraft: false, employeeId: { not: null }, endAt: { lte: berlinNow() } },
      data: { attendance: "CONFIRMED", attendanceConfirmedById: actor.id, attendanceConfirmedAt: new Date() },
    });
    await audit(actor.id, "ATTENDANCE_BULK_CONFIRM", "MonthPlan", null, { ...d, count: r.count });
    return r.count;
  });
}
