"use client";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { createChangeRequestAction } from "@/actions/schedule";
import { useAction } from "@/components/use-action";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { cn, SHIFT_STYLE } from "@/lib/utils";

export interface RosterDay {
  key: string;
  day: number;
  dow: number;
  holiday: string | null;
  absence: string | null;
  shifts: Array<{ id: string; code: string; name: string; start: string; end: string; object: string; changed: boolean; planned: boolean }>;
}

export function RosterCalendar({ days }: { days: RosterDay[] }) {
  const t = useT();
  const locale = useLocale();
  const { run, pending } = useAction();
  const [req, setReq] = useState<RosterDay["shifts"][number] | null>(null);
  const [msg, setMsg] = useState("");
  const wd = locale === "de" ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lead = days[0].dow - 1;
  const chip = (s: RosterDay["shifts"][number]) => {
    const st = SHIFT_STYLE[s.code] ?? SHIFT_STYLE.FREI;
    return (
      <button key={s.id} onClick={() => s.planned && setReq(s)} className={cn("w-full rounded-md border px-1.5 py-1 text-left text-xs", st.bg, st.text, s.changed ? "border-2 border-red-600" : st.border)}>
        <div className="font-bold">{s.code} {s.changed ? <span className="rounded bg-red-600 px-1 text-[9px] text-white">{t("grid.changed")}</span> : null}</div>
        <div>{s.start}–{s.end}</div>
        <div className="hidden truncate opacity-80 sm:block">{s.object}</div>
      </button>
    );
  };
  return (
    <>
      {/* Desktop/Tablet: Monatskalender */}
      <div className="hidden grid-cols-7 gap-1 md:grid">
        {wd.map((d) => <div key={d} className="py-1 text-center text-xs font-semibold text-slate-500">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
        {days.map((d) => (
          <div key={d.key} className={cn("min-h-[96px] rounded-lg border p-1.5", d.dow >= 6 ? "bg-slate-50" : "bg-white", d.holiday && "bg-purple-50")}>
            <div className="mb-1 flex items-center justify-between text-xs"><b className={d.dow >= 6 ? "text-red-600" : ""}>{d.day}</b>{d.holiday ? <span className="truncate text-[10px] text-purple-700" title={d.holiday}>{d.holiday}</span> : null}</div>
            <div className="space-y-1">
              {d.shifts.map(chip)}
              {d.shifts.length === 0 ? <div className={cn("rounded px-1.5 py-1 text-center text-xs font-semibold", d.absence ? cn(SHIFT_STYLE[d.absence].bg, SHIFT_STYLE[d.absence].text) : "text-slate-300")}>{d.absence ?? "FREI"}</div> : null}
            </div>
          </div>
        ))}
      </div>
      {/* Smartphone: Liste */}
      <div className="space-y-1.5 md:hidden">
        {days.map((d) => (
          <div key={d.key} className={cn("flex items-center gap-3 rounded-lg border p-2", d.dow >= 6 && "bg-slate-50")}>
            <div className="w-12 text-center"><div className={cn("text-lg font-bold", d.dow >= 6 && "text-red-600")}>{d.day}</div><div className="text-[11px] text-slate-500">{wd[d.dow - 1]}</div></div>
            <div className="flex-1 space-y-1">
              {d.shifts.length ? d.shifts.map(chip) : <span className="text-sm font-semibold text-slate-400">{d.absence ?? "FREI"}</span>}
              {d.holiday ? <div className="text-[11px] text-purple-700">{d.holiday}</div> : null}
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!req} onClose={() => setReq(null)} title={t("roster.requestChange")} footer={<Button loading={pending} disabled={msg.trim().length < 3} onClick={() => run(() => createChangeRequestAction({ assignmentId: req!.id, message: msg }), { onSuccess: () => { setReq(null); setMsg(""); } })}><MessageSquare className="h-4 w-4" />{t("common.send")}</Button>}>
        <p className="mb-2 text-sm">{req?.name} · {req?.start}–{req?.end} · {req?.object}</p>
        <Textarea placeholder={t("roster.requestPlaceholder")} value={msg} onChange={(e) => setMsg(e.target.value)} />
      </Modal>
    </>
  );
}
