import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader, ShiftChip } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/table";
import { formatDate, formatTime } from "@/lib/time";
import { OfferButtons } from "./buttons";

export const metadata = { title: "Dienstangebote" };
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const offers = user.employeeId ? await prisma.shiftOffer.findMany({ where: { employeeId: user.employeeId }, include: { assignment: { include: { shiftType: true, object: true } } }, orderBy: { createdAt: "desc" }, take: 50 }) : [];
  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.offers")} subtitle={t("offers.subtitle")} />
      {offers.length === 0 ? <Empty>{t("common.noEntries")}</Empty> : null}
      {offers.map((o) => {
        const open = o.status === "OFFERED" && !o.assignment.employeeId;
        return (
          <Card key={o.id} className={open ? "border-2 border-blue-500" : ""}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><ShiftChip code={o.assignment.shiftType.code} label={locale === "de" ? o.assignment.shiftType.nameDe : o.assignment.shiftType.nameEn} /><b>{formatDate(o.assignment.date, locale, { weekday: "long" })}</b></div>
                <div className="mt-1 text-sm text-slate-600">{formatTime(o.assignment.startAt)}–{formatTime(o.assignment.endAt)} · {o.assignment.object.name}</div>
                {o.message ? <div className="text-sm">{o.message}</div> : null}
              </div>
              {open ? <OfferButtons id={o.id} /> : <Badge tone={o.status === "ACCEPTED" || o.status === "ASSIGNED" ? "green" : o.status === "REJECTED" ? "red" : "slate"}>{t(`offer.${o.status}` as never)}</Badge>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
