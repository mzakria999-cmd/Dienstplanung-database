import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateKey, formatMonth, monthDays, monthRange } from "@/lib/time";
import { AppError } from "./errors";
import { audit } from "./audit";
import { appUrl, getSettings } from "./settings";
import type { SessionUser } from "./session";
import { getPlan } from "./schedule";
import { queueEmail, sendMany } from "./mail";
import { monthlyScheduleMail } from "./email-templates";
import { renderEmployeeSchedulePdf } from "./pdf/render";
import { notifyEmployees } from "./notify";
import { mailProvider } from "./mail";

export type DispatchTarget = "ALL" | "F" | "S" | "N" | "SELECTED";

export interface PreflightWarning {
  level: "error" | "warning" | "info";
  de: string;
  en: string;
}

/** Prüft den Monatsplan vor dem Versand: offene Schichten, fehlende Besetzung, Entwürfe, fehlende E-Mails */
export async function preflight(year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const [plan, drafts, open, employees, objects, assignments] = await Promise.all([
    getPlan(year, month),
    prisma.assignment.count({ where: { date: { gte: from, lte: to }, isDraft: true } }),
    prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, employeeId: null, isDraft: false }, include: { shiftType: true, object: true }, orderBy: { startAt: "asc" } }),
    prisma.employee.findMany({ where: { status: "AKTIV" } }),
    prisma.securityObject.findMany({ where: { active: true } }),
    prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, isDraft: false, status: "PLANNED", employeeId: { not: null } }, include: { shiftType: true } }),
  ]);
  const warnings: PreflightWarning[] = [];
  if (drafts > 0) warnings.push({ level: "error", de: `${drafts} automatisch erstellte Dienste sind noch nicht freigegeben (Muster-Dienstplan → Freigeben).`, en: `${drafts} generated shifts are not approved yet.` });
  if (open.length > 0) warnings.push({ level: "warning", de: `${open.length} unbesetzte Schicht(en) im Monat.`, en: `${open.length} unassigned shift(s) this month.` });

  // Mindestbesetzung je Objekt prüfen
  let missingCoverage = 0;
  const missingDays: string[] = [];
  for (const day of monthDays(year, month)) {
    const key = dateKey(day);
    for (const o of objects) {
      for (const [code, req] of [["F", o.requiredEarly], ["S", o.requiredLate], ["N", o.requiredNight]] as const) {
        const have = assignments.filter((a) => a.objectId === o.id && a.shiftType.code === code && dateKey(a.date) === key).length;
        if (have < req) {
          missingCoverage += req - have;
          if (missingDays.length < 8) missingDays.push(`${key.split("-").reverse().join(".")} ${code} ${o.name}`);
        }
      }
    }
  }
  if (missingCoverage > 0) warnings.push({ level: "warning", de: `Fehlende Besetzung gegenüber Objekt-Soll: ${missingCoverage} Dienst(e), z. B. ${missingDays.join(", ")}`, en: `Missing coverage vs. location requirements: ${missingCoverage} shift(s), e.g. ${missingDays.join(", ")}` });

  const noEmail = employees.filter((e) => !e.email);
  if (noEmail.length) warnings.push({ level: "warning", de: `Keine E-Mail-Adresse: ${noEmail.map((e) => `${e.firstName} ${e.lastName}`).join(", ")}`, en: `No email address: ${noEmail.map((e) => `${e.firstName} ${e.lastName}`).join(", ")}` });
  const withShifts = new Set(assignments.map((a) => a.employeeId));
  const noShift = employees.filter((e) => !withShifts.has(e.id));
  if (noShift.length) warnings.push({ level: "info", de: `${noShift.length} aktive Mitarbeiter ohne Dienst im Monat.`, en: `${noShift.length} active employees without shifts this month.` });
  if (mailProvider() === "none") warnings.push({ level: "error", de: "E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY oder SMTP_HOST). E-Mails werden als fehlgeschlagen protokolliert.", en: "Email delivery is not configured (RESEND_API_KEY or SMTP_HOST)." });

  const counts = { F: new Set<string>(), S: new Set<string>(), N: new Set<string>() } as Record<string, Set<string>>;
  for (const a of assignments) counts[a.shiftType.code]?.add(a.employeeId!);
  return {
    plan,
    warnings,
    openShifts: open.slice(0, 50).map((o) => ({ id: o.id, date: dateKey(o.date), shift: o.shiftType.code, object: o.object.name })),
    recipients: { ALL: employees.length, F: counts.F.size, S: counts.S.size, N: counts.N.size },
    drafts,
  };
}

/** Empfänger ermitteln – Mitarbeiter mit mehreren Schichtarten werden nur einmal berücksichtigt */
export async function scheduleRecipients(year: number, month: number, target: DispatchTarget, selectedIds: string[] = []) {
  const { from, to } = monthRange(year, month);
  if (target === "ALL") return prisma.employee.findMany({ where: { status: "AKTIV" }, include: { user: true }, orderBy: { lastName: "asc" } });
  if (target === "SELECTED") return prisma.employee.findMany({ where: { id: { in: selectedIds }, status: "AKTIV" }, include: { user: true }, orderBy: { lastName: "asc" } });
  const rows = await prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, isDraft: false, status: "PLANNED", employeeId: { not: null }, shiftType: { code: target } }, select: { employeeId: true }, distinct: ["employeeId"] });
  return prisma.employee.findMany({ where: { id: { in: rows.map((r) => r.employeeId!) }, status: "AKTIV" }, include: { user: true }, orderBy: { lastName: "asc" } });
}

async function snapshot(year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const rows = await prisma.assignment.findMany({ where: { date: { gte: from, lte: to }, isDraft: false }, include: { shiftType: true, object: true, employee: true }, orderBy: [{ date: "asc" }, { startAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    date: dateKey(r.date),
    shift: r.shiftType.code,
    start: r.startAt.toISOString(),
    end: r.endAt.toISOString(),
    object: r.object.name,
    employee: r.employee ? `${r.employee.firstName} ${r.employee.lastName} (${r.employee.personnelNumber})` : null,
    status: r.status,
    changed: r.isChanged,
  }));
}

export async function publishPlan(year: number, month: number, actor: SessionUser, reason: string, resetChangeMarkers: boolean) {
  const { from, to } = monthRange(year, month);
  const plan = await getPlan(year, month);
  if (plan.archived) throw new AppError("Monat ist archiviert", "Month is archived");
  const drafts = await prisma.assignment.count({ where: { date: { gte: from, lte: to }, isDraft: true } });
  if (drafts > 0) throw new AppError("Bitte zuerst den automatisch erstellten Entwurf freigeben oder verwerfen.", "Please approve or discard the generated draft first.");
  if (resetChangeMarkers && plan.status === "PUBLISHED") {
    await prisma.assignment.updateMany({ where: { date: { gte: from, lte: to } }, data: { isChanged: false } });
  }
  const version = plan.version + 1;
  await prisma.monthPlan.update({ where: { id: plan.id }, data: { status: "PUBLISHED", version, publishedAt: new Date(), publishedById: actor.id } });
  await prisma.planVersion.create({ data: { monthPlanId: plan.id, version, reason, snapshot: (await snapshot(year, month)) as unknown as Prisma.InputJsonValue, createdById: actor.id } });
  await audit(actor.id, "SCHEDULE_PUBLISH", "MonthPlan", plan.id, { year, month, version });
  return version;
}

export interface DispatchResult {
  batchId: string;
  version: number;
  total: number;
  sent: number;
  failed: number;
  results: Array<{ employeeId: string; name: string; email: string; status: "SENT" | "FAILED" | "NO_EMAIL"; error?: string; attachment?: string }>;
}

/**
 * DIENSTPLAN VERÖFFENTLICHEN & VERSENDEN
 * Veröffentlicht den Monat (jederzeit, auch vor Monatsbeginn), erzeugt je Mitarbeiter ein eigenes PDF,
 * versendet es per E-Mail, erstellt App-Benachrichtigungen und protokolliert Erfolg/Fehler je Empfänger.
 */
export async function publishAndSend(year: number, month: number, target: DispatchTarget, selectedIds: string[], actor: SessionUser): Promise<DispatchResult> {
  const labels: Record<DispatchTarget, string> = { ALL: "alle Mitarbeiter", F: "Frühschicht", S: "Spätschicht", N: "Nachtschicht", SELECTED: "ausgewählte Mitarbeiter" };
  const version = await publishPlan(year, month, actor, `Versand an ${labels[target]}`, target === "ALL");
  const settings = await getSettings();
  const recipients = await scheduleRecipients(year, month, target, selectedIds);
  const batch = await prisma.dispatchBatch.create({ data: { kind: "SCHEDULE", label: `Dienstplan ${formatMonth(year, month)} – ${labels[target]}`, year, month, createdById: actor.id } });
  const logIds: Array<{ id: string; employeeId: string }> = [];
  const results: DispatchResult["results"] = [];

  for (const e of recipients) {
    const locale = e.user?.locale ?? "de";
    const name = `${e.firstName} ${e.lastName}`;
    if (!e.email) {
      results.push({ employeeId: e.id, name, email: "", status: "NO_EMAIL" });
      continue;
    }
    const pdf = await renderEmployeeSchedulePdf(e.id, year, month, locale);
    const mail = monthlyScheduleMail(locale, settings, year, month, appUrl(`/mein-dienstplan?year=${year}&month=${month}`));
    const log = await queueEmail({ ...mail, to: e.email, employeeId: e.id, batchId: batch.id, attachment: pdf.buffer, attachmentName: pdf.filename });
    logIds.push({ id: log.id, employeeId: e.id });
    results.push({ employeeId: e.id, name, email: e.email, status: "SENT", attachment: pdf.filename });
  }

  const sendResults = await sendMany(logIds.map((l) => l.id));
  for (const l of logIds) {
    const r = sendResults.get(l.id)!;
    const row = results.find((x) => x.employeeId === l.employeeId)!;
    if (!r.ok) {
      row.status = "FAILED";
      row.error = r.error;
    }
  }
  await Promise.all(
    recipients.map((e) =>
      notifyEmployees([e.id], {
        type: version > 1 ? "SCHEDULE_UPDATED" : "SCHEDULE_PUBLISHED",
        title: (e.user?.locale ?? "de") === "de" ? `Neuer Dienstplan verfügbar: ${formatMonth(year, month)}` : `New roster available: ${formatMonth(year, month, "en")}`,
        body: (e.user?.locale ?? "de") === "de" ? "Ihr persönlicher Dienstplan wurde veröffentlicht." : "Your personal roster has been published.",
        link: `/mein-dienstplan?year=${year}&month=${month}`,
      }),
    ),
  );
  const sent = results.filter((r) => r.status === "SENT").length;
  const failed = results.length - sent;
  await audit(actor.id, "SCHEDULE_SEND", "DispatchBatch", batch.id, { year, month, target, total: results.length, sent, failed });
  return { batchId: batch.id, version, total: results.length, sent, failed, results };
}

export async function retryBatch(batchId: string, actor: SessionUser) {
  const failed = await prisma.emailLog.findMany({ where: { batchId, status: { in: ["FAILED", "QUEUED"] } }, select: { id: true } });
  await prisma.emailLog.updateMany({ where: { id: { in: failed.map((f) => f.id) } }, data: { attempts: 0 } });
  const res = await sendMany(failed.map((f) => f.id));
  await audit(actor.id, "EMAIL_RETRY", "DispatchBatch", batchId, { count: failed.length });
  return { retried: failed.length, sent: [...res.values()].filter((r) => r.ok).length };
}

export async function archiveMonth(year: number, month: number, archived: boolean, actor: SessionUser) {
  const plan = await getPlan(year, month);
  if (archived) {
    const version = plan.version + 1;
    await prisma.planVersion.create({ data: { monthPlanId: plan.id, version, reason: "Archivierung", snapshot: (await snapshot(year, month)) as unknown as Prisma.InputJsonValue, createdById: actor.id } });
    await prisma.monthPlan.update({ where: { id: plan.id }, data: { archived: true, version } });
  } else await prisma.monthPlan.update({ where: { id: plan.id }, data: { archived: false } });
  await audit(actor.id, archived ? "MONTH_ARCHIVE" : "MONTH_UNARCHIVE", "MonthPlan", plan.id, { year, month });
}
