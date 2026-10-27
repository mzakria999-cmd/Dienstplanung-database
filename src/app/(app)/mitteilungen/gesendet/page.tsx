import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Gesendete Mitteilungen" };
export const dynamic = "force-dynamic";

export default async function SentPage() {
  await requirePageUser(ADMIN);
  const { t, locale } = await getT();
  const list = await prisma.announcement.findMany({ include: { recipients: { select: { openedAt: true, acknowledgedAt: true, emailStatus: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div>
      <PageHeader title={t("nav.sentAnnouncements")} />
      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? <div className="p-5"><Empty>{t("common.noEntries")}</Empty></div> : (
            <Table>
              <thead><tr><Th>{t("ann.subject")}</Th><Th>{t("ann.recipients")}</Th><Th>{t("ann.priority")}</Th><Th>{t("ann.channel")}</Th><Th>{t("emp.statusLabel")}</Th><Th>{t("ann.opened")}</Th><Th>{t("ann.acknowledged")}</Th><Th>{t("ann.sentAt")}</Th></tr></thead>
              <tbody>
                {list.map((a) => {
                  const n = a.recipients.length;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <Td><Link href={`/mitteilungen/gesendet/${a.id}`} className="font-semibold text-blue-700 hover:underline">{a.subject}</Link><div className="text-xs text-slate-500">{a.createdByName}</div></Td>
                      <Td>{t(`recipientMode.${a.recipientMode}` as never)} · {n}</Td>
                      <Td><Badge tone={a.priority === "DRINGEND" ? "red" : a.priority === "WICHTIG" ? "orange" : "slate"}>{t(`priority.${a.priority}` as never)}</Badge></Td>
                      <Td>{t(`channel.${a.channel}` as never)}</Td>
                      <Td><Badge tone={a.status === "SENT" ? "green" : a.status === "FAILED" ? "red" : "yellow"}>{t(`annStatus.${a.status}` as never)}</Badge></Td>
                      <Td>{a.recipients.filter((r) => r.openedAt).length}/{n}</Td>
                      <Td>{a.requireAck ? `${a.recipients.filter((r) => r.acknowledgedAt).length}/${n}` : "—"}</Td>
                      <Td className="whitespace-nowrap text-xs">{(a.sentAt ?? a.scheduledAt)?.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" }) ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
