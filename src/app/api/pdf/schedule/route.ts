import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { renderEmployeeSchedulePdf } from "@/server/pdf/render";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** Dienstplan-PDF: Mitarbeiter nur eigenes & veröffentlichtes, Admin/Schichtleiter alle */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  const employeeId = sp.get("employeeId") ?? user.employeeId;
  if (!employeeId || !Number.isInteger(year) || month < 1 || month > 12) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (user.role === "EMPLOYEE") {
    if (employeeId !== user.employeeId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const plan = await prisma.monthPlan.findUnique({ where: { year_month: { year, month } } });
    if (plan?.status !== "PUBLISHED") return NextResponse.json({ error: "Dienstplan noch nicht veröffentlicht" }, { status: 404 });
  }
  const { buffer, filename } = await renderEmployeeSchedulePdf(employeeId, year, month, user.locale);
  await audit(user.id, "PDF_DOWNLOAD", "Employee", employeeId, { year, month });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${sp.get("download") ? "attachment" : "inline"}; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
