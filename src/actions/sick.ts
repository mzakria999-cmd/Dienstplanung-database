"use server";
import { z } from "zod";
import { act } from "@/server/action";
import { ADMIN, STAFF, requireUser } from "@/server/session";
import { assignReplacement, confirmSickLeave, offerShift, registerSickLeave, replacementCandidates, respondOffer, revokeSickLeave } from "@/server/sick";
import { dateStr, id } from "@/server/validation";

export async function registerSickAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser();
      const d = z.object({ employeeId: id.optional(), fromDate: dateStr, toDate: dateStr, certificate: z.boolean().default(false), note: z.string().max(300).default("") }).parse(raw);
      const employeeId = actor.role === "EMPLOYEE" ? actor.employeeId : d.employeeId ?? actor.employeeId;
      if (!employeeId) throw new Error("Kein Mitarbeiter");
      const r = await registerSickLeave({ ...d, employeeId }, actor);
      return { sickLeaveId: r.sickLeave.id, affected: r.affected, openSlots: r.openSlots.map((s) => s.id) };
    },
    { message: { de: "Krankmeldung eingetragen", en: "Sick note recorded" } },
  );
}

export async function revokeSickAction(sickLeaveId: string) {
  return act(async () => revokeSickLeave(id.parse(sickLeaveId), await requireUser(ADMIN)), { message: { de: "Krankmeldung zurückgenommen", en: "Sick note revoked" } });
}

export async function confirmSickAction(sickLeaveId: string) {
  return act(async () => confirmSickLeave(id.parse(sickLeaveId), await requireUser(STAFF)));
}

export async function candidatesAction(slotId: string) {
  return act(
    async () => {
      await requireUser(STAFF);
      const r = await replacementCandidates(id.parse(slotId));
      return {
        slot: {
          id: r.slot.id,
          date: r.slot.date.toISOString().slice(0, 10),
          shiftCode: r.slot.shiftType.code,
          shiftName: r.slot.shiftType.nameDe,
          shiftNameEn: r.slot.shiftType.nameEn,
          start: r.slot.startAt.toISOString().slice(11, 16),
          end: r.slot.endAt.toISOString().slice(11, 16),
          object: r.slot.object.name,
          original: r.slot.replacesAssignment?.employee ? `${r.slot.replacesAssignment.employee.firstName} ${r.slot.replacesAssignment.employee.lastName}` : null,
          assigned: r.slot.employee ? `${r.slot.employee.firstName} ${r.slot.employee.lastName}` : null,
        },
        hours: r.shiftHours,
        candidates: r.candidates.map((c) => ({
          employeeId: c.employeeId,
          name: c.name,
          personnelNumber: c.personnelNumber,
          phone: c.phone,
          email: c.email,
          dayStatus: c.dayStatus,
          eligible: c.eligible,
          reasons: c.reasons,
          warnings: c.issues.filter((i) => i.severity === "warning").map((i) => i.message),
          plannedHours: c.plannedHours,
          targetHours: c.targetHours,
          remainingHours: c.remainingHours,
          offerStatus: c.offerStatus,
        })),
      };
    },
    { revalidate: false },
  );
}

export async function offerShiftAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(STAFF);
      const d = z.object({ slotId: id, employeeId: id, message: z.string().max(300).default("") }).parse(raw);
      await offerShift(d.slotId, d.employeeId, actor, d.message);
    },
    { message: { de: "Dienst angeboten – Mitarbeiter wurde benachrichtigt", en: "Shift offered – employee notified" } },
  );
}

export async function respondOfferAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser();
    const d = z.object({ offerId: id, accept: z.boolean() }).parse(raw);
    await respondOffer(d.offerId, d.accept, actor);
  });
}

export async function assignReplacementAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = z.object({ slotId: id, employeeId: id, force: z.boolean().optional() }).parse(raw);
      await assignReplacement(d.slotId, d.employeeId, actor, !!d.force);
    },
    { message: { de: "Dienst zugewiesen – Mitarbeiter werden benachrichtigt", en: "Shift assigned – employees notified" } },
  );
}
