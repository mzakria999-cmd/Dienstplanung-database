"use server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseDateKey } from "@/lib/time";
import { act } from "@/server/action";
import { AppError } from "@/server/errors";
import { ADMIN, requireUser } from "@/server/session";
import { audit } from "@/server/audit";
import { employeeSchema, id, passwordSchema } from "@/server/validation";

function tempPassword() {
  return `${randomBytes(6).toString("base64url")}${Math.floor(Math.random() * 90 + 10)}`;
}

/** Mitarbeiter anlegen/bearbeiten – Stammdaten werden nur einmal erfasst und überall wiederverwendet */
export async function saveEmployeeAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = employeeSchema.parse(raw);
      const data = {
        firstName: d.firstName,
        lastName: d.lastName,
        personnelNumber: d.personnelNumber.toUpperCase(),
        email: d.email,
        phone: d.phone,
        entryDate: parseDateKey(d.entryDate),
        employmentType: d.employmentType,
        targetHours: d.targetHours,
        status: d.status,
        primaryObjectId: d.primaryObjectId,
        allowedShiftCodes: d.allowedShiftCodes,
        availableForReplacement: d.availableForReplacement,
        ...(d.photoDataUrl !== undefined ? { photoDataUrl: d.photoDataUrl } : {}),
      };
      const objectIds = [...new Set([...d.objectIds, ...(d.primaryObjectId ? [d.primaryObjectId] : [])])];
      let initialPassword: string | null = null;

      const emp = await prisma.$transaction(async (tx) => {
        const existing = d.id ? await tx.employee.findUnique({ where: { id: d.id }, include: { user: true } }) : null;
        if (d.id && !existing) throw new AppError("Mitarbeiter nicht gefunden", "Employee not found");
        let userId = existing?.userId ?? null;
        const pw = d.password || null;
        if (pw) passwordSchema.parse(pw);
        if (userId) {
          await tx.user.update({
            where: { id: userId },
            data: { email: d.email, role: d.role, active: d.status === "AKTIV", ...(pw ? { passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true } : {}) },
          });
        } else {
          initialPassword = pw ?? tempPassword();
          const user = await tx.user.create({ data: { email: d.email, role: d.role, passwordHash: await bcrypt.hash(initialPassword, 12), mustChangePassword: true, active: d.status === "AKTIV" } });
          userId = user.id;
        }
        const e = existing ? await tx.employee.update({ where: { id: existing.id }, data: { ...data, userId } }) : await tx.employee.create({ data: { ...data, userId } });
        await tx.employeeObject.deleteMany({ where: { employeeId: e.id } });
        if (objectIds.length) await tx.employeeObject.createMany({ data: objectIds.map((objectId) => ({ employeeId: e.id, objectId })) });
        await tx.employeeQualification.deleteMany({ where: { employeeId: e.id, qualificationId: { notIn: d.qualificationIds } } });
        for (const q of d.qualificationIds) await tx.employeeQualification.upsert({ where: { employeeId_qualificationId: { employeeId: e.id, qualificationId: q } }, update: {}, create: { employeeId: e.id, qualificationId: q } });
        return e;
      });
      await audit(actor.id, d.id ? "EMPLOYEE_UPDATE" : "EMPLOYEE_CREATE", "Employee", emp.id, { personnelNumber: emp.personnelNumber });
      return { id: emp.id, initialPassword };
    },
    { message: { de: "Mitarbeiter gespeichert", en: "Employee saved" } },
  );
}

export async function resetPasswordAction(employeeId: string) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const e = await prisma.employee.findUnique({ where: { id: id.parse(employeeId) } });
    if (!e?.userId) throw new AppError("Kein Benutzerkonto", "No user account");
    const pw = tempPassword();
    await prisma.user.update({ where: { id: e.userId }, data: { passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
    await audit(actor.id, "PASSWORD_RESET", "Employee", e.id);
    return { password: pw };
  });
}

/** Löschen nur ohne Dienst-/Abrechnungshistorie, sonst deaktivieren (Aufbewahrungspflichten) */
export async function deleteEmployeeAction(employeeId: string) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const e = await prisma.employee.findUnique({ where: { id: id.parse(employeeId) }, include: { _count: { select: { assignments: true, absences: true } } } });
    if (!e) throw new AppError("Mitarbeiter nicht gefunden", "Employee not found");
    if (e._count.assignments + e._count.absences > 0) {
      await prisma.employee.update({ where: { id: e.id }, data: { status: "INAKTIV" } });
      if (e.userId) await prisma.user.update({ where: { id: e.userId }, data: { active: false } });
      await audit(actor.id, "EMPLOYEE_DEACTIVATE", "Employee", e.id);
      return { deleted: false };
    }
    await prisma.employee.delete({ where: { id: e.id } });
    if (e.userId) await prisma.user.delete({ where: { id: e.userId } });
    await audit(actor.id, "EMPLOYEE_DELETE", "Employee", e.id, { personnelNumber: e.personnelNumber });
    return { deleted: true };
  });
}

/** DSGVO: Personenbezogene Daten ehemaliger Mitarbeiter anonymisieren (Stunden/Abrechnung bleiben erhalten) */
export async function anonymizeEmployeeAction(employeeId: string) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const e = await prisma.employee.findUnique({ where: { id: id.parse(employeeId) } });
    if (!e) throw new AppError("Mitarbeiter nicht gefunden", "Employee not found");
    if (e.status === "AKTIV") throw new AppError("Nur inaktive Mitarbeiter können anonymisiert werden", "Only inactive employees can be anonymized");
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: e.id }, data: { firstName: "Anonymisiert", lastName: e.personnelNumber, email: "", phone: "", photoDataUrl: null, anonymizedAt: new Date(), userId: null } });
      if (e.userId) await tx.user.delete({ where: { id: e.userId } });
      await tx.sickLeave.updateMany({ where: { employeeId: e.id }, data: { note: "" } });
      await tx.availability.deleteMany({ where: { employeeId: e.id } });
      await tx.emailLog.updateMany({ where: { employeeId: e.id }, data: { to: "anonymisiert", html: "", text: "", attachment: null } });
    });
    await audit(actor.id, "EMPLOYEE_ANONYMIZE", "Employee", e.id);
  });
}

const availabilitySchema = z.object({
  employeeId: id.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["UNAVAILABLE", "PREFERRED_OFF", "AVAILABLE"]),
  shiftCode: z.enum(["F", "S", "N"]).optional().nullable(),
  note: z.string().max(200).default(""),
});

export async function saveAvailabilityAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser();
    const d = availabilitySchema.parse(raw);
    const employeeId = actor.role === "EMPLOYEE" || !d.employeeId ? actor.employeeId : d.employeeId;
    if (!employeeId) throw new AppError("Kein Mitarbeiterprofil", "No employee profile");
    await prisma.availability.upsert({
      where: { employeeId_date_type: { employeeId, date: parseDateKey(d.date), type: d.type } },
      update: { shiftCode: d.shiftCode ?? null, note: d.note },
      create: { employeeId, date: parseDateKey(d.date), type: d.type, shiftCode: d.shiftCode ?? null, note: d.note },
    });
    await audit(actor.id, "AVAILABILITY_SAVE", "Employee", employeeId, { date: d.date, type: d.type });
  });
}

export async function deleteAvailabilityAction(availabilityId: string) {
  return act(async () => {
    const actor = await requireUser();
    const a = await prisma.availability.findUnique({ where: { id: id.parse(availabilityId) } });
    if (!a || (actor.role === "EMPLOYEE" && a.employeeId !== actor.employeeId)) throw new AppError("Nicht gefunden", "Not found");
    await prisma.availability.delete({ where: { id: a.id } });
  });
}
