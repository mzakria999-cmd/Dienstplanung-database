"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, Download, KeyRound, ShieldCheck } from "lucide-react";
import { changePasswordAction, disable2faAction, enable2faAction, start2faAction } from "@/actions/auth";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function ProfileClient(p: { setup: boolean; mustChangePassword: boolean; needs2fa: boolean; totpEnabled: boolean; isAdmin: boolean; hasEmployee: boolean; vapidKey: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { run, pending } = useAction();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw2fa, setPw2fa] = useState("");

  const enablePush = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error(t("profile.pushUnsupported"));
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error(t("profile.pushDenied"));
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(p.vapidKey) });
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error("Fehler");
      toast("success", t("profile.pushEnabled"));
    } catch (e) {
      toast("error", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {p.setup && (p.mustChangePassword || p.needs2fa) ? (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 text-sm lg:col-span-2">
          <b>{t("profile.setupRequired")}</b>
          <ul className="mt-1 list-disc pl-5">
            {p.mustChangePassword ? <li>{t("profile.mustChange")}</li> : null}
            {p.needs2fa ? <li>{t("profile.must2fa")}</li> : null}
          </ul>
        </div>
      ) : null}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />{t("profile.password")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label={t("profile.current")}><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
          <Field label={t("profile.new")} hint={t("profile.pwRules")}><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label={t("profile.repeat")}><Input type="password" autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} /></Field>
          <Button loading={pending} disabled={!next || next !== next2} onClick={() => run(() => changePasswordAction({ current, next }), { onSuccess: () => { setCurrent(""); setNext(""); setNext2(""); router.refresh(); } })}>{t("profile.change")}</Button>
          {next && next2 && next !== next2 ? <p className="text-xs text-red-600">{t("profile.mismatch")}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{t("profile.2fa")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {p.totpEnabled ? (
            <>
              <p className="font-semibold text-green-700">✓ {t("profile.2faActive")}</p>
              {!p.isAdmin ? (
                <div className="flex gap-2"><Input type="password" placeholder={t("login.password")} value={pw2fa} onChange={(e) => setPw2fa(e.target.value)} /><Button variant="outline" onClick={() => run(() => disable2faAction(pw2fa))}>{t("profile.disable2fa")}</Button></div>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-slate-600">{t("profile.2faExplain")}</p>
              {!qr ? <Button onClick={() => run(() => start2faAction(), { onSuccess: setQr })} loading={pending}>{t("profile.setup2fa")}</Button> : (
                <div className="space-y-3">
                  <img src={qr.qr} alt="QR-Code" className="h-48 w-48 rounded-lg border" />
                  <p className="text-xs">{t("profile.manualKey")}: <code className="select-all break-all rounded bg-slate-100 px-1">{qr.secret}</code></p>
                  <div className="flex gap-2"><Input inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[160px]" /><Button loading={pending} onClick={() => run(() => enable2faAction(code), { onSuccess: () => router.refresh() })}>{t("profile.activate")}</Button></div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" />{t("profile.push")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">{t("profile.pushExplain")}</p>
          <Button variant="outline" disabled={!p.vapidKey} onClick={enablePush}>{t("profile.enablePush")}</Button>
          {!p.vapidKey ? <p className="text-xs text-slate-500">{t("profile.pushNotConfigured")}</p> : null}
          <p className="text-xs text-slate-500">{t("profile.installHint")}</p>
        </CardContent>
      </Card>
      {p.hasEmployee ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />{t("profile.privacy")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-600">{t("profile.privacyText")}</p>
            <a className="font-semibold text-blue-700" href="/api/employees/export">{t("emp.gdprExport")} →</a>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
