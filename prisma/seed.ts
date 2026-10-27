/**
 * Seed: Standardschichten (F/S/N), Firmeneinstellungen, Administrator.
 * Mit SEED_DEMO=true zusätzlich Demo-Objekte, -Qualifikationen, -Mitarbeiter und ein Muster-Dienstplan.
 *
 *   SEED_ADMIN_EMAIL=chef@firma.de SEED_ADMIN_PASSWORD='…' npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, companyName: process.env.SEED_COMPANY ?? "SecurityDienst GmbH" } });

  const shifts = [
    { code: "F", nameDe: "Frühschicht", nameEn: "Early shift", color: "#22c55e", startTime: "06:00", endTime: "14:00", sortOrder: 1 },
    { code: "S", nameDe: "Spätschicht", nameEn: "Late shift", color: "#eab308", startTime: "14:00", endTime: "22:00", sortOrder: 2 },
    { code: "N", nameDe: "Nachtschicht", nameEn: "Night shift", color: "#f97316", startTime: "22:00", endTime: "06:00", sortOrder: 3 },
  ];
  for (const s of shifts) await prisma.shiftType.upsert({ where: { code: s.code }, update: {}, create: s });

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@securitydienst.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin2026sicher";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({ data: { email: adminEmail, role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 12), mustChangePassword: !process.env.SEED_ADMIN_PASSWORD } });
    console.log(`Administrator angelegt: ${adminEmail} / ${adminPassword}`);
  }

  if (process.env.SEED_DEMO !== "true") return;
  console.log("Demo-Daten werden angelegt …");

  const quals = await Promise.all(
    [
      ["Sachkundeprüfung §34a GewO", "IHK-Sachkundeprüfung Bewachungsgewerbe"],
      ["Ersthelfer", "Erste-Hilfe-Ausbildung (max. 2 Jahre alt)"],
      ["Brandschutzhelfer", "Ausbildung nach ASR A2.2"],
      ["Krankenhaus-Einweisung", "Hygiene & Verhalten im Klinikbereich"],
    ].map(([name, description]) => prisma.qualification.upsert({ where: { name }, update: {}, create: { name, description } })),
  );

  const objects = await Promise.all(
    [
      { name: "Einkaufszentrum Berlin", address: "Alexanderplatz 1, 10178 Berlin", contactPerson: "Frau Becker (Center-Management)", phone: "+49 30 1234567", requiredEarly: 2, requiredLate: 2, requiredNight: 1 },
      { name: "Krankenhaus Hamburg", address: "Klinikweg 5, 20246 Hamburg", contactPerson: "Herr Jansen (Haustechnik)", phone: "+49 40 7654321", requiredEarly: 1, requiredLate: 1, requiredNight: 1 },
      { name: "Industriepark Frankfurt", address: "Industriestraße 20, 65933 Frankfurt am Main", contactPerson: "Frau Yilmaz (Werkschutz)", phone: "+49 69 555000", requiredEarly: 1, requiredLate: 1, requiredNight: 1 },
    ].map((o) => prisma.securityObject.upsert({ where: { name: o.name }, update: {}, create: o })),
  );
  await prisma.objectRequiredQualification.upsert({ where: { objectId_qualificationId: { objectId: objects[1].id, qualificationId: quals[3].id } }, update: {}, create: { objectId: objects[1].id, qualificationId: quals[3].id } });

  const people: Array<[string, string, "VOLLZEIT" | "TEILZEIT" | "MINIJOB", number, number, ("ADMIN" | "SUPERVISOR" | "EMPLOYEE")?]> = [
    ["Max", "Müller", "VOLLZEIT", 160, 0],
    ["Ali", "Khan", "VOLLZEIT", 160, 0],
    ["Peter", "Schmidt", "VOLLZEIT", 160, 0],
    ["Ahmed", "Hassan", "VOLLZEIT", 160, 0],
    ["Sabine", "Wagner", "VOLLZEIT", 160, 0, "SUPERVISOR"],
    ["Jonas", "Fischer", "VOLLZEIT", 160, 0],
    ["Leonie", "Weber", "TEILZEIT", 80, 0],
    ["Murat", "Yildiz", "VOLLZEIT", 160, 0],
    ["Thomas", "Becker", "VOLLZEIT", 160, 0],
    ["Anna", "Hoffmann", "TEILZEIT", 100, 1],
    ["Dariusz", "Nowak", "VOLLZEIT", 160, 1],
    ["Kevin", "Schulz", "VOLLZEIT", 160, 1],
    ["Fatma", "Demir", "VOLLZEIT", 160, 1],
    ["Lukas", "Koch", "MINIJOB", 40, 1],
    ["Svetlana", "Ivanova", "VOLLZEIT", 160, 2],
    ["Marco", "Richter", "VOLLZEIT", 160, 2],
    ["Ibrahim", "Saleh", "VOLLZEIT", 160, 2],
    ["Julia", "Klein", "TEILZEIT", 80, 2],
  ];
  const hash = await bcrypt.hash("Demo2026pass", 12);
  let i = 0;
  for (const [firstName, lastName, employmentType, targetHours, obj, role] of people) {
    i++;
    const pnr = `SD${String(i).padStart(3, "0")}`;
    // SEED_DEMO_EMAIL_BASE=name@gmail.com -> name+max@gmail.com (alle Test-Mails landen im eigenen Postfach)
    const base = process.env.SEED_DEMO_EMAIL_BASE?.trim().toLowerCase();
    const slug = firstName.toLowerCase().replace(/ü/g, "ue").replace(/ö/g, "oe").replace(/ä/g, "ae").replace(/[^a-z]/g, "");
    const email = base?.includes("@")
      ? `${base.split("@")[0]}+${slug}@${base.split("@")[1]}`
      : `${firstName}.${lastName}`.toLowerCase().replace(/ü/g, "ue").replace(/ö/g, "oe").replace(/ä/g, "ae") + "@example.de";
    if (await prisma.employee.findUnique({ where: { personnelNumber: pnr } })) continue;
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, role: role ?? "EMPLOYEE", passwordHash: hash } });
    const e = await prisma.employee.create({
      data: {
        personnelNumber: pnr,
        firstName,
        lastName,
        email,
        phone: `+49 176 ${String(1000000 + i * 73541).slice(0, 7)}`,
        entryDate: new Date(Date.UTC(2020 + (i % 6), (i * 3) % 12, 1)),
        employmentType,
        targetHours,
        primaryObjectId: objects[obj].id,
        allowedShiftCodes: employmentType === "MINIJOB" ? ["F", "S"] : ["F", "S", "N"],
        userId: user.id,
      },
    });
    const objIds = new Set([objects[obj].id, ...(i % 4 === 0 ? [objects[(obj + 1) % 3].id] : [])]);
    await prisma.employeeObject.createMany({ data: [...objIds].map((objectId) => ({ employeeId: e.id, objectId })), skipDuplicates: true });
    await prisma.employeeQualification.createMany({ data: [{ employeeId: e.id, qualificationId: quals[0].id }, ...(i % 2 ? [{ employeeId: e.id, qualificationId: quals[1].id }] : []), ...(obj === 1 ? [{ employeeId: e.id, qualificationId: quals[3].id }] : [])], skipDuplicates: true });
  }

  if (!(await prisma.shiftTemplate.findFirst({ where: { name: "Standard Tagesmuster" } }))) {
    const st = await prisma.shiftType.findMany();
    const id = (c: string) => st.find((s) => s.code === c)!.id;
    await prisma.shiftTemplate.create({
      data: {
        name: "Standard Tagesmuster",
        type: "DAILY",
        description: "Frühschicht 2 · Spätschicht 2 · Nachtschicht 1 (Einkaufszentrum) + je 1 in Hamburg/Frankfurt",
        items: {
          create: objects.flatMap((o) => [
            { dayKey: 0, shiftTypeId: id("F"), objectId: o.id, requiredCount: o.requiredEarly },
            { dayKey: 0, shiftTypeId: id("S"), objectId: o.id, requiredCount: o.requiredLate },
            { dayKey: 0, shiftTypeId: id("N"), objectId: o.id, requiredCount: o.requiredNight },
          ]),
        },
      },
    });
  }
  console.log("Demo-Mitarbeiter angelegt – Passwort 'Demo2026pass'");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
