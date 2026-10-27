import type { SessionUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { getT } from "@/server/i18n";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitch } from "./language-switch";
import { UserMenu } from "./user-menu";

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const { t } = await getT();
  const settings = await getSettings();
  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} hasEmployee={!!user.employeeId} company={settings.companyName} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:gap-3 lg:px-8">
          <div className="mr-auto truncate pl-12 text-sm font-semibold text-slate-700 lg:pl-0">{settings.companyName}</div>
          <LanguageSwitch />
          <NotificationBell />
          <UserMenu name={user.name} roleLabel={t(`role.${user.role}`)} />
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 pb-24 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
