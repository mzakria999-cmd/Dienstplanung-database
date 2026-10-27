"use client";
import { CheckCircle2 } from "lucide-react";
import { confirmPastMonthAction } from "@/actions/schedule";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function ConfirmAllButton({ year, month, n }: { year: number; month: number; n: number }) {
  const t = useT();
  const { run, pending } = useAction();
  return (
    <Button variant="success" loading={pending} onClick={() => confirm(t("payroll.confirmAllQ", { n })) && run(() => confirmPastMonthAction({ year, month }), { success: t("attendance.CONFIRMED") })}>
      <CheckCircle2 className="h-4 w-4" />
      {t("payroll.confirmAll", { n })}
    </Button>
  );
}
