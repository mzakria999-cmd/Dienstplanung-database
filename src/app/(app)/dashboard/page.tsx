import Link from "next/link";
import { AlertTriangle, CalendarClock, HeartPulse, PhoneCall, UserCheck, Users, Activity, Download, Megaphone, Handshake } from "lucide-react";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { dashboardData, employeeDashboard } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/table";
import { PageHeader, Progress, ShiftChip, StatCard, TelLink } from "@/components/common";
import { formatDate, formatHours, parseDateKey, weekdayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  if (user.role === "EMPLOYEE") return <EmployeeDashboard employeeId={user.employeeId!} name={user.name} />;
  const d = await dashboardData();
  const shiftBtn = (code: "F" | "S" | "N", cls: string) => (
    <Link href={`/schicht/${code}`} className={cn("flex items-center justify-between rounded-2xl p-5 text-left shadow-sm transition hover:shadow-lg sm:p-6", cls)}>
      <div>
        <div className="text-sm font-semibold uppercase tracking-wider opacity-90">{t(`shift.${code}`)}</div>
        <div className="mt-1 text-4xl font-extrabold">{d.counts[code]}</div>
        <div className="text-sm opacity-90">{t("dash.employeesToday")}</div>
      </div>
      <div className="text-5xl" aria-hidden>
        {code === "F" ? "🟢" : code === "S" ? "🟡" : "🟠"}
      </div>
    </Link>
  );
  const maxBar = Math.max(1, ...d.week.map((w) => Math.max(w.F + w.S + w.N, w.req.F + w.req.S + w.req.N)));
  return (
    <div className="space-y-6">
      <PageHeader title={t("dash.title")} subtitle={`${t("dash.todayInDuty")} · ${formatDate(parseDateKey(d.today), locale, { weekday: "long" })}`} />
      <div className="grid gap-4 md:grid-cols-3">
        {shiftBtn("F", "bg-shift-f text-white")}
        {shiftBtn("S", "bg-shift-s text-slate-900")}
        {shiftBtn("N", "bg-shift-n text-white")}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label={t("dash.working")} value={d.running.length} tone="green" icon={<Activity className="h-4 w-4" />} />
        <StatCard label={t("dash.scheduled")} value={d.scheduledToday.length} icon={<Users className="h-4 w-4" />} href="/dienstplanung/tag" />
        <StatCard label={t("dash.sick")} value={d.sick.length} tone="red" icon={<HeartPulse className="h-4 w-4" />} href="/krankmeldungen" />
        <StatCard label={t("dash.available")} value={d.available.length} tone="blue" icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label={t("dash.unassigned")} value={d.openSlots.length} tone={d.openSlots.length ? "orange" : "slate"} href="/krankmeldungen" />
        <StatCard label={t("dash.missingCoverage")} value={d.missingToday} tone={d.missingToday ? "red" : "slate"} hint={t("dash.today")} />
        <StatCard label={t("dash.pendingChanges")} value={d.pending.requests + d.pending.offers} tone={d.pending.requests + d.pending.offers ? "yellow" : "slate"} href="/aenderungen?tab=requests" />
        <StatCard label={t("dash.pendingAnnouncements")} value={d.pending.announcements} href="/mitteilungen/gesendet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("dash.weekCoverage")}</CardTitle>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-shift-f" />F</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-shift-s" />S</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-shift-n" />N</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-red-500" />{t("dash.required")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-2 sm:gap-4">
              {d.week.map((w) => {
                const reqTotal = w.req.F + w.req.S + w.req.N;
                const h = (n: number) => `${(n / maxBar) * 100}%`;
                return (
                  <div key={w.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div className="relative flex h-full w-full max-w-[56px] flex-col justify-end overflow-hidden rounded-t-md bg-slate-50">
                      <div className="bg-shift-n" style={{ height: h(w.N) }} title={`N ${w.N}`} />
                      <div className="bg-shift-s" style={{ height: h(w.S) }} title={`S ${w.S}`} />
                      <div className="bg-shift-f" style={{ height: h(w.F) }} title={`F ${w.F}`} />
                      {reqTotal ? <div className="absolute inset-x-0 border-t-2 border-dashed border-red-500" style={{ bottom: h(reqTotal) }} /> : null}
                    </div>
                    <div className="text-xs font-semibold text-slate-600">{weekdayShort(parseDateKey(w.key), locale)}</div>
                    <div className="text-[11px] text-slate-400">{w.F + w.S + w.N}/{reqTotal}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dash.monthHours")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm"><span>{t("hours.planned")}</span><b>{formatHours(d.month.planned, locale)} h</b></div>
              <Progress value={d.month.planned} max={d.month.target} className="mt-1" />
            </div>
            <div>
              <div className="flex justify-between text-sm"><span>{t("hours.actual")}</span><b>{formatHours(d.month.actual, locale)} h</b></div>
              <Progress value={d.month.actual} max={d.month.target} className="mt-1" />
            </div>
            <div className="flex justify-between border-t pt-3 text-sm"><span>{t("hours.target")}</span><b>{formatHours(d.month.target, locale)} h</b></div>
            <Link href="/stunden" className="block text-sm font-semibold text-blue-700">{t("dash.toHours")} →</Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("dash.workingNow")}</CardTitle><Badge tone="green">{d.running.length}</Badge></CardHeader>
          <CardContent className="space-y-2">
            {d.running.length === 0 ? <Empty>{t("dash.nobodyWorking")}</Empty> : null}
            {d.running.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{e.employee?.name}</div>
                  <div className="truncate text-xs text-slate-500">{e.object} · {e.start}–{e.end}</div>
                </div>
                <div className="flex items-center gap-2"><ShiftChip code={e.code} changed={e.isChanged} small /><TelLink phone={e.employee?.phone ?? ""} className="text-xs" /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dash.openShifts")}</CardTitle><Link href="/krankmeldungen" className="text-sm font-semibold text-blue-700">{t("dash.findReplacement")}</Link></CardHeader>
          <CardContent className="space-y-2">
            {d.openSlots.length === 0 ? <Empty>{t("dash.noOpenShifts")}</Empty> : null}
            {d.openSlots.map((o) => (
              <Link key={o.id} href={`/krankmeldungen?slot=${o.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50/50 p-2 hover:bg-orange-50">
                <div className="min-w-0">
                  <div className="font-semibold">{formatDate(parseDateKey(o.date), locale)} · {o.start}–{o.end}</div>
                  <div className="truncate text-xs text-slate-600">{o.object}{o.replaces ? ` · ${t("dash.insteadOf")} ${o.replaces}` : ""}</div>
                </div>
                <ShiftChip code={o.code} small />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dash.availableToday")}</CardTitle><Badge tone="blue">{d.available.length}</Badge></CardHeader>
          <CardContent className="space-y-2">
            {d.available.length === 0 ? <Empty>—</Empty> : null}
            {d.available.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <div><div className="font-semibold">{e.name}</div><div className="text-xs text-slate-500">{e.pnr} · <Badge tone="green">FREI</Badge></div></div>
                <a href={`tel:${e.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white"><PhoneCall className="h-3.5 w-3.5" />{t("common.call")}</a>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dash.upcoming")}</CardTitle><CalendarClock className="h-4 w-4 text-slate-400" /></CardHeader>
          <CardContent className="space-y-2">
            {d.upcoming.length === 0 ? <Empty>—</Empty> : null}
            {d.upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm">
                <span className="font-semibold">{e.employee?.name}</span>
                <span className="flex items-center gap-2 text-slate-600">{e.start} <ShiftChip code={e.code} changed={e.isChanged} small /></span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("dash.sickToday")}</CardTitle><Badge tone="red">{d.sick.length}</Badge></CardHeader>
          <CardContent className="space-y-2">
            {d.sick.length === 0 ? <Empty>—</Empty> : d.sick.map((n) => <div key={n} className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800"><HeartPulse className="h-4 w-4" />{n}</div>)}
          </CardContent>
        </Card>
        {d.missingToday > 0 ? (
          <Card className="border-red-200">
            <CardContent className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
              <div><div className="font-semibold text-red-700">{t("dash.coverageAlert", { n: d.missingToday })}</div><Link href="/dienstplanung/tag" className="text-sm font-semibold text-blue-700">{t("dash.toDaily")} →</Link></div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

async function EmployeeDashboard({ employeeId, name }: { employeeId: string; name: string }) {
  const { t, locale } = await getT();
  const d = await employeeDashboard(employeeId);
  return (
    <div className="space-y-6">
      <PageHeader title={t("dash.hello", { name: name.split(" ")[0] })} subtitle={t("dash.employeeSubtitle")} />
      {d.unackd.length ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-red-700"><Megaphone className="h-5 w-5" />{t("dash.ackRequired")}</div>
            {d.unackd.map((a) => <Link key={a.id} href={`/meine-mitteilungen?id=${a.id}`} className="block rounded-lg bg-white p-3 font-semibold hover:bg-red-100">{a.subject} →</Link>)}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("hours.target")} value={`${formatHours(d.hours.target, locale)} h`} />
        <StatCard label={t("hours.planned")} value={`${formatHours(d.hours.activePlanned, locale)} h`} tone="blue" />
        <StatCard label={t("hours.actual")} value={`${formatHours(d.hours.actual, locale)} h`} tone="green" />
        <StatCard label={t("hours.remaining")} value={`${formatHours(d.hours.remainingToPlan, locale)} h`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/mein-dienstplan" className="flex items-center gap-3 rounded-xl bg-navy-800 p-4 font-semibold text-white"><CalendarClock className="h-6 w-6" />{t("nav.myRoster")}</Link>
        <Link href="/krankmeldungen" className="flex items-center gap-3 rounded-xl bg-red-600 p-4 font-semibold text-white"><HeartPulse className="h-6 w-6" />{t("sick.reportMe")}</Link>
        <a href={`/api/pdf/schedule?year=${d.year}&month=${d.month}&download=1`} className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white p-4 font-semibold"><Download className="h-6 w-6" />{t("roster.downloadPdf")}</a>
      </div>
      {d.offers > 0 ? (
        <Link href="/angebote" className="flex items-center gap-3 rounded-xl border-2 border-blue-500 bg-blue-50 p-4 font-semibold text-blue-800"><Handshake className="h-6 w-6" />{t("dash.openOffers", { n: d.offers })}</Link>
      ) : null}
      <Card>
        <CardHeader><CardTitle>{t("dash.myNextShifts")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {d.upcoming.length === 0 ? <Empty>{t("dash.noUpcoming")}</Empty> : null}
          {d.upcoming.map((a) => (
            <div key={a.id} className={cn("flex items-center justify-between rounded-xl border p-3", a.changed ? "border-red-500" : "border-slate-200")}>
              <div>
                <div className="font-semibold">{formatDate(parseDateKey(a.date), locale, { weekday: "short" })}</div>
                <div className="text-sm text-slate-600">{a.start}–{a.end} · {a.object}</div>
              </div>
              <ShiftChip code={a.code} label={locale === "de" ? a.name : a.nameEn} changed={a.changed} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
