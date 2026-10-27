import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/server/session";
import { getT } from "@/server/i18n";
import { LoginForm } from "./login-form";
import { LanguageSwitch } from "@/components/language-switch";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-col justify-between bg-navy-900 p-8 text-white lg:w-1/2 lg:p-14">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold">SecurityDienst Manager Pro</div>
            <div className="text-sm text-blue-200">{t("login.tagline")}</div>
          </div>
        </div>
        <div className="mt-10 hidden max-w-md lg:block">
          <h1 className="text-4xl font-bold leading-tight">{t("login.hero")}</h1>
          <div className="mt-8 flex gap-3">
            <span className="rounded-lg bg-shift-f px-3 py-2 text-sm font-semibold">🟢 {t("shift.F")}</span>
            <span className="rounded-lg bg-shift-s px-3 py-2 text-sm font-semibold text-slate-900">🟡 {t("shift.S")}</span>
            <span className="rounded-lg bg-shift-n px-3 py-2 text-sm font-semibold">🟠 {t("shift.N")}</span>
          </div>
        </div>
        <p className="mt-6 hidden text-xs text-blue-200 lg:block">{t("login.gdpr")}</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">{t("login.title")}</h2>
            <LanguageSwitch />
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
