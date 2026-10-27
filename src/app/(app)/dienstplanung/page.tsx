import Link from "next/link";
import { CalendarRange, LayoutTemplate, Send } from "lucide-react";
import { requirePageUser, STAFF } from "@/server/session";
import { getT } from "@/server/i18n";
import { monthGrid } from "@/server/queries";
import { PageHeader } from "@/components/common";
import { MonthNav, QuerySelect } from "@/components/month-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { currentMonth } from "@/lib/time";
import { PlanningGrid } from "./planning-grid";

export const metadata = { title: "Dienstplanung" };
export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageUser(STAFF);
  const { t } = await getT();
  const sp = await searchParams;
  const cm = currentMonth();
  const year = Number(sp.year) || cm.year;
  const month = Number(sp.month) || cm.month;
  const data = await monthGrid(year, month, sp.object || null);
  const statusTone = { DRAFT: "slate", PENDING_APPROVAL: "yellow", APPROVED: "blue", PUBLISHED: "green" } as const;
  return (
    <div>
      <PageHeader
        title={t("nav.planning")}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t("planning.subtitle")}
            <Badge tone={statusTone[data.plan.status as keyof typeof statusTone]}>{t(`plan.status.${data.plan.status}` as never)}{data.plan.version ? ` · v${data.plan.version}` : ""}</Badge>
            {data.plan.archived ? <Badge tone="purple">{t("plan.archived")}</Badge> : null}
            {data.plan.drafts ? <Badge tone="yellow">{t("planning.drafts", { n: data.plan.drafts })}</Badge> : null}
          </span>
        }
        actions={
          <>
            <MonthNav year={year} month={month} />
            <QuerySelect name="object" value={sp.object ?? ""} options={[{ value: "", label: t("planning.allObjects") }, ...data.objects.map((o) => ({ value: o.id, label: o.name }))]} />
            <Link href="/dienstplanung/tag" className={buttonVariants({ variant: "outline" })}><CalendarRange className="h-4 w-4" />{t("planning.daily")}</Link>
            {user.role === "ADMIN" ? (
              <>
                <Link href={`/muster?year=${year}&month=${month}`} className={buttonVariants({ variant: "outline" })}><LayoutTemplate className="h-4 w-4" />{t("nav.templates")}</Link>
                <Link href={`/berichte?year=${year}&month=${month}`} className={buttonVariants({ variant: "primary" })}><Send className="h-4 w-4" />{t("planning.publish")}</Link>
              </>
            ) : null}
          </>
        }
      />
      <PlanningGrid data={data} canEdit={user.role === "ADMIN" && !data.plan.archived} />
    </div>
  );
}
