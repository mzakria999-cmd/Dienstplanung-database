import { prisma } from "@/lib/db";
import { requirePageUser, STAFF } from "@/server/session";
import { getT } from "@/server/i18n";
import { availableEmployees, shiftEntries } from "@/server/queries";
import { PageHeader, ShiftChip, TelLink } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntriesTable } from "@/components/entries-table";
import { DateFilter } from "@/components/date-filter";
import { berlinToday, dateKey, formatDate, parseDateKey } from "@/lib/time";
import { DayTools } from "./day-tools";

export const metadata = { title: "Tagesdienstplan" };
export const dynamic = "force-dynamic";

export default async function DailyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser(STAFF);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? parseDateKey(sp.date) : berlinToday();
  const [entries, available, shiftTypes, objects] = await Promise.all([
    shiftEntries(day, day, { includeOpen: true, objectId: sp.object }),
    availableEmployees(day),
    prisma.shiftType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.securityObject.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("daily.title")} subtitle={formatDate(day, locale, { weekday: "long" })} actions={<DateFilter single value={dateKey(day)} />} />
      {user.role === "ADMIN" ? <DayTools day={dateKey(day)} shiftTypes={shiftTypes.map((s) => ({ id: s.id, code: s.code, label: `${s.code} · ${s.startTime}–${s.endTime}` }))} objects={objects.map((o) => ({ id: o.id, name: o.name }))} /> : null}
      {(["F", "S", "N"] as const).map((code) => {
        const list = entries.filter((e) => e.code === code);
        return (
          <Card key={code}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShiftChip code={code} label={t(`shift.${code}`)} /> <span className="text-sm font-normal text-slate-500">{list.filter((e) => e.employee && e.status === "PLANNED").length} {t("dash.employees")}</span></CardTitle>
            </CardHeader>
            <CardContent><EntriesTable entries={list} canConfirm /></CardContent>
          </Card>
        );
      })}
      <Card>
        <CardHeader><CardTitle>{t("dash.availableToday")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((e) => <div key={e.id} className="flex justify-between rounded-lg border p-2 text-sm"><span className="font-semibold">{e.name}</span><TelLink phone={e.phone} /></div>)}
        </CardContent>
      </Card>
    </div>
  );
}
