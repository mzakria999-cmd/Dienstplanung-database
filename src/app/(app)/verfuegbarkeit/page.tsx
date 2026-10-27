import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/table";
import { berlinToday, formatDate } from "@/lib/time";
import { AvailabilityForm, DeleteAvailability } from "./client";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Verfügbarkeit" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const list = user.employeeId ? await prisma.availability.findMany({ where: { employeeId: user.employeeId, date: { gte: berlinToday() } }, orderBy: { date: "asc" } }) : [];
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.availability")} subtitle={t("avail.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>{t("avail.add")}</CardTitle></CardHeader><CardContent><AvailabilityForm /></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>{t("avail.list")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {list.length === 0 ? <Empty>{t("common.noEntries")}</Empty> : null}
            {list.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div><b>{formatDate(a.date, locale, { weekday: "short" })}</b> <Badge tone={a.type === "UNAVAILABLE" ? "red" : a.type === "PREFERRED_OFF" ? "yellow" : "green"}>{t(`avail.${a.type}` as never)}</Badge> {a.shiftCode ? <Badge>{a.shiftCode}</Badge> : null}<div className="text-xs text-slate-500">{a.note}</div></div>
                <DeleteAvailability id={a.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
