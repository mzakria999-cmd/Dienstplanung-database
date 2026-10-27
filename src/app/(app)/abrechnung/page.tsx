import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { payrollRows, PAYROLL_COLUMNS } from "@/server/payroll";
import { PageHeader, StatCard } from "@/components/common";
import { MonthNav } from "@/components/month-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { currentMonth, formatHours, formatMonth } from "@/lib/time";
import { FileSpreadsheet, FileText, FileDown, Calculator, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ConfirmAllButton } from "./confirm-all";

export const metadata = { title: "Monatsabrechnung" };
export const dynamic = "force-dynamic";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(ADMIN);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const cm = currentMonth();
  // Standard: Vormonat (Abrechnung nach Monatsende)
  const def = cm.month === 1 ? { year: cm.year - 1, month: 12 } : { year: cm.year, month: cm.month - 1 };
  const year = Number(sp.year) || def.year;
  const month = Number(sp.month) || def.month;
  const created = sp.create === "1";
  const rows = created ? await payrollRows(year, month) : [];
  const q = `year=${year}&month=${month}`;
  const unconfirmed = rows.reduce((a, r) => a + r.unconfirmed, 0);
  const sum = (k: "total" | "actual" | "overtime" | "night" | "sunday" | "holiday" | "sick") => rows.reduce((a, r) => a + r[k], 0);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.payroll")} subtitle={t("payroll.subtitle")} actions={<MonthNav year={year} month={month} />} />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Link href={`/abrechnung?${q}&create=1`} className={buttonVariants({ variant: "primary", size: "xl" })}><Calculator className="h-6 w-6" />{t("payroll.create")}</Link>
          {created ? (
            <>
              <a href={`/api/reports/payroll?${q}&format=pdf`} className={buttonVariants({ variant: "outline", size: "lg" })}><FileText className="h-5 w-5" />PDF</a>
              <a href={`/api/reports/payroll?${q}&format=xlsx`} className={buttonVariants({ variant: "outline", size: "lg" })}><FileSpreadsheet className="h-5 w-5" />Excel (.xlsx)</a>
              <a href={`/api/reports/payroll?${q}&format=csv`} className={buttonVariants({ variant: "outline", size: "lg" })}><FileDown className="h-5 w-5" />CSV</a>
              <a href={`/api/reports/payroll?${q}&format=datev`} className={buttonVariants({ variant: "outline", size: "lg" })}><FileDown className="h-5 w-5" />DATEV LODAS</a>
            </>
          ) : <span className="text-sm text-slate-500">{t("payroll.hint", { month: formatMonth(year, month, locale) })}</span>}
        </CardContent>
      </Card>
      {created ? (
        <>
          {unconfirmed > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 p-4 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600" />
              <div className="flex-1"><b>{t("payroll.unconfirmedWarn", { n: unconfirmed })}</b><br />{t("payroll.unconfirmedHint")} <Link className="font-semibold text-blue-700" href="/dienstplanung/tag">{t("planning.daily")} →</Link></div>
              <ConfirmAllButton year={year} month={month} n={unconfirmed} />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <StatCard label={t("payroll.total")} value={formatHours(sum("total"), locale)} tone="blue" />
            <StatCard label={t("hours.actual")} value={formatHours(sum("actual"), locale)} tone="green" />
            <StatCard label={t("hours.sick")} value={formatHours(sum("sick"), locale)} tone="red" />
            <StatCard label={t("hours.overtime")} value={formatHours(sum("overtime"), locale)} tone="orange" />
            <StatCard label={t("hours.night")} value={formatHours(sum("night"), locale)} />
            <StatCard label={t("hours.sunday")} value={formatHours(sum("sunday"), locale)} />
            <StatCard label={t("hours.holiday")} value={formatHours(sum("holiday"), locale)} />
          </div>
          <Card>
            <CardHeader><CardTitle>{t("payroll.preview")} {formatMonth(year, month, locale)}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs">
                <thead><tr>{PAYROLL_COLUMNS.map((c) => <Th key={c.key} className={c.num ? "text-right" : ""}>{locale === "de" ? c.de : c.en}</Th>)}<Th>{t("hours.unconfirmedShort")}</Th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.employeeId} className="hover:bg-slate-50">
                      {PAYROLL_COLUMNS.map((c) => <Td key={c.key} className={c.num ? "text-right tabular-nums" : "whitespace-nowrap"}>{c.num ? formatHours(r[c.key] as number, locale) : String(r[c.key])}</Td>)}
                      <Td className={r.unconfirmed ? "font-bold text-red-600" : ""}>{r.unconfirmed}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-slate-500">{t("payroll.explain")}</p>
        </>
      ) : null}
    </div>
  );
}
