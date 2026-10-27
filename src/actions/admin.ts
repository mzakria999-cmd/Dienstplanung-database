"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { act } from "@/server/action";
import { ADMIN, requireUser } from "@/server/session";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { id, timeStr } from "@/server/validation";
import { BUNDESLAENDER } from "@/lib/holidays";

const objectSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).default(""),
  contactPerson: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  notes: z.string().max(2000).default(""),
  active: z.boolean().default(true),
  requiredEarly: z.coerce.number().int().min(0).max(50),
  requiredLate: z.coerce.number().int().min(0).max(50),
  requiredNight: z.coerce.number().int().min(0).max(50),
  employeeIds: z.array(id).default([]),
  qualificationIds: z.array(id).default([]),
});

export async function saveObjectAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const { id: oid, employeeIds, qualificationIds, ...data } = objectSchema.parse(raw);
      const o = await prisma.$transaction(async (tx) => {
        const o = oid ? await tx.securityObject.update({ where: { id: oid }, data }) : await tx.securityObject.create({ data });
        await tx.employeeObject.deleteMany({ where: { objectId: o.id } });
        if (employeeIds.length) await tx.employeeObject.createMany({ data: employeeIds.map((employeeId) => ({ employeeId, objectId: o.id })), skipDuplicates: true });
        await tx.objectRequiredQualification.deleteMany({ where: { objectId: o.id } });
        if (qualificationIds.length) await tx.objectRequiredQualification.createMany({ data: qualificationIds.map((qualificationId) => ({ qualificationId, objectId: o.id })) });
        return o;
      });
      await audit(actor.id, oid ? "OBJECT_UPDATE" : "OBJECT_CREATE", "SecurityObject", o.id);
      return { id: o.id };
    },
    { message: { de: "Objekt gespeichert", en: "Location saved" } },
  );
}

export async function deleteObjectAction(objectId: string) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const n = await prisma.assignment.count({ where: { objectId } });
    if (n > 0) {
      await prisma.securityObject.update({ where: { id: objectId }, data: { active: false } });
      await audit(actor.id, "OBJECT_DEACTIVATE", "SecurityObject", objectId);
      return { deleted: false };
    }
    await prisma.securityObject.delete({ where: { id: objectId } });
    await audit(actor.id, "OBJECT_DELETE", "SecurityObject", objectId);
    return { deleted: true };
  });
}

export async function saveQualificationAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ id: id.optional(), name: z.string().trim().min(1).max(120), description: z.string().max(300).default("") }).parse(raw);
    const q = d.id ? await prisma.qualification.update({ where: { id: d.id }, data: d }) : await prisma.qualification.create({ data: d });
    await audit(actor.id, "QUALIFICATION_SAVE", "Qualification", q.id);
  });
}

export async function deleteQualificationAction(qid: string) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    await prisma.qualification.delete({ where: { id: id.parse(qid) } });
    await audit(actor.id, "QUALIFICATION_DELETE", "Qualification", qid);
  });
}

const settingsSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  address: z.string().max(300),
  phone: z.string().max(40),
  email: z.string().max(200),
  bundesland: z.string().refine((s) => s in BUNDESLAENDER, "Bundesland"),
  minRestHours: z.coerce.number().int().min(0).max(24),
  maxConsecutiveDays: z.coerce.number().int().min(1).max(14),
  maxDailyHours: z.coerce.number().int().min(1).max(24),
  nightStart: timeStr,
  nightEnd: timeStr,
  overtimeTolerance: z.coerce.number().min(0).max(80),
  minijobMaxHours: z.coerce.number().min(0).max(100),
  reminderHoursBefore: z.coerce.number().int().min(1).max(72),
  retentionMonthsLogs: z.coerce.number().int().min(1).max(120),
  retentionMonthsNotifications: z.coerce.number().int().min(1).max(120),
  retentionMonthsSickLeave: z.coerce.number().int().min(6).max(240),
  datevBeraterNr: z.string().max(10),
  datevMandantNr: z.string().max(10),
  datevLohnartWorked: z.string().max(6),
  datevLohnartOvertime: z.string().max(6),
  datevLohnartNight: z.string().max(6),
  datevLohnartSunday: z.string().max(6),
  datevLohnartHoliday: z.string().max(6),
  datevLohnartSick: z.string().max(6),
  datevLohnartVacation: z.string().max(6),
  emailSignature: z.string().max(500),
  logoDataUrl: z
    .string()
    .max(700_000, "Logo zu groß (max. 500 KB)")
    .regex(/^data:image\/(png|jpeg);base64,/, "Nur PNG oder JPEG")
    .nullable()
    .optional(),
});

export async function saveSettingsAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = settingsSchema.parse(raw);
      if (d.minRestHours < 11) {
        // §5 ArbZG: Verkürzung nur mit Ausgleich zulässig – bewusst nur warnend erlaubt
      }
      await prisma.companySettings.upsert({ where: { id: 1 }, update: d, create: { id: 1, ...d } });
      await audit(actor.id, "SETTINGS_UPDATE", "CompanySettings", "1", { ...d, logoDataUrl: d.logoDataUrl ? "[logo]" : null });
    },
    { message: { de: "Einstellungen gespeichert", en: "Settings saved" } },
  );
}

export async function setUserActiveAction(userId: string, active: boolean) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    if (userId === actor.id) throw new AppError("Eigenes Konto kann nicht deaktiviert werden", "You cannot deactivate your own account");
    await prisma.user.update({ where: { id: userId }, data: { active } });
    await audit(actor.id, active ? "USER_ACTIVATE" : "USER_DEACTIVATE", "User", userId);
  });
}
