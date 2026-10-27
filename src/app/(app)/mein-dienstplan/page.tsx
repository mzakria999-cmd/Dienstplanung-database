import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { monthHoursFor } from "@/server/hours-service";
import { PageHeader, StatCard } from "@/components/common";
import { MonthNav } from "@/components/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { currentMonth, dateKey, formatHours, formatTime, isoWeekday, monthDays, monthRange } from "@/lib/time";
import { holidayMap } from "@/lib/holidays";
import { getSettings } from "@/server/settings";
import { Download } from "lucide-react";
import { RosterCalendar, type RosterDay } from "./calendar";

export const metadata = { title: "Mein Dienstplan" };
export const dynamic = "force-dynamic";

export default async function MyRosterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const cm = currentMonth();
  const year = Number(sp.year) || cm.year;
  const month = Number(sp.month) || cm.month;
  if (!user.employeeId) return <Empty>{t("roster.noProfile")}</Empty>;
  const plan = await prisma.monthPlan.findUnique({ where: { year_month: { year, month } } });
  const published = plan?.status === "PUBLISHED";
  const header = <PageHeader title={t("nav.myRoster")} actions={<><MonthNav year={year} month={month} />{published ? <a className={buttonVariants({ variant: "primary" })} href={`/api/pdf/schedule?year=${year}&month=${month}&download=1`}><Download className="h-4 w-4" />{t("roster.downloadPdf")}</a> : null}</>} />;
  if (!published) return <div>{header}<Empty>{t("roster.notPublished")}</Empty></div>;
  const { from, to } = monthRange(year, month);
  const [assignments, absences, settings] = await Promise.all([
    prisma.assignment.findMany({ where: { employeeId: user.employeeId, date: { gte: from, lte: to }, isDraft: false, status: { not: "CANCELLED" } }, include: { shiftType: true, object: true }, orderBy: { startAt: "asc" } }),
    prisma.absence.findMany({ where: { employeeId: user.employeeId, date: { gte: from, lte: to } } }),
    getSettings(),
  ]);
  const holidays = holidayMap([year], settings.bundesland);
  const h = (await monthHoursFor(year, month, [user.employeeId])).get(user.employeeId)!;
  const days: RosterDay[] = monthDays(year, month).map((d) => {
    const k = dateKey(d);
    const ab = absences.find((a) => dateKey(a.date) === k);
    return {
      key: k,
      day: d.getUTCDate(),
      dow: isoWeekday(d),
      holiday: holidays.get(k) ?? null,
      absence: ab ? (ab.type === "SICK" ? "K" : ab.type === "VACATION" ? "U" : ab.type === "UNEXCUSED" ? "FT" : null) : null,
      shifts: assignments.filter((a) => dateKey(a.date) === k).map((a) => ({
        id: a.id,
        code: a.status === "SICK" ? "K" : a.status === "ABSENT" ? "FT" : a.status === "VACATION" ? "U" : a.shiftType.code,
        name: locale === "de" ? a.shiftType.nameDe : a.shiftType.nameEn,
        start: formatTime(a.startAt),
        end: formatTime(a.endAt),
        object: a.object.name,
        changed: a.isChanged,
        planned: a.status === "PLANNED",
      })),
    };
  });
  return (
    <div className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={t("hours.target")} value={`${formatHours(h.target, locale)} h`} />
        <StatCard label={t("hours.planned")} value={`${formatHours(h.activePlanned, locale)} h`} tone="blue" />
        <StatCard label={t("hours.remaining")} value={`${formatHours(h.remainingToPlan, locale)} h`} />
        <StatCard label={t("hours.sick")} value={`${formatHours(h.sick, locale)} h`} tone="red" />
        <StatCard label={t("roster.shifts")} value={h.shiftCount} />
      </div>
      <Card><CardContent className="p-2 sm:p-4"><RosterCalendar days={days} /></CardContent></Card>
    </div>
  );
}
