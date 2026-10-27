import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePageUser, STAFF } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader, ShiftChip } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, Table, Td, Th } from "@/components/ui/table";
import { formatDate, formatTime, parseDateKey } from "@/lib/time";
import { ChangeFilters, RequestActions } from "./client";

export const metadata = { title: "Dienstplanänderungen" };
export const dynamic = "force-dynamic";

const notifyTone = { NOT_REQUIRED: "slate", PENDING: "yellow", SENT: "green", PARTIAL: "orange", FAILED: "red" } as const;

export default async function ChangesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser(STAFF);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const tab = sp.tab === "requests" ? "requests" : "history";
  const where: Prisma.ScheduleChangeWhereInput = {};
  if (sp.q) where.OR = [{ originalEmployeeName: { contains: sp.q, mode: "insensitive" } }, { newEmployeeName: { contains: sp.q, mode: "insensitive" } }, { reason: { contains: sp.q, mode: "insensitive" } }, { objectName: { contains: sp.q, mode: "insensitive" } }, { changedByName: { contains: sp.q, mode: "insensitive" } }];
  if (sp.type) where.type = sp.type as never;
  if (sp.shift) where.shiftCode = sp.shift;
  if (sp.from || sp.to) where.date = { gte: sp.from ? parseDateKey(sp.from) : undefined, lte: sp.to ? parseDateKey(sp.to) : undefined };
  const [changes, requests, offers] = await Promise.all([
    tab === "history" ? prisma.scheduleChange.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }) : Promise.resolve([]),
    tab === "requests" ? prisma.changeRequest.findMany({ include: { assignment: { include: { shiftType: true, employee: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 }) : Promise.resolve([]),
    tab === "requests" ? prisma.shiftOffer.findMany({ where: { status: { in: ["ACCEPTED", "OFFERED", "REJECTED"] }, assignment: { employeeId: null } }, include: { employee: true, assignment: { include: { shiftType: true, object: true } } }, orderBy: { createdAt: "desc" }, take: 100 }) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.changes")} subtitle={t("changes.subtitle")} />
      <div className="flex gap-2">
        <Link href="/aenderungen" className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "history" ? "bg-navy-800 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{t("changes.history")}</Link>
        <Link href="/aenderungen?tab=requests" className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "requests" ? "bg-navy-800 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{t("changes.requests")}</Link>
      </div>
      {tab === "history" ? (
        <>
          <ChangeFilters />
          <Card>
            <CardContent className="p-0">
              {changes.length === 0 ? <div className="p-5"><Empty>{t("common.noEntries")}</Empty></div> : (
                <Table>
                  <thead><tr><Th>{t("changes.when")}</Th><Th>{t("changes.type")}</Th><Th>{t("common.date")}</Th><Th>{t("grid.shift")}</Th><Th>{t("changes.original")}</Th><Th>{t("changes.new")}</Th><Th>{t("changes.origHours")}</Th><Th>{t("changes.reason")}</Th><Th>{t("changes.by")}</Th><Th>{t("changes.notification")}</Th></tr></thead>
                  <tbody>
                    {changes.map((c) => (
                      <tr key={c.id}>
                        <Td className="whitespace-nowrap text-xs">{c.createdAt.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}</Td>
                        <Td><Badge tone={c.type === "SICK" ? "red" : c.type === "REPLACEMENT" ? "blue" : c.type === "DELETED" ? "slate" : "purple"}>{t(`changeType.${c.type}` as never)}</Badge></Td>
                        <Td className="whitespace-nowrap">{formatDate(c.date, locale)}</Td>
                        <Td><ShiftChip code={c.shiftCode} small /> <span className="text-xs text-slate-500">{c.newStartAt ? `${formatTime(c.newStartAt)}–${formatTime(c.newEndAt!)}` : ""}</span><div className="text-xs text-slate-500">{c.objectName}</div></Td>
                        <Td>{c.originalEmployeeName ?? "—"}</Td>
                        <Td className="font-semibold">{c.newEmployeeName ?? "—"}</Td>
                        <Td>{c.originalHours ?? "—"}</Td>
                        <Td className="max-w-[220px] text-xs">{c.reason}</Td>
                        <Td className="text-xs">{c.changedByName}</Td>
                        <Td><Badge tone={notifyTone[c.notificationStatus]}>{t(`notify.${c.notificationStatus}` as never)}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3">
              <h3 className="font-semibold">{t("changes.requestsTitle")}</h3>
              {requests.length === 0 ? <Empty>{t("common.noEntries")}</Empty> : null}
              {requests.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between"><b>{r.requestedByName}</b><Badge tone={r.status === "OPEN" ? "yellow" : r.status === "APPROVED" ? "green" : "red"}>{t(`request.${r.status}` as never)}</Badge></div>
                  {r.assignment ? <div className="mt-1 text-xs text-slate-600">{formatDate(r.assignment.date, locale)} · {r.assignment.shiftType.code} · {r.assignment.employee ? `${r.assignment.employee.firstName} ${r.assignment.employee.lastName}` : ""}</div> : null}
                  <p className="mt-1 whitespace-pre-line">{r.message}</p>
                  {r.decisionNote ? <p className="mt-1 text-xs text-slate-500">→ {r.decisionNote}</p> : null}
                  {r.status === "OPEN" && user.role === "ADMIN" ? <RequestActions id={r.id} /> : null}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <h3 className="font-semibold">{t("changes.offersTitle")}</h3>
              {offers.length === 0 ? <Empty>{t("common.noEntries")}</Empty> : null}
              {offers.map((o) => (
                <Link key={o.id} href={`/krankmeldungen?slot=${o.assignmentId}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-slate-50">
                  <div><b>{o.employee.firstName} {o.employee.lastName}</b><div className="text-xs text-slate-600">{formatDate(o.assignment.date, locale)} · {o.assignment.shiftType.code} · {o.assignment.object.name}</div></div>
                  <Badge tone={o.status === "ACCEPTED" ? "green" : o.status === "REJECTED" ? "red" : "blue"}>{t(`offer.${o.status}` as never)}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
