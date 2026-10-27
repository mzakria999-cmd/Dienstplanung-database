import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { Empty } from "@/components/ui/table";
import { MyAnnouncement } from "./item";

export const metadata = { title: "Meine Mitteilungen" };
export const dynamic = "force-dynamic";

export default async function MyAnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const list = user.employeeId
    ? await prisma.announcementRecipient.findMany({ where: { employeeId: user.employeeId, announcement: { status: "SENT" } }, include: { announcement: true }, orderBy: { announcement: { sentAt: "desc" } }, take: 100 })
    : [];
  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.myAnnouncements")} />
      {list.length === 0 ? <Empty>{t("common.noEntries")}</Empty> : null}
      {list.map((r) => (
        <MyAnnouncement
          key={r.id}
          highlight={sp.id === r.announcementId}
          a={{
            id: r.announcementId,
            subject: r.announcement.subject,
            message: r.announcement.message,
            priority: r.announcement.priority,
            requireAck: r.announcement.requireAck,
            sentAt: r.announcement.sentAt?.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" }) ?? "",
            from: r.announcement.createdByName,
            opened: !!r.openedAt,
            acknowledgedAt: r.acknowledgedAt?.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" }) ?? null,
          }}
        />
      ))}
    </div>
  );
}
