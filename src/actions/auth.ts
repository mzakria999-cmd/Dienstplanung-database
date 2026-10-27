"use server";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { act } from "@/server/action";
import { AppError } from "@/server/errors";
import { requireUser } from "@/server/session";
import { audit } from "@/server/audit";
import { passwordSchema } from "@/server/validation";

export async function loginAction(_: unknown, form: FormData): Promise<{ error?: string; needsCode?: boolean }> {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { locale: true } });
    if (user) (await cookies()).set("locale", user.locale, { path: "/", maxAge: 31536000, sameSite: "lax", httpOnly: false });
    await signIn("credentials", { email, password: form.get("password"), code: form.get("code") || "", redirectTo: "/dashboard" });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code ?? "invalid";
      return { error: code, needsCode: code === "totp_required" || code === "totp_invalid" };
    }
    throw e;
  }
}

export async function logoutAction() {
  const u = await requireUser().catch(() => null);
  if (u) await audit(u.id, "LOGOUT", "User", u.id);
  await signOut({ redirectTo: "/login" });
}

export async function setLocaleAction(locale: "de" | "en") {
  const l = locale === "en" ? "en" : "de";
  (await cookies()).set("locale", l, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const u = await requireUser().catch(() => null);
  if (u) await prisma.user.update({ where: { id: u.id }, data: { locale: l } });
  return { ok: true };
}

export async function changePasswordAction(input: { current: string; next: string }) {
  return act(
    async () => {
      const u = await requireUser();
      const next = passwordSchema.parse(input.next);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      if (!(await bcrypt.compare(input.current, user.passwordHash))) throw new AppError("Aktuelles Passwort ist falsch", "Current password is wrong");
      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false } });
      await audit(u.id, "PASSWORD_CHANGE", "User", u.id);
    },
    { message: { de: "Passwort geändert", en: "Password changed" } },
  );
}

/** 2FA-Einrichtung: Secret erzeugen (noch nicht aktiv) und QR-Code liefern */
export async function start2faAction() {
  return act(
    async () => {
      const u = await requireUser();
      const secret = authenticator.generateSecret();
      await prisma.user.update({ where: { id: u.id }, data: { totpSecretEnc: encrypt(secret), totpEnabled: false } });
      const uri = authenticator.keyuri(u.email, "SecurityDienst Manager Pro", secret);
      return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
    },
    { revalidate: false },
  );
}

export async function enable2faAction(code: string) {
  return act(
    async () => {
      const u = await requireUser();
      const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      if (!user.totpSecretEnc) throw new AppError("Bitte zuerst 2FA einrichten", "Please set up 2FA first");
      if (!authenticator.verify({ token: z.string().regex(/^\d{6}$/).parse(code.replace(/\s/g, "")), secret: decrypt(user.totpSecretEnc) })) throw new AppError("Code ungültig", "Invalid code");
      await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
      await audit(u.id, "2FA_ENABLE", "User", u.id);
    },
    { message: { de: "Zwei-Faktor-Authentifizierung aktiviert", en: "Two-factor authentication enabled" } },
  );
}

export async function disable2faAction(password: string) {
  return act(async () => {
    const u = await requireUser();
    if (u.role === "ADMIN" && process.env.REQUIRE_ADMIN_2FA !== "false") throw new AppError("Für Administratoren ist 2FA verpflichtend", "2FA is mandatory for administrators");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new AppError("Passwort ist falsch", "Wrong password");
    await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: false, totpSecretEnc: null } });
    await audit(u.id, "2FA_DISABLE", "User", u.id);
  });
}
