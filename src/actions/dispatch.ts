"use server";
import { z } from "zod";
import { act } from "@/server/action";
import { ADMIN, requireUser } from "@/server/session";
import { archiveMonth, preflight, publishAndSend, publishPlan, retryBatch } from "@/server/dispatch";
import { sendLogged } from "@/server/mail";
import { id, month, year } from "@/server/validation";

export async function preflightAction(raw: unknown) {
  return act(
    async () => {
      await requireUser(ADMIN);
      const d = z.object({ year, month }).parse(raw);
      const r = await preflight(d.year, d.month);
      return { ...r, plan: { status: r.plan.status, version: r.plan.version, publishedAt: r.plan.publishedAt?.toISOString() ?? null, archived: r.plan.archived } };
    },
    { revalidate: false },
  );
}

export async function sendScheduleAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ year, month, target: z.enum(["ALL", "F", "S", "N", "SELECTED"]), employeeIds: z.array(id).max(1000).default([]) }).parse(raw);
    return publishAndSend(d.year, d.month, d.target, d.employeeIds, actor);
  });
}

export async function publishOnlyAction(raw: unknown) {
  return act(
    async () => {
      const actor = await requireUser(ADMIN);
      const d = z.object({ year, month }).parse(raw);
      return publishPlan(d.year, d.month, actor, "Veröffentlicht (ohne Versand)", false);
    },
    { message: { de: "Dienstplan veröffentlicht", en: "Roster published" } },
  );
}

export async function retryBatchAction(batchId: string) {
  return act(async () => retryBatch(id.parse(batchId), await requireUser(ADMIN)));
}

export async function retryEmailAction(emailId: string) {
  return act(async () => {
    await requireUser(ADMIN);
    return sendLogged(id.parse(emailId));
  });
}

export async function archiveMonthAction(raw: unknown) {
  return act(async () => {
    const actor = await requireUser(ADMIN);
    const d = z.object({ year, month, archived: z.boolean() }).parse(raw);
    await archiveMonth(d.year, d.month, d.archived, actor);
  });
}
