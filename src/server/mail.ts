import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachmentName?: string | null;
  attachment?: Buffer | Uint8Array | null;
}

export type MailProvider = "resend" | "smtp" | "none";

export function mailProvider(): MailProvider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "none";
}

let transporter: nodemailer.Transporter | null = null;
function smtp() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    pool: true,
    maxConnections: 4,
  });
  return transporter;
}

const from = () => process.env.MAIL_FROM ?? "Dienstplanung <no-reply@localhost>";

/** Versendet eine E-Mail über den konfigurierten Anbieter. Wirft bei Fehlern. */
export async function deliver(m: MailMessage): Promise<string | undefined> {
  const provider = mailProvider();
  if (provider === "none") throw new Error("E-Mail-Versand nicht konfiguriert (RESEND_API_KEY oder SMTP_HOST setzen)");
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from(),
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        attachments: m.attachment ? [{ filename: m.attachmentName ?? "anhang.pdf", content: Buffer.from(m.attachment).toString("base64") }] : undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? res.statusText}`);
    return body.id;
  }
  const info = await smtp().sendMail({
    from: from(),
    to: m.to,
    subject: m.subject,
    html: m.html,
    text: m.text,
    attachments: m.attachment ? [{ filename: m.attachmentName ?? "anhang.pdf", content: Buffer.from(m.attachment), contentType: "application/pdf" }] : undefined,
  });
  return info.messageId;
}

export const MAX_ATTEMPTS = 5;

export async function queueEmail(data: MailMessage & { batchId?: string | null; employeeId?: string | null }) {
  return prisma.emailLog.create({
    data: {
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
      attachmentName: data.attachmentName ?? null,
      attachment: data.attachment ? Buffer.from(data.attachment) : null,
      batchId: data.batchId ?? null,
      employeeId: data.employeeId ?? null,
    },
  });
}

/** Sendet einen protokollierten E-Mail-Eintrag; bei Fehler exponentieller Wiederholungsversuch. */
export async function sendLogged(id: string): Promise<{ ok: boolean; error?: string }> {
  const log = await prisma.emailLog.findUnique({ where: { id } });
  if (!log) return { ok: false, error: "nicht gefunden" };
  if (log.status === "SENT") return { ok: true };
  try {
    const providerId = await deliver({ to: log.to, subject: log.subject, html: log.html, text: log.text, attachmentName: log.attachmentName, attachment: log.attachment });
    await prisma.emailLog.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, providerId: providerId ?? null, lastError: null, nextRetryAt: null } });
    return { ok: true };
  } catch (e) {
    const attempts = log.attempts + 1;
    const error = e instanceof Error ? e.message : String(e);
    await prisma.emailLog.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts,
        lastError: error.slice(0, 1000),
        nextRetryAt: attempts < MAX_ATTEMPTS ? new Date(Date.now() + 5 * 60_000 * 2 ** (attempts - 1)) : null,
      },
    });
    return { ok: false, error };
  }
}

export async function sendMany(ids: string[], concurrency = 4): Promise<Map<string, { ok: boolean; error?: string }>> {
  const results = new Map<string, { ok: boolean; error?: string }>();
  let i = 0;
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      results.set(id, await sendLogged(id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return results;
}

/** Cron: fehlgeschlagene E-Mails erneut senden */
export async function retryFailedEmails(): Promise<number> {
  const due = await prisma.emailLog.findMany({
    where: { status: { in: ["FAILED", "QUEUED"] }, attempts: { lt: MAX_ATTEMPTS }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }], createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { id: true },
    take: 100,
  });
  await sendMany(due.map((d) => d.id));
  return due.length;
}
