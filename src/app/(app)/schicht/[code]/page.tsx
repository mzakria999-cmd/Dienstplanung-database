import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser, STAFF } from "@/server/session";
import { getT } from "@/server/i18n";
import { shiftEntries } from "@/server/queries";
import { PageHeader, StatCard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntriesTable } from "@/components/entries-table";
import { DateFilter } from "@/components/date-filter";
import { addDays, berlinToday, dateKey, parseDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** FRÜHSCHICHT / SPÄTSCHICHT / NACHTSCHICHT – heute, geplant, vergangen, bevorstehend */
export default async function ShiftPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(STAFF);
  const { code } = await params;
  if (!["F", "S", "N"].includes(code)) notFound();
  const { t } = await getT();
  const sp = await searchParams;
  const today = berlinToday();
  const from = sp.from ? parseDateKey(sp.from) : today;
  const to = sp.to ? parseDateKey(sp.to) : addDays(from, 6);
  const st = await prisma.shiftType.findUnique({ where: { code } });
  const [todayList, range, past] = await Promise.all([
    shiftEntries(today, today, { code, includeOpen: true }),
    shiftEntries(from, to < from ? from : to, { code, includeOpen: true }),
    shiftEntries(addDays(today, -30), addDays(today, -1), { code }),
  ]);
  const pastPeople = new Map<string, { name: string; phone: string; count: number; last: string }>();
  for (const e of past) if (e.employee && e.status === "PLANNED") {
    const p = pastPeople.get(e.employee.id) ?? { name: e.employee.name, phone: e.employee.phone, count: 0, last: e.date };
    p.count++;
    p.last = e.date > p.last ? e.date : p.last;
    pastPeople.set(e.employee.id, p);
  }
  const header = { F: "bg-shift-f text-white", S: "bg-shift-s text-slate-900", N: "bg-shift-n text-white" }[code];
  const active = todayList.filter((e) => e.employee && e.status === "PLANNED");
  return (
    <div className="space-y-6">
      <div className={cn("rounded-2xl p-6", header)}>
        <div className="text-sm font-semibold uppercase tracking-wider opacity-90">{code === "F" ? "🟢" : code === "S" ? "🟡" : "🟠"} {t(`shift.${code}` as never)}</div>
        <div className="mt-1 text-3xl font-extrabold">{st?.startTime}–{st?.endTime}</div>
        <div className="text-sm opacity-90">{t("shiftPage.subtitle")}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("shiftPage.today")} value={active.length} />
        <StatCard label={t("dash.working")} value={active.filter((e) => e.running).length} tone="green" />
        <StatCard label={t("dash.unassigned")} value={todayList.filter((e) => !e.employee).length} tone="orange" />
        <StatCard label={t("dash.sick")} value={todayList.filter((e) => e.status === "SICK").length} tone="red" />
      </div>
      <Card>
        <CardHeader><CardTitle>{t("shiftPage.todayList")}</CardTitle></CardHeader>
        <CardContent><EntriesTable entries={todayList} canConfirm /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("shiftPage.scheduled")}</CardTitle><DateFilter value={dateKey(from)} to={dateKey(to)} /></CardHeader>
        <CardContent><EntriesTable entries={range} canConfirm={false} showDate /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("shiftPage.previous")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...pastPeople.values()].sort((a, b) => b.count - a.count).map((p) => (
            <div key={p.name} className="rounded-lg border p-3 text-sm">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-slate-500">{t("shiftPage.pastCount", { n: p.count })} · {t("shiftPage.last")} {p.last.split("-").reverse().join(".")}</div>
              <a className="text-xs font-semibold text-blue-700" href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}>{p.phone}</a>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
