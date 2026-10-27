"use client";
import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { acknowledgeAction, markOpenedAction } from "@/actions/announcements";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MyAnnouncement({ a, highlight }: { a: { id: string; subject: string; message: string; priority: string; requireAck: boolean; sentAt: string; from: string; opened: boolean; acknowledgedAt: string | null }; highlight: boolean }) {
  const t = useT();
  const { run, pending } = useAction();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // "geöffnet in der App" erfassen, sobald die Mitteilung sichtbar ist
    if (a.opened || !ref.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        markOpenedAction(a.id);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    if (highlight) ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => obs.disconnect();
  }, [a.id, a.opened, highlight]);
  return (
    <div ref={ref}>
      <Card className={cn(a.priority === "DRINGEND" ? "border-2 border-red-500" : a.priority === "WICHTIG" ? "border-2 border-orange-400" : "", highlight && "ring-4 ring-blue-300")}>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {a.priority !== "NORMAL" ? <Badge tone={a.priority === "DRINGEND" ? "red" : "orange"}>{t(`priority.${a.priority}` as never)}</Badge> : null}
            {!a.opened ? <Badge tone="blue">{t("ann.new")}</Badge> : null}
            <span className="text-xs text-slate-500">{a.sentAt} · {a.from}</span>
          </div>
          <h2 className="text-lg font-bold">{a.subject}</h2>
          <p className="whitespace-pre-line text-sm text-slate-800">{a.message}</p>
          {a.requireAck ? (
            a.acknowledgedAt ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" />{t("ann.ackDone", { at: a.acknowledgedAt })}</div>
            ) : (
              <Button size="xl" variant="success" className="w-full" loading={pending} onClick={() => run(() => acknowledgeAction(a.id))}><CheckCircle2 className="h-6 w-6" />{t("ann.ackButton")}</Button>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
