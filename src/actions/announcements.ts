"use server";
import { z } from "zod";
import { act } from "@/server/action";
import { ADMIN, requireUser } from "@/server/session";
import { acknowledge, createAnnouncement, markOpened, resolveRecipients } from "@/server/announcements";
import { dateStr, id } from "@/server/validation";

const recipientSchema = z.object({
  mode: z.enum(["ALL", "SHIFT_F", "SHIFT_S", "SHIFT_N", "SELECTED"]),
  dateFrom: dateStr.nullable().optional(),
  dateTo: dateStr.nullable().optional(),
  objectId: id.nullable().optional(),
  selectedEmployeeIds: z.array(id).max(1000).default([]),
});

export async function previewRecipientsAction(raw: unknown) {
  return act(
    async () => {
      await requireUser(ADMIN);
      const r = await resolveRecipients(recipientSchema.parse(raw));
      return { count: r.length, names: r.slice(0, 50).map((e) => `${e.firstName} ${e.lastName}`), withoutEmail: r.filter((e) => !e.email).length };
    },
    { revalidate: false },
  );
}

export async function createAnnouncementAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = recipientSchema
      .extend({
        subject: z.string().trim().min(1, "Betreff fehlt").max(200),
        message: z.string().trim().min(1, "Nachricht fehlt").max(10000),
        priority: z.enum(["NORMAL", "WICHTIG", "DRINGEND"]),
        channel: z.enum(["EMAIL", "APP", "BOTH"]),
        requireAck: z.boolean().default(false),
        scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
      })
      .parse(raw);
    const r = await createAnnouncement(d, actor);
    return { id: r.announcement.id, scheduled: !r.sent, sent: r.sent };
  });
}

export async function acknowledgeAction(announcementId: string) {
  return act(async () => acknowledge(id.parse(announcementId), await requireUser()), { message: { de: "Danke – Lesebestätigung gespeichert", en: "Thank you – acknowledgement saved" } });
}

export async function markOpenedAction(announcementId: string) {
  return act(
    async () => {
      const u = await requireUser();
      if (u.employeeId) await markOpened(id.parse(announcementId), u.employeeId);
    },
    { revalidate: false },
  );
}
