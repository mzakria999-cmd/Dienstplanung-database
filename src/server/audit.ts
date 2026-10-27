import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function audit(userId: string | null, action: string, entity: string, entityId?: string | null, details?: Prisma.InputJsonValue) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  } catch {
    // außerhalb eines Requests (Cron/Worker)
  }
  await prisma.auditLog.create({ data: { userId, action, entity, entityId: entityId ?? null, details, ip } });
}
