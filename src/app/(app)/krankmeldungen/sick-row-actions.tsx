"use client";
import { confirmSickAction, revokeSickAction } from "@/actions/sick";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function SickRowActions({ id, confirmed, isAdmin }: { id: string; confirmed: boolean; isAdmin: boolean }) {
  const t = useT();
  const { run, pending } = useAction();
  return (
    <div className="flex justify-end gap-1">
      {!confirmed ? <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => confirmSickAction(id))}>{t("sick.confirm")}</Button> : null}
      {isAdmin ? <Button size="sm" variant="ghost" loading={pending} onClick={() => confirm(t("sick.confirmRevoke")) && run(() => revokeSickAction(id), { onSuccess: (r) => alert(t("sick.revokedResult", { restored: r.restored, kept: r.kept })) })}>{t("sick.revoke")}</Button> : null}
    </div>
  );
}
