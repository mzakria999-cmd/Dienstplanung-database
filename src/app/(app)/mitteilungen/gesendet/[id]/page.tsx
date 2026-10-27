import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader, StatCard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser(ADMIN);
  const { t, locale } = await getT();
  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id }, include: { recipients: { include: { employee: true }, orderBy: { employee: { lastName: "asc" } } } } });
  if (!a) notFound();
  const fmt = (d: Date | null) => (d ? d.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" }) : "—");
  const n = a.recipients.length;
  return (
    <div className="space-y-6">
      <PageHeader title={a.subject} subtitle={`${t(`recipientMode.${a.recipientMode}` as never)} · ${t(`priority.${a.priority}` as never)} · ${t(`channel.${a.channel}` as never)} · ${fmt(a.sentAt ?? a.scheduledAt)}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("ann.received")} value={n} />
        <StatCard label={t("ann.emailSent")} value={a.recipients.filter((r) => r.emailStatus === "SENT").length} tone="green" />
        <StatCard label={t("ann.opened")} value={`${a.recipients.filter((r) => r.openedAt).length}/${n}`} tone="blue" />
        <StatCard label={t("ann.acknowledged")} value={a.requireAck ? `${a.recipients.filter((r) => r.acknowledgedAt).length}/${n}` : "—"} tone={a.requireAck && a.recipients.some((r) => !r.acknowledgedAt) ? "orange" : "green"} />
      </div>
      <Card><CardContent><p className="whitespace-pre-line text-sm">{a.message}</p></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>{t("ann.recipientStatus")}</CardTitle>{a.requireAck ? <Badge tone="red">{t("ann.requireAck")}</Badge> : null}</CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>{t("grid.employee")}</Th><Th>E-Mail</Th><Th>App</Th><Th>{t("ann.opened")}</Th><Th>{t("ann.acknowledged")}</Th></tr></thead>
            <tbody>
              {a.recipients.map((r) => (
                <tr key={r.id} className={a.requireAck && !r.acknowledgedAt ? "bg-orange-50/50" : ""}>
                  <Td className="font-semibold">{r.employee.firstName} {r.employee.lastName} <span className="text-xs font-normal text-slate-500">{r.employee.personnelNumber}</span></Td>
                  <Td><Badge tone={r.emailStatus === "SENT" ? "green" : r.emailStatus === "FAILED" ? "red" : "slate"}>{t(`notify.${r.emailStatus}` as never)}</Badge></Td>
                  <Td>{r.appNotified ? "✓" : "—"}</Td>
                  <Td className="text-xs">{fmt(r.openedAt)}</Td>
                  <Td className="text-xs">{a.requireAck ? (r.acknowledgedAt ? <span className="font-semibold text-green-700">✓ {fmt(r.acknowledgedAt)}</span> : <span className="font-semibold text-orange-700">{t("ann.notAcknowledged")}</span>) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
