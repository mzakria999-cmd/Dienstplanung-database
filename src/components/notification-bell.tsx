"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useT } from "./i18n-provider";

type N = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string; type: string };

export function NotificationBell() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<{ items: N[]; unread: number }>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setData(await r.json());
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(i);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (n: N) => {
    await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ id: n.id }) });
    setOpen(false);
    load();
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t("nav.notifications")}>
        <Bell className="h-5 w-5" />
        {data.unread > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{data.unread > 99 ? "99+" : data.unread}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">{t("nav.notifications")}</span>
            {data.unread > 0 ? (
              <button
                className="text-xs font-semibold text-blue-600"
                onClick={async () => {
                  await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
                  load();
                }}
              >
                {t("notif.markAll")}
              </button>
            ) : null}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {data.items.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{t("notif.empty")}</p> : null}
            {data.items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${n.readAt ? "" : "bg-blue-50/60"}`}>
                <div className="flex items-start gap-2">
                  {!n.readAt ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" /> : <span className="mt-1.5 h-2 w-2 shrink-0" />}
                  <div className="min-w-0">
                    <div className={`text-sm ${n.type === "URGENT_ANNOUNCEMENT" ? "font-bold text-red-700" : "font-semibold"}`}>{n.title}</div>
                    <div className="line-clamp-2 text-xs text-slate-600">{n.body}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Link href="/benachrichtigungen" onClick={() => setOpen(false)} className="block bg-slate-50 px-4 py-2 text-center text-sm font-semibold text-blue-700">
            {t("notif.all")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
