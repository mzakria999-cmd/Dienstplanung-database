import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader, ShiftChip } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, Table, Td, Th } from "@/components/ui/table";
import { addDays, berlinToday, dateKey, formatDate, formatTime } from "@/lib/time";
import { SickForm } from "./sick-form";
import { ReplacementPanel } from "./replacement-panel";
import { SickRowActions } from "./sick-row-actions";
import Link from "next/link";

export const metadata = { title: "Krankmeldungen" };
export const dynamic = "force-dynamic";

export default async function SickPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const staff = user.role !== "EMPLOYEE";
  const today = berlinToday();
  const where = staff ? {} : { employeeId: user.employeeId ?? "-" };
  const [leaves, employees, openSlots] = await Promise.all([
    prisma.sickLeave.findMany({ where: { ...where, toDate: { gte: addDays(today, -90) } }, include: { employee: true, assignments: { include: { shiftType: true, replacedBy: { include: { employee: true } } } } }, orderBy: { fromDate: "desc" }, take: 100 }),
    staff ? prisma.employee.findMany({ where: { status: "AKTIV" }, orderBy: { lastName: "asc" } }) : Promise.resolve([]),
    staff ? prisma.assignment.findMany({ where: { employeeId: null, isDraft: false, date: { gte: addDays(today, -1), lte: addDays(today, 62) } }, include: { shiftType: true, object: true, replacesAssignment: { include: { employee: true } }, offers: true }, orderBy: { startAt: "asc" } }) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={staff ? t("nav.sick") : t("sick.reportMe")} subtitle={t("sick.subtitle")} />
      <div className={staff ? "grid gap-6 xl:grid-cols-5" : "space-y-6"}>
        <div className={staff ? "space-y-6 xl:col-span-2" : "space-y-6"}>
          <Card>
            <CardHeader><CardTitle>{staff ? t("sick.registerTitle") : t("sick.reportMe")}</CardTitle></CardHeader>
            <CardContent><SickForm employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName} (${e.personnelNumber})` }))} self={!staff} /></CardContent>
          </Card>
          {staff ? (
            <Card>
              <CardHeader><CardTitle>{t("sick.openShifts")}</CardTitle><Badge tone={openSlots.length ? "orange" : "green"}>{openSlots.length}</Badge></CardHeader>
              <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
                {openSlots.length === 0 ? <Empty>{t("dash.noOpenShifts")}</Empty> : null}
                {openSlots.map((o) => (
                  <Link key={o.id} href={`/krankmeldungen?slot=${o.id}`} scroll={false} className={`flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-orange-50 ${sp.slot === o.id ? "border-2 border-blue-600 bg-blue-50" : "border-orange-200"}`}>
                    <div>
                      <div className="font-semibold">{formatDate(o.date, locale, { weekday: "short" })} · {formatTime(o.startAt)}–{formatTime(o.endAt)}</div>
                      <div className="text-xs text-slate-600">{o.object.name}{o.replacesAssignment?.employee ? ` · ${t("dash.insteadOf")} ${o.replacesAssignment.employee.firstName} ${o.replacesAssignment.employee.lastName}` : ""}</div>
                      {o.offers.some((f) => f.status === "ACCEPTED") ? <Badge tone="green">{t("sick.offerAccepted")}</Badge> : o.offers.some((f) => f.status === "OFFERED") ? <Badge tone="blue">{t("sick.offered", { n: o.offers.filter((f) => f.status === "OFFERED").length })}</Badge> : null}
                    </div>
                    <ShiftChip code={o.shiftType.code} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
        {staff ? (
          <div className="xl:col-span-3">
            {sp.slot ? <ReplacementPanel key={sp.slot} slotId={sp.slot} canAssign={user.role === "ADMIN"} /> : <Card><CardContent><Empty>{t("sick.selectSlot")}</Empty></CardContent></Card>}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>{t("sick.history")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {leaves.length === 0 ? <div className="p-5"><Empty>{t("common.noEntries")}</Empty></div> : (
            <Table>
              <thead><tr>{staff ? <Th>{t("grid.employee")}</Th> : null}<Th>{t("common.period")}</Th><Th>{t("sick.affectedShifts")}</Th><Th>{t("sick.certificate")}</Th><Th>{t("emp.statusLabel")}</Th>{staff ? <Th /> : null}</tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className={l.revokedAt ? "opacity-50" : ""}>
                    {staff ? <Td className="font-semibold">{l.employee.firstName} {l.employee.lastName}</Td> : null}
                    <Td className="whitespace-nowrap">{formatDate(l.fromDate, locale)} – {formatDate(l.toDate, locale)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {l.assignments.map((a) => (
                          <span key={a.id} className="inline-flex items-center gap-1 text-xs">
                            <ShiftChip code="K" label={`K ${a.shiftType.code} ${dateKey(a.date).slice(8)}.${dateKey(a.date).slice(5, 7)}.`} small />
                            {a.replacedBy?.employee ? <span className="text-green-700">→ {a.replacedBy.employee.firstName} {a.replacedBy.employee.lastName}</span> : a.replacedBy ? <Link className="font-semibold text-orange-600" href={`/krankmeldungen?slot=${a.replacedBy.id}`}>{t("grid.unassigned")}</Link> : null}
                          </span>
                        ))}
                        {l.assignments.length === 0 ? <span className="text-xs text-slate-500">{t("sick.noShifts")}</span> : null}
                      </div>
                    </Td>
                    <Td>{l.certificate ? <Badge tone="green">{t("common.yes")}</Badge> : <Badge>{t("common.no")}</Badge>}</Td>
                    <Td>{l.revokedAt ? <Badge>{t("sick.revoked")}</Badge> : l.confirmed ? <Badge tone="red">{t("status.SICK")}</Badge> : <Badge tone="yellow">{t("sick.unconfirmed")}</Badge>}</Td>
                    {staff ? <Td>{!l.revokedAt ? <SickRowActions id={l.id} confirmed={l.confirmed} isAdmin={user.role === "ADMIN"} /> : null}</Td> : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
