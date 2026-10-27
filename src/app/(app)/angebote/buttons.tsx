"use client";
import { respondOfferAction } from "@/actions/sick";
import { useAction } from "@/components/use-action";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function OfferButtons({ id }: { id: string }) {
  const t = useT();
  const { run, pending } = useAction();
  return (
    <div className="flex gap-2">
      <Button variant="success" size="lg" loading={pending} onClick={() => run(() => respondOfferAction({ offerId: id, accept: true }), { success: t("offers.accepted") })}>{t("offers.accept")}</Button>
      <Button variant="outline" size="lg" loading={pending} onClick={() => run(() => respondOfferAction({ offerId: id, accept: false }), { success: t("offers.declined") })}>{t("offers.decline")}</Button>
    </div>
  );
}
