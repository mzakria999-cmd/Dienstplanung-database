import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { preflight } from "@/server/dispatch";
import { mailProvider } from "@/server/mail";
import { PageHeader } from "@/components/common";
import { MonthNav } from "@/components/month-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, Table, Td, Th } from "@/components/ui/table";
import { formatMonth, nextMonth } from "@/lib/time";
import { DispatchPanel, EmailRetry, PdfPreview, ArchiveButton, BatchRetry } from "./client";

export const metadata = { title: "PDF & Berichte" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(ADMIN);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const nm = nextMonth();
  const year = Number(sp.year) || nm.year;
  const month = Number(sp.month) || nm.month;
  const [pf, employees, batches, failed, versions] = await Promise.all([
    preflight(year, month),
    prisma.employee.findMany({ where: { status: "AKTIV" }, orderBy: { lastName: "asc" } }),
    prisma.dispatchBatch.findMany({ include: { emails: { select: { status: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.emailLog.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, to: true, subject: true, lastError: true, attempts: true, createdAt: true } }),
    prisma.planVersion.findMany({ where: { monthPlan: { year, month } }, orderBy: { version: "desc" }, select: { id: true, version: true, reason: true, createdAt: true } }),
  ]);
  const fmt = (d: Date) => d.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" });
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.reports")} subtitle={t("reports.subtitle")} actions={<MonthNav year={year} month={month} />} />
      <DispatchPanel
        year={year}
        month={month}
        monthLabel={formatMonth(year, month, locale)}
        plan={{ status: pf.plan.status, version: pf.plan.version, publishedAt: pf.plan.publishedAt ? fmt(pf.plan.publishedAt) : null, archived: pf.plan.archived }}
        warnings={pf.warnings.map((w) => ({ level: w.level, text: locale === "de" ? w.de : w.en }))}
        recipients={pf.recipients}
        drafts={pf.drafts}
        employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}`, pnr: e.personnelNumber, hasEmail: !!e.email }))}
        mailProvider={mailProvider()}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("reports.pdfPreview")}</CardTitle></CardHeader>
          <CardContent><PdfPreview year={year} month={month} employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName} (${e.personnelNumber})` }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("reports.versions")}</CardTitle><ArchiveButton year={year} month={month} archived={pf.plan.archived} /></CardHeader>
          <CardContent>
            {versions.length === 0 ? <Empty>{t("reports.noVersions")}</Empty> : (
              <ul className="space-y-1 text-sm">{versions.map((v) => <li key={v.id} className="flex justify-between rounded border px-3 py-2"><span><b>v{v.version}</b> · {v.reason}</span><span className="text-xs text-slate-500">{fmt(v.createdAt)}</span></li>)}</ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("reports.batches")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? <div className="p-5"><Empty>{t("common.noEntries")}</Empty></div> : (
            <Table>
              <thead><tr><Th>{t("reports.batch")}</Th><Th>{t("reports.when")}</Th><Th>{t("reports.sent")}</Th><Th>{t("reports.failed")}</Th><Th /></tr></thead>
              <tbody>
                {batches.map((b) => {
                  const sent = b.emails.filter((e) => e.status === "SENT").length;
                  const failedN = b.emails.filter((e) => e.status !== "SENT").length;
                  return (
                    <tr key={b.id}>
                      <Td className="font-semibold">{b.label}</Td>
                      <Td className="text-xs">{fmt(b.createdAt)}</Td>
                      <Td><Badge tone="green">{sent}</Badge></Td>
                      <Td>{failedN ? <Badge tone="red">{failedN}</Badge> : "0"}</Td>
                      <Td>{failedN ? <BatchRetry id={b.id} /> : null}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("reports.failedEmails")}</CardTitle><Badge tone={failed.length ? "red" : "green"}>{failed.length}</Badge></CardHeader>
        <CardContent className="p-0">
          {failed.length === 0 ? <div className="p-5"><Empty>{t("reports.noFailed")}</Empty></div> : (
            <Table>
              <thead><tr><Th>{t("emp.email")}</Th><Th>{t("ann.subject")}</Th><Th>{t("reports.error")}</Th><Th>{t("reports.attempts")}</Th><Th /></tr></thead>
              <tbody>{failed.map((f) => <tr key={f.id}><Td>{f.to}</Td><Td className="text-xs">{f.subject}</Td><Td className="max-w-xs text-xs text-red-700">{f.lastError}</Td><Td>{f.attempts}</Td><Td><EmailRetry id={f.id} /></Td></tr>)}</tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
