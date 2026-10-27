"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseDateKey } from "@/lib/time";
import { act } from "@/server/action";
import { ADMIN, requireUser } from "@/server/session";
import { audit } from "@/server/audit";
import { approveGenerated, discardGenerated, generateMonth } from "@/server/generator";
import { dateStr, id, month, year } from "@/server/validation";

const templateSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(100),
  type: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ROTATION"]),
  description: z.string().max(500).default(""),
  objectId: id.nullable().optional(),
  skipHolidays: z.boolean().default(false),
  rotationPattern: z.array(z.string().regex(/^(F|S|N|FREI)$/)).max(56).default([]),
  rotationStart: dateStr.nullable().optional(),
  items: z.array(z.object({ dayKey: z.coerce.number().int().min(0).max(31), shiftTypeId: id, objectId: id, requiredCount: z.coerce.number().int().min(0).max(50) })).max(1000),
  members: z.array(z.object({ employeeId: id, offset: z.coerce.number().int().min(0).max(56) })).max(200).default([]),
});

export async function saveTemplateAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = templateSchema.parse(raw);
      const data = {
        name: d.name,
        type: d.type,
        description: d.description,
        objectId: d.objectId ?? null,
        skipHolidays: d.skipHolidays,
        rotationPattern: d.rotationPattern,
        rotationStart: d.rotationStart ? parseDateKey(d.rotationStart) : null,
      };
      const t = await prisma.$transaction(async (tx) => {
        const t = d.id ? await tx.shiftTemplate.update({ where: { id: d.id }, data }) : await tx.shiftTemplate.create({ data });
        await tx.templateItem.deleteMany({ where: { templateId: t.id } });
        const items = d.items.filter((i) => i.requiredCount > 0);
        if (items.length) await tx.templateItem.createMany({ data: items.map((i) => ({ ...i, templateId: t.id })) });
        await tx.rotationMember.deleteMany({ where: { templateId: t.id } });
        if (d.members.length) await tx.rotationMember.createMany({ data: d.members.map((m) => ({ ...m, templateId: t.id })), skipDuplicates: true });
        return t;
      });
      await audit(actor.id, d.id ? "TEMPLATE_UPDATE" : "TEMPLATE_CREATE", "ShiftTemplate", t.id);
      return { id: t.id };
    },
    { message: { de: "Muster-Dienstplan gespeichert", en: "Template saved" } },
  );
}

export async function deleteTemplateAction(templateId: string) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    await prisma.shiftTemplate.delete({ where: { id: id.parse(templateId) } });
    await audit(actor.id, "TEMPLATE_DELETE", "ShiftTemplate", templateId);
  });
}

export async function generateAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ templateId: id, year, month }).parse(raw);
    return generateMonth(d.templateId, d.year, d.month, actor);
  });
}

export async function approveAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = z.object({ year, month }).parse(raw);
      return approveGenerated(d.year, d.month, actor);
    },
    { message: { de: "Entwurf freigegeben", en: "Draft approved" } },
  );
}

export async function discardAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = z.object({ year, month }).parse(raw);
      return discardGenerated(d.year, d.month, actor);
    },
    { message: { de: "Entwurf verworfen", en: "Draft discarded" } },
  );
}
