import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/session";
import { payrollCsv, payrollDatev, payrollPdf, payrollRows, payrollXlsx } from "@/server/payroll";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  const format = sp.get("format") ?? "pdf";
  if (!Number.isInteger(year) || month < 1 || month > 12) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const rows = await payrollRows(year, month);
  const base = `Monatsabrechnung_${year}-${String(month).padStart(2, "0")}`;
  await audit(user.id, "PAYROLL_EXPORT", "Payroll", `${year}-${month}`, { format });
  const send = (body: Uint8Array | string, type: string, name: string) =>
    new NextResponse(typeof body === "string" ? body : new Uint8Array(body), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
  switch (format) {
    case "xlsx":
      return send(await payrollXlsx(rows, year, month), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${base}.xlsx`);
    case "csv":
      return send(payrollCsv(rows), "text/csv; charset=utf-8", `${base}.csv`);
    case "datev":
      return send(Buffer.from(await payrollDatev(rows, year, month), "latin1"), "text/plain; charset=windows-1252", `DATEV_LODAS_${year}-${String(month).padStart(2, "0")}.txt`);
    default:
      return send(await payrollPdf(rows, year, month), "application/pdf", `${base}.pdf`);
  }
}
