import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { authConfig } from "./auth.config";

class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

const MAX_FAILED = 5;
let dummyHash: string | null = null;
const LOCK_MINUTES = 15;

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
  code: z.string().max(10).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(raw) {
        const parsed = schema.safeParse({ ...raw, code: raw?.code || undefined });
        if (!parsed.success) throw new LoginError("invalid");
        const { email, password, code } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        // Gleiche Antwortzeit auch bei unbekannter E-Mail
        if (!user) {
          dummyHash ??= bcrypt.hashSync("timing-safe-dummy", 12);
          await bcrypt.compare(password, dummyHash);
          throw new LoginError("invalid");
        }
        if (!user.active) throw new LoginError("inactive");
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new LoginError("locked");

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
          });
          await prisma.auditLog.create({ data: { userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id } });
          throw new LoginError(failed >= MAX_FAILED ? "locked" : "invalid");
        }

        if (user.totpEnabled && user.totpSecretEnc) {
          if (!code) throw new LoginError("totp_required");
          const valid = authenticator.verify({ token: code.replace(/\s/g, ""), secret: decrypt(user.totpSecretEnc) });
          if (!valid) throw new LoginError("totp_invalid");
        }

        await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
        await prisma.auditLog.create({ data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id } });
        return { id: user.id, email: user.email, role: user.role } as never;
      },
    }),
  ],
});
