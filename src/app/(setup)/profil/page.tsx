import { prisma } from "@/lib/db";
import { requirePageUser, needs2faSetup } from "@/server/session";
import { getT } from "@/server/i18n";
import { PageHeader } from "@/components/common";
import { ProfileClient } from "./client";

export const metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser();
  const { t } = await getT();
  const sp = await searchParams;
  const db = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { mustChangePassword: true, totpEnabled: true, email: true } });
  return (
    <div>
      <PageHeader title={t("nav.profile")} subtitle={user.email} />
      <ProfileClient
        setup={sp.setup === "1"}
        mustChangePassword={db.mustChangePassword}
        needs2fa={needs2faSetup(user)}
        totpEnabled={db.totpEnabled}
        isAdmin={user.role === "ADMIN"}
        hasEmployee={!!user.employeeId}
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />
    </div>
  );
}
