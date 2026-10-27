import { requirePageUser } from "@/server/session";
import { AppShell } from "@/components/app-shell";

/** Profil/Sicherheit – ohne Weiterleitungspflicht, damit Passwort/2FA eingerichtet werden können */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <AppShell user={user}>{children}</AppShell>;
}
