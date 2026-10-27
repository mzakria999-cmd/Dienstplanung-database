"use client";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const t = useT();
  const router = useRouter();
  return <Button variant="outline" onClick={async () => { await fetch("/api/notifications", { method: "POST", body: JSON.stringify({ all: true }) }); router.refresh(); }}>{t("notif.markAll")}</Button>;
}
