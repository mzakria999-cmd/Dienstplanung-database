import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { monthHoursFor } from "@/server/hours-service";
import { PageHeader, Progress, StatCard } from "@/components/common";
import { MonthNav } from "@/components/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { currentMonth, formatHours } from "@/lib/time";
import type { MonthHours } from "@/lib/hours";
import type { TKey } from "@/lib/i18n";

export const metadata = { title: "Stundenübersicht" };
export const dynamic = "force-dynamic";

const COLS: Array<[keyof MonthHours, TKey]> = [
  ["target", "hours.target"],
  ["planned", "hours.planned"],
  ["actual", "hours.actual"],
  ["sick", "hours.sick"],
  ["vacation", "hours.vacation"],
  ["remainingToPlan", "hours.remaining"],
  ["overtime", "hours.overtime"],
  ["minus", "hours.minus"],
  ["night", "hours.night"],
  ["sunday", "hours.sunday"],
  ["holiday", "hours.holiday"],
];

export default async function HoursPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const cm = currentMonth();
  const year = Number(sp.year) || cm.year;
  const month = Number(sp.month) || cm.month;
  const own = user.role === "EMPLOYEE";
  const employees = await prisma.employee.findMany({ where: own ? { id: user.employeeId ?? "-" } : { status: "AKTIV" }, orderBy: { lastName: "asc" } });
  const hours = await monthHoursFor(year, month, employees.map((e) => e.id));
  const fh = (n: number) => formatHours(n, locale);

  if (own) {
    const h = hours.get(user.employeeId!)!;
    return (
      <div className="space-y-6">
        <PageHeader title={t("nav.hours")} actions={<MonthNav year={year} month={month} />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {COLS.map(([k, label]) => <StatCard key={k} label={t(label)} value={`${fh(h[k])} h`} tone={k === "overtime" && h[k] > 0 ? "orange" : k === "sick" && h[k] > 0 ? "red" : k === "actual" ? "green" : "slate"} />)}
          <StatCard label={t("hours.unconfirmed")} value={h.unconfirmed} hint={t("hours.unconfirmedHint")} />
        </div>
        <Card><CardContent><div className="mb-1 flex justify-between text-sm"><span>{t("hours.progress")}</span><b>{fh(h.activePlanned + h.sick + h.vacation)} / {fh(h.target)} h</b></div><Progress value={h.activePlanned + h.sick + h.vacation} max={h.target} /></CardContent></Card>
        <p className="text-xs text-slate-500">{t("hours.explain")}</p>
      </div>
    );
  }
  const totals = COLS.map(([k]) => [...hours.values()].reduce((a, h) => a + h[k], 0));
  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.hours")} subtitle={t("hours.subtitle")} actions={<MonthNav year={year} month={month} />} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>{t("grid.employee")}</Th>{COLS.map(([k, l]) => <Th key={k} className="text-right">{t(l)}</Th>)}<Th className="text-right">{t("hours.unconfirmedShort")}</Th></tr></thead>
            <tbody>
              {employees.map((e) => {
                const h = hours.get(e.id)!;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap"><b>{e.lastName}, {e.firstName}</b><div className="text-xs text-slate-500">{e.personnelNumber} · {t(`emp.type.${e.employmentType}` as never)}</div></Td>
                    {COLS.map(([k]) => <Td key={k} className={`text-right tabular-nums ${k === "overtime" && h[k] > 0 ? "font-semibold text-orange-600" : k === "minus" && h[k] > 0 ? "text-slate-500" : k === "sick" && h[k] > 0 ? "text-red-600" : ""}`}>{fh(h[k])}</Td>)}
                    <Td className={`text-right ${h.unconfirmed ? "font-semibold text-red-600" : ""}`}>{h.unconfirmed}</Td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold"><Td>{t("common.total")}</Td>{totals.map((v, i) => <Td key={i} className="text-right tabular-nums">{fh(v)}</Td>)}<Td /></tr>
            </tbody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">{t("hours.explain")}</p>
    </div>
  );
}
