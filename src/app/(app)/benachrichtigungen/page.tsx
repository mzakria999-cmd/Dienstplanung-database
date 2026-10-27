import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/table";
import { MarkAllRead } from "./mark-all";

export const metadata = { title: "Benachrichtigungen" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const list = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div>
      <PageHeader title={t("nav.notifications")} subtitle={t("notif.subtitle")} actions={<MarkAllRead />} />
      <Card>
        <CardContent className="divide-y p-0">
          {list.length === 0 ? <div className="p-5"><Empty>{t("notif.empty")}</Empty></div> : null}
          {list.map((n) => {
            const body = (
              <div className={`flex items-start gap-3 px-5 py-4 ${n.readAt ? "" : "bg-blue-50/50"}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.readAt ? "bg-slate-200" : "bg-red-600"}`} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${n.type === "URGENT_ANNOUNCEMENT" ? "text-red-700" : ""}`}>{n.title}</span>
                    <Badge>{t(`notifType.${n.type}` as never)}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">{n.body}</p>
                  <p className="text-xs text-slate-400">{n.createdAt.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}</p>
                </div>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} className="block hover:bg-slate-50">{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </CardContent>
      </Card>
    </div>
  );
}
