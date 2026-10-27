import "server-only";
import type { NotificationType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pushToUsers } from "./push";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

export async function notifyUsers(userIds: string[], n: NotificationInput) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null })) });
  await pushToUsers(ids, { title: n.title, body: n.body, link: n.link, urgent: n.type === "URGENT_ANNOUNCEMENT" }).catch(() => undefined);
  return ids.length;
}

export async function notifyEmployees(employeeIds: string[], n: NotificationInput) {
  const emps = await prisma.employee.findMany({ where: { id: { in: employeeIds }, userId: { not: null } }, select: { userId: true } });
  return notifyUsers(emps.map((e) => e.userId!), n);
}

export async function notifyRoles(roles: Role[], n: NotificationInput, exceptUserId?: string) {
  const users = await prisma.user.findMany({ where: { role: { in: roles }, active: true, id: exceptUserId ? { not: exceptUserId } : undefined }, select: { id: true } });
  return notifyUsers(users.map((u) => u.id), n);
}
