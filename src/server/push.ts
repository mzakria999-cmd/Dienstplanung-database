import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

let configured: boolean | null = null;
function ensure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@localhost", pub!, priv!);
  return configured;
}

export function pushEnabled() {
  return ensure();
}

/** Web-Push an alle registrierten Geräte der Benutzer (optional, wenn VAPID konfiguriert). */
export async function pushToUsers(userIds: string[], payload: { title: string; body: string; link?: string | null; urgent?: boolean }) {
  if (!ensure() || userIds.length === 0) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86_400, urgency: payload.urgent ? "high" : "normal" });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
    }),
  );
}
