import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/cron", "/offline", "/manifest.webmanifest", "/sw.js", "/icons", "/favicon.ico"];

/** Edge-kompatible Basis-Konfiguration (Middleware) – ohne Datenbankzugriff */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 10 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
