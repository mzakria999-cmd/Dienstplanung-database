import "server-only";
import { prisma } from "@/lib/db";
import { berlinNow, formatDate, formatTime, HOUR_MS } from "@/lib/time";
import { getSettings } from "./settings";
import { notifyEmployees } from "./notify";
import { retryFailedEmails } from "./mail";
import { sendDueAnnouncements } from "./announcements";

/** Erinnerung an bevorstehenden Dienst (einmalig, X Stunden vorher) */
export async function sendShiftReminders() {
  const s = await getSettings();
  const now = berlinNow();
  const until = new Date(now.getTime() + s.reminderHoursBefore * HOUR_MS);
  const due = await prisma.assignment.findMany({
    where: { status: "PLANNED", isDraft: false, employeeId: { not: null }, reminderSentAt: null, startAt: { gt: now, lte: until } },
    include: { shiftType: true, object: true },
    take: 500,
  });
  for (const a of due) {
    const plan = await prisma.monthPlan.findUnique({ where: { year_month: { year: a.date.getUTCFullYear(), month: a.date.getUTCMonth() + 1 } } });
    if (plan?.status !== "PUBLISHED") continue;
    await notifyEmployees([a.employeeId!], {
      type: "SHIFT_REMINDER",
      title: `Erinnerung: ${a.shiftType.nameDe} am ${formatDate(a.date)}`,
      body: `${formatTime(a.startAt)}–${formatTime(a.endAt)} · ${a.object.name}`,
      link: "/mein-dienstplan",
    });
    await prisma.assignment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
  }
  return due.length;
}

/** DSGVO-Löschfristen */
export async function applyRetention() {
  const s = await getSettings();
  const monthsAgo = (m: number) => new Date(Date.now() - m * 30.44 * 86_400_000);
  const notifications = await prisma.notification.deleteMany({ where: { createdAt: { lt: monthsAgo(s.retentionMonthsNotifications) } } });
  const emails = await prisma.emailLog.deleteMany({ where: { createdAt: { lt: monthsAgo(s.retentionMonthsLogs) } } });
  // Anhänge (PDFs) nach 90 Tagen entfernen – Protokoll bleibt
  await prisma.emailLog.updateMany({ where: { createdAt: { lt: monthsAgo(3) }, attachment: { not: null } }, data: { attachment: null } });
  const audits = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: monthsAgo(s.retentionMonthsLogs) } } });
  const sick = await prisma.sickLeave.deleteMany({ where: { toDate: { lt: monthsAgo(s.retentionMonthsSickLeave) } } });
  return { notifications: notifications.count, emails: emails.count, audits: audits.count, sickLeaves: sick.count };
}

export async function runAllJobs() {
  const started = Date.now();
  const result = {
    announcements: await sendDueAnnouncements(),
    reminders: await sendShiftReminders(),
    emailRetries: await retryFailedEmails(),
    retention: new Date().getUTCHours() === 2 ? await applyRetention() : null,
    ms: 0,
  };
  result.ms = Date.now() - started;
  return result;
}
