"use client";
import { useActionState, useState } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useT } from "@/components/i18n-provider";
import type { TKey } from "@/lib/i18n";

export function LoginForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(loginAction, {});
  // kontrollierte Felder: React setzt unkontrollierte Formulare nach einer Action zurück
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  return (
    <form action={formAction} className="space-y-4">
      <Field label={t("login.email")}>
        <Input name="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t("login.password")}>
        <Input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {state.needsCode ? (
        <Field label={t("login.code")} hint={t("login.codeHint")}>
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
      ) : null}
      {state.error && state.error !== "totp_required" ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t(`login.error.${state.error}` as TKey)}</p> : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("login.submit")}
      </Button>
    </form>
  );
}
