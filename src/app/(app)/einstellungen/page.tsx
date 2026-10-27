import { prisma } from "@/lib/db";
import { requirePageUser, ADMIN } from "@/server/session";
import { getT } from "@/server/i18n";
import { getSettings } from "@/server/settings";
import { mailProvider } from "@/server/mail";
import { pushEnabled } from "@/server/push";
import { PageHeader } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { SettingsForm, ShiftTypesForm } from "./client";

export const metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageUser(ADMIN);
  const { t, locale } = await getT();
  const [s, shiftTypes, audit, admins] = await Promise.all([
    getSettings(),
    prisma.shiftType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.auditLog.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true, totpEnabled: true, lastLoginAt: true, active: true } }),
  ]);
  const { updatedAt: _u, id: _id, ...settings } = s;
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.settings")} />
      <Card>
        <CardHeader><CardTitle>{t("settings.system")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>{t("dispatch.mailProvider")}: <Badge tone={mailProvider() === "none" ? "red" : "green"}>{mailProvider().toUpperCase()}</Badge></div>
          <div>Web-Push: <Badge tone={pushEnabled() ? "green" : "slate"}>{pushEnabled() ? t("common.active") : t("common.inactive")}</Badge></div>
          <div>{t("settings.admin2fa")}: <Badge tone={process.env.REQUIRE_ADMIN_2FA === "false" ? "orange" : "green"}>{process.env.REQUIRE_ADMIN_2FA === "false" ? t("common.optional") : t("common.required")}</Badge></div>
          <div>{t("settings.admins")}: {admins.map((a) => <span key={a.email} className="mr-2">{a.email} {a.totpEnabled ? "🔐" : "⚠️"}</span>)}</div>
        </CardContent>
      </Card>
      <ShiftTypesForm shiftTypes={shiftTypes.map((x) => ({ id: x.id, code: x.code, nameDe: x.nameDe, nameEn: x.nameEn, startTime: x.startTime, endTime: x.endTime, breakMinutes: x.breakMinutes, color: x.color }))} />
      <SettingsForm initial={settings} />
      <Card>
        <CardHeader><CardTitle>{t("settings.audit")}</CardTitle></CardHeader>
        <CardContent className="max-h-[480px] overflow-auto p-0">
          <Table className="text-xs">
            <thead><tr><Th>{t("changes.when")}</Th><Th>{t("settings.user")}</Th><Th>{t("settings.action")}</Th><Th>{t("settings.entity")}</Th><Th>IP</Th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id}><Td className="whitespace-nowrap">{a.createdAt.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin" })}</Td><Td>{a.user?.email ?? "System"}</Td><Td className="font-mono">{a.action}</Td><Td>{a.entity}{a.entityId ? ` · ${a.entityId.slice(0, 10)}` : ""}</Td><Td>{a.ip ?? ""}</Td></tr>)}</tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
