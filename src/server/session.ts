import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  locale: "de" | "en";
  totpEnabled: boolean;
  employeeId: string | null;
  name: string;
};

export class ForbiddenError extends Error {
  constructor(message = "Keine Berechtigung") {
    super(message);
  }
}

/** Lädt den angemeldeten Benutzer frisch aus der DB (Deaktivierung wirkt sofort). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, include: { employee: true } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    locale: user.locale,
    totpEnabled: user.totpEnabled,
    employeeId: user.employee?.id ?? null,
    name: user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email,
  };
}

/** Für Seiten: leitet auf Login um bzw. wirft 403 bei fehlender Rolle. */
export async function requirePageUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?forbidden=1");
  return user;
}

/** Für Server Actions / API-Routen. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("Nicht angemeldet");
  if (roles && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export const ADMIN: Role[] = ["ADMIN"];
export const STAFF: Role[] = ["ADMIN", "SUPERVISOR"];

export function needs2faSetup(user: SessionUser): boolean {
  return user.role === "ADMIN" && process.env.REQUIRE_ADMIN_2FA !== "false" && !user.totpEnabled;
}
