import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

/** { id } markiert eine, { all: true } alle als gelesen */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  if (body.all) await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  else if (body.id) await prisma.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
