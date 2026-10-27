import "server-only";
import type { Channel, Priority, RecipientMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { berlinToday, parseDateKey } from "@/lib/time";
import { AppError } from "./errors";
import { audit } from "./audit";
import { appUrl, getSettings } from "./settings";
import type { SessionUser } from "./session";
import { queueEmail, sendMany } from "./mail";
import { announcementMail } from "./email-templates";
import { notifyUsers } from "./notify";

export interface RecipientQuery {
  mode: RecipientMode;
  dateFrom?: string | null;
  dateTo?: string | null;
  objectId?: string | null;
  selectedEmployeeIds?: string[];
}

const SHIFT_CODE: Partial<Record<RecipientMode, string>> = { SHIFT_F: "F", SHIFT_S: "S", SHIFT_N: "N" };

/**
 * Empfänger ermitteln:
 * ALLE – alle aktiven Mitarbeiter; NUR F/S/N – Mitarbeiter, die im gewählten Zeitraum in dieser Schicht eingeteilt sind;
 * BESTIMMTE – ausgewählte Mitarbeiter. Jeder Mitarbeiter wird nur einmal berücksichtigt.
 */
export async function resolveRecipients(q: RecipientQuery) {
  if (q.mode === "ALL") return prisma.employee.findMany({ where: { status: "AKTIV" }, include: { user: true } });
  if (q.mode === "SELECTED") return prisma.employee.findMany({ where: { status: "AKTIV", id: { in: q.selectedEmployeeIds ?? [] } }, include: { user: true } });
  const code = SHIFT_CODE[q.mode]!;
  const from = q.dateFrom ? parseDateKey(q.dateFrom) : berlinToday();
  const to = q.dateTo ? parseDateKey(q.dateTo) : from;
  if (to < from) throw new AppError("Enddatum liegt vor dem Startdatum", "End date is before start date");
  const rows = await prisma.assignment.findMany({
    where: { date: { gte: from, lte: to }, status: "PLANNED", isDraft: false, employeeId: { not: null }, shiftType: { code }, objectId: q.objectId || undefined },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  return prisma.employee.findMany({ where: { status: "AKTIV", id: { in: rows.map((r) => r.employeeId!) } }, include: { user: true } });
}

export interface AnnouncementInput extends RecipientQuery {
  subject: string;
  message: string;
  priority: Priority;
  channel: Channel;
  requireAck: boolean;
  scheduledAt?: string | null; // ISO
}

export async function createAnnouncement(input: AnnouncementInput, actor: SessionUser) {
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduled && Number.isNaN(scheduled.getTime())) throw new AppError("Ungültiger Versandzeitpunkt", "Invalid send time");
  const later = scheduled && scheduled.getTime() > Date.now() + 30_000;
  const a = await prisma.announcement.create({
    data: {
      subject: input.subject,
      message: input.message,
      priority: input.priority,
      channel: input.channel,
      recipientMode: input.mode,
      dateFrom: input.dateFrom ? parseDateKey(input.dateFrom) : null,
      dateTo: input.dateTo ? parseDateKey(input.dateTo) : null,
      objectId: input.objectId || null,
      selectedEmployeeIds: input.selectedEmployeeIds ?? [],
      requireAck: input.requireAck,
      scheduledAt: later ? scheduled : null,
      status: "SCHEDULED",
      createdById: actor.id,
      createdByName: actor.name,
    },
  });
  await audit(actor.id, "ANNOUNCEMENT_CREATE", "Announcement", a.id, { mode: input.mode, later: !!later });
  if (later) return { announcement: a, sent: null };
  return { announcement: a, sent: await sendAnnouncement(a.id) };
}

export async function sendAnnouncement(id: string) {
  const claimed = await prisma.announcement.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "SENDING" } });
  if (claimed.count === 0) throw new AppError("Mitteilung wurde bereits versendet", "Announcement already sent");
  const a = await prisma.announcement.findUniqueOrThrow({ where: { id } });
  try {
    const recipients = await resolveRecipients({
      mode: a.recipientMode,
      dateFrom: a.dateFrom?.toISOString().slice(0, 10),
      dateTo: a.dateTo?.toISOString().slice(0, 10),
      objectId: a.objectId,
      selectedEmployeeIds: a.selectedEmployeeIds,
    });
    const settings = await getSettings();
    const useEmail = a.channel !== "APP";
    const useApp = a.channel !== "EMAIL";
    await prisma.announcementRecipient.createMany({
      data: recipients.map((r) => ({ announcementId: a.id, employeeId: r.id, emailStatus: useEmail ? (r.email ? "PENDING" : "FAILED") : "NOT_REQUIRED", appNotified: useApp && !!r.userId })),
      skipDuplicates: true,
    });
    if (useApp) {
      const urgent = a.priority === "DRINGEND";
      await notifyUsers(
        recipients.filter((r) => r.userId).map((r) => r.userId!),
        { type: urgent ? "URGENT_ANNOUNCEMENT" : "ANNOUNCEMENT", title: `${urgent ? "DRINGEND: " : a.priority === "WICHTIG" ? "WICHTIG: " : ""}${a.subject}`, body: a.message.slice(0, 180), link: `/meine-mitteilungen?id=${a.id}` },
      );
    }
    let sent = 0;
    let failed = recipients.filter((r) => useEmail && !r.email).length;
    if (useEmail) {
      const batch = await prisma.dispatchBatch.create({ data: { kind: "ANNOUNCEMENT", label: `Mitteilung: ${a.subject}`, createdById: a.createdById } });
      const logs: Array<{ logId: string; employeeId: string }> = [];
      for (const r of recipients.filter((x) => x.email)) {
        const locale = r.user?.locale ?? "de";
        const mail = announcementMail(locale, settings, a, appUrl(`/meine-mitteilungen?id=${a.id}`));
        const log = await queueEmail({ ...mail, to: r.email, employeeId: r.id, batchId: batch.id });
        logs.push({ logId: log.id, employeeId: r.id });
      }
      const res = await sendMany(logs.map((l) => l.logId));
      for (const l of logs) {
        const ok = res.get(l.logId)?.ok;
        if (ok) sent++;
        else failed++;
        await prisma.announcementRecipient.update({ where: { announcementId_employeeId: { announcementId: a.id, employeeId: l.employeeId } }, data: { emailStatus: ok ? "SENT" : "FAILED" } });
      }
    }
    await prisma.announcement.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    return { recipients: recipients.length, emailSent: sent, emailFailed: failed, app: useApp ? recipients.filter((r) => r.userId).length : 0 };
  } catch (e) {
    await prisma.announcement.update({ where: { id }, data: { status: "FAILED" } });
    throw e;
  }
}

export async function markOpened(announcementId: string, employeeId: string) {
  await prisma.announcementRecipient.updateMany({ where: { announcementId, employeeId, openedAt: null }, data: { openedAt: new Date() } });
}

export async function acknowledge(announcementId: string, actor: SessionUser) {
  if (!actor.employeeId) throw new AppError("Nur für Mitarbeiter", "Employees only");
  const r = await prisma.announcementRecipient.updateMany({
    where: { announcementId, employeeId: actor.employeeId, acknowledgedAt: null },
    data: { acknowledgedAt: new Date(), openedAt: new Date() },
  });
  await audit(actor.id, "ANNOUNCEMENT_ACK", "Announcement", announcementId);
  return r.count;
}

/** Cron: fällige geplante Mitteilungen versenden */
export async function sendDueAnnouncements() {
  const due = await prisma.announcement.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } }, select: { id: true } });
  for (const d of due) await sendAnnouncement(d.id).catch((e) => console.error("Mitteilung", d.id, e));
  return due.length;
}
