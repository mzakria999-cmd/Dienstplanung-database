import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/server/session";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** DSGVO Art. 15/20 – Datenauskunft als JSON (Admin für jeden, Mitarbeiter für sich selbst) */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? user.employeeId;
  if (!id || (user.role !== "ADMIN" && id !== user.employeeId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const data = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, role: true, locale: true, createdAt: true, lastLoginAt: true } },
      qualifications: { include: { qualification: true } },
      objectQualifications: { include: { object: { select: { name: true } } } },
      assignments: { include: { shiftType: { select: { code: true } }, object: { select: { name: true } } }, orderBy: { date: "asc" } },
      absences: true,
      sickLeaves: true,
      availability: true,
      announcementRecipients: { include: { announcement: { select: { subject: true, sentAt: true } } } },
    },
  });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  await audit(user.id, "GDPR_EXPORT", "Employee", id);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), employee: data }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="DSGVO_Auskunft_${data.personnelNumber}.json"` },
  });
}
