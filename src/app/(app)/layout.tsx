import { redirect } from "next/navigation";
import { requirePageUser, needs2faSetup } from "@/server/session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

/** Alle Fachseiten: Pflicht zur Passwortänderung bzw. 2FA-Einrichtung (Admins) wird hier durchgesetzt */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { mustChangePassword: true } });
  if (needs2faSetup(user) || dbUser?.mustChangePassword) redirect("/profil?setup=1");
  return <AppShell user={user}>{children}</AppShell>;
}
