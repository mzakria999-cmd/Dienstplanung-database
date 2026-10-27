import { describe, expect, it } from "vitest";
import { durationHours, shiftWindow, monthDays, isoWeekday, dateKey, berlinNow } from "@/lib/time";
import { easterSunday, germanHolidays, holidayMap } from "@/lib/holidays";
import { computeMonthHours, shiftHours } from "@/lib/hours";
import { checkConflicts, consecutiveRun } from "@/lib/rules";
import { planMonth, rotationCode, type PlannerEmployee, type PlannerSlot } from "@/lib/scheduler";
import { rankReplacements, type ReplacementInput } from "@/lib/replacement";

const rules = { nightStart: "23:00", nightEnd: "06:00", holidays: new Set<string>() };
const settings = { minRestHours: 11, maxDailyHours: 10, maxConsecutiveDays: 6, overtimeTolerance: 8, minijobMaxHours: 43 };

describe("Zeitberechnung", () => {
  it("Nachtschicht 22:00 Montag bis 06:00 Dienstag = 8 Stunden", () => {
    const w = shiftWindow("2026-11-16", "22:00", "06:00");
    expect(dateKey(w.endAt)).toBe("2026-11-17");
    expect(durationHours(w.startAt, w.endAt)).toBe(8);
  });
  it("Frühschicht 06:00–14:00 = 8 Stunden, Pause wird abgezogen", () => {
    const w = shiftWindow("2026-11-16", "06:00", "14:00");
    expect(durationHours(w.startAt, w.endAt)).toBe(8);
    expect(durationHours(w.startAt, w.endAt, 30)).toBe(7.5);
  });
  it("Monatstage und ISO-Wochentage", () => {
    expect(monthDays(2026, 2)).toHaveLength(28);
    expect(monthDays(2028, 2)).toHaveLength(29);
    expect(isoWeekday(new Date("2026-11-15T00:00:00Z"))).toBe(7); // Sonntag
  });
  it("berlinNow berücksichtigt Sommer-/Winterzeit", () => {
    expect(berlinNow(new Date("2026-07-01T10:00:00Z")).toISOString()).toBe("2026-07-01T12:00:00.000Z");
    expect(berlinNow(new Date("2026-12-01T10:00:00Z")).toISOString()).toBe("2026-12-01T11:00:00.000Z");
  });
});

describe("Feiertage", () => {
  it("Ostersonntag", () => {
    expect(dateKey(easterSunday(2026))).toBe("2026-04-05");
    expect(dateKey(easterSunday(2027))).toBe("2027-03-28");
  });
  it("bundesweite und landesspezifische Feiertage", () => {
    const be = germanHolidays(2026, "BE").map((h) => h.date);
    expect(be).toContain("2026-03-08"); // Frauentag Berlin
    expect(be).toContain("2026-10-03");
    expect(be).not.toContain("2026-11-01");
    const nw = germanHolidays(2026, "NW").map((h) => h.date);
    expect(nw).toContain("2026-11-01"); // Allerheiligen
    expect(nw).toContain("2026-06-04"); // Fronleichnam
    const sn = germanHolidays(2026, "SN").find((h) => h.name === "Buß- und Bettag");
    expect(sn?.date).toBe("2026-11-18");
  });
});

describe("Stundenarten", () => {
  it("Nachtstunden über Mitternacht", () => {
    const w = shiftWindow("2026-11-16", "22:00", "06:00");
    const h = shiftHours(w.startAt, w.endAt, 0, rules);
    expect(h.total).toBe(8);
    expect(h.night).toBe(7); // 23:00–06:00
  });
  it("Sonntags- und Feiertagsstunden", () => {
    // Samstag 22:00 -> Sonntag 06:00
    const w = shiftWindow("2026-11-14", "22:00", "06:00");
    const h = shiftHours(w.startAt, w.endAt, 0, rules);
    expect(h.sunday).toBe(6);
    const hol = { ...rules, holidays: holidayMap([2026], "BE") };
    const x = shiftWindow("2026-12-25", "06:00", "14:00");
    expect(shiftHours(x.startAt, x.endAt, 0, hol).holiday).toBe(8);
  });
  it("Zuschlagsrelevante Stunden werden nicht doppelt gezählt", () => {
    // Sonntag-Nacht: Sonntag 22:00 -> Montag 06:00, Nacht 23-06, Sonntag bis 24:00
    const w = shiftWindow("2026-11-15", "22:00", "06:00");
    const h = shiftHours(w.startAt, w.endAt, 0, rules);
    expect(h.sunday).toBe(2);
    expect(h.night).toBe(7);
    expect(h.surcharge).toBe(8);
  });
  it("Monatsauswertung: geplant, gearbeitet, krank, Überstunden", () => {
    const now = new Date("2026-12-05T00:00:00Z");
    const shifts = Array.from({ length: 21 }, (_, i) => {
      const w = shiftWindow(`2026-11-${String(i + 1).padStart(2, "0")}`, "06:00", "14:00");
      return { ...w, breakMinutes: 0, status: i === 14 ? ("SICK" as const) : ("PLANNED" as const), attendance: i === 14 ? ("PENDING" as const) : ("CONFIRMED" as const) };
    });
    const r = computeMonthHours(160, shifts, [], rules, now);
    expect(r.planned).toBe(168);
    expect(r.actual).toBe(160);
    expect(r.sick).toBe(8);
    expect(r.remainingToPlan).toBe(0);
    expect(r.paid).toBe(168);
    expect(r.overtime).toBe(8);
    expect(r.minus).toBe(0);
  });
  it("Nicht bestätigte Dienste zählen nicht als gearbeitet", () => {
    const w = shiftWindow("2026-11-02", "06:00", "14:00");
    const r = computeMonthHours(160, [{ ...w, breakMinutes: 0, status: "PLANNED", attendance: "PENDING" }], [], rules, new Date("2026-12-01T00:00:00Z"));
    expect(r.actual).toBe(0);
    expect(r.unconfirmed).toBe(1);
    expect(r.activePlanned).toBe(8);
  });
});

describe("Regelprüfung", () => {
  it("erkennt Überschneidung und Ruhezeitverstoß", () => {
    const n = { date: "2026-11-16", ...shiftWindow("2026-11-16", "22:00", "06:00") };
    const f = { date: "2026-11-17", ...shiftWindow("2026-11-17", "06:00", "14:00") };
    const s = { date: "2026-11-17", ...shiftWindow("2026-11-17", "14:00", "22:00") };
    expect(checkConflicts(f, [n], settings).map((i) => i.code)).toContain("REST");
    expect(checkConflicts(s, [n], settings).map((i) => i.code)).toContain("REST"); // nur 8 h Pause
    const overlap = { date: "2026-11-16", ...shiftWindow("2026-11-16", "20:00", "23:00") };
    expect(checkConflicts(overlap, [n], settings)[0].code).toBe("OVERLAP");
    const ok = { date: "2026-11-18", ...shiftWindow("2026-11-18", "06:00", "14:00") };
    expect(checkConflicts(ok, [n], settings)).toHaveLength(0);
  });
  it("zählt aufeinanderfolgende Arbeitstage", () => {
    expect(consecutiveRun(new Set(["2026-11-01", "2026-11-02", "2026-11-04"]), "2026-11-03")).toBe(4);
  });
});

function emp(id: string, overrides: Partial<PlannerEmployee> = {}): PlannerEmployee {
  return {
    id,
    name: id,
    targetHours: 160,
    employmentType: "VOLLZEIT",
    allowedShiftCodes: ["F", "S", "N"],
    qualifiedObjectIds: new Set(["obj"]),
    primaryObjectId: "obj",
    blockedDates: new Set(),
    blockedShifts: new Set(),
    preferredOff: new Set(),
    existing: [],
    plannedHours: 0,
    ...overrides,
  };
}

function slots(days: string[], spec: Array<[string, string, string, number]>): PlannerSlot[] {
  return days.flatMap((d) =>
    spec.map(([code, start, end, required]) => ({ date: d, shiftTypeId: code, shiftCode: code, objectId: "obj", ...shiftWindow(d, start, end), breakMinutes: 0, required, alreadyAssigned: 0 })),
  );
}

describe("Automatische Monatsplanung", () => {
  const days = monthDays(2026, 11).map(dateKey);
  const spec: Array<[string, string, string, number]> = [
    ["F", "06:00", "14:00", 2],
    ["S", "14:00", "22:00", 2],
    ["N", "22:00", "06:00", 1],
  ];

  it("besetzt Schichten ohne Konflikte und respektiert Ruhezeiten", () => {
    const team = Array.from({ length: 9 }, (_, i) => emp(`E${i + 1}`));
    const sl = slots(days, spec);
    const res = planMonth(sl, team, settings);
    // jede Besetzung muss konfliktfrei sein
    const byEmp = new Map<string, PlannerSlot[]>();
    for (const a of res.assignments) byEmp.set(a.employeeId, [...(byEmp.get(a.employeeId) ?? []), sl[a.slotIndex]]);
    for (const list of byEmp.values()) {
      const sorted = [...list].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].startAt.getTime() - sorted[i - 1].endAt.getTime()).toBeGreaterThanOrEqual(11 * 3_600_000);
      }
    }
    for (const e of team) expect(res.hoursByEmployee[e.id] ?? 0).toBeLessThanOrEqual(168);
    const filled = res.assignments.length;
    expect(filled).toBeGreaterThan(sl.reduce((a, s) => a + s.required, 0) * 0.9);
  });

  it("markiert unbesetzte Schichten bei zu wenig Personal", () => {
    const res = planMonth(slots(days, spec), [emp("A"), emp("B")], settings);
    expect(res.unfilled.length).toBeGreaterThan(0);
    expect(res.unfilled[0].missing).toBeGreaterThan(0);
  });

  it("berücksichtigt Abwesenheiten, Schichtarten und Minijob-Grenze", () => {
    const sick = emp("SICK", { blockedDates: new Set(days) });
    const noNight = emp("NONIGHT", { allowedShiftCodes: ["F", "S"] });
    const mini = emp("MINI", { employmentType: "MINIJOB", targetHours: 40 });
    const res = planMonth(slots(days, spec), [sick, noNight, mini], settings);
    expect(res.assignments.some((a) => a.employeeId === "SICK")).toBe(false);
    const sl = slots(days, spec);
    expect(res.assignments.filter((a) => a.employeeId === "NONIGHT").every((a) => sl[a.slotIndex].shiftCode !== "N")).toBe(true);
    expect(res.hoursByEmployee["MINI"] ?? 0).toBeLessThanOrEqual(40);
  });

  it("Rotationsmuster", () => {
    const p = ["F", "F", "S", "S", "N", "N", "FREI", "FREI"];
    expect(rotationCode(p, "2026-11-01", "2026-11-01", 0)).toBe("F");
    expect(rotationCode(p, "2026-11-01", "2026-11-09", 0)).toBe("F");
    expect(rotationCode(p, "2026-11-01", "2026-11-01", 2)).toBe("S");
    expect(rotationCode(p, "2026-11-01", "2026-10-31", 0)).toBe("FREI");
  });
});

describe("Ersatzvorschläge", () => {
  const base: ReplacementInput = {
    employeeId: "x",
    name: "x",
    personnelNumber: "SD0",
    phone: "",
    email: "",
    active: true,
    availableForReplacement: true,
    qualified: true,
    dayStatus: "FREI",
    issues: [],
    plannedHours: 100,
    targetHours: 160,
    maxHours: 168,
  };
  it("FREIE, geeignete Mitarbeiter stehen oben, nach Reststunden sortiert", () => {
    const list = rankReplacements(
      [
        { ...base, employeeId: "busy", name: "Busy", dayStatus: "IM_DIENST", issues: [{ code: "OVERLAP", severity: "error", message: "Überschneidung" }] },
        { ...base, employeeId: "ali", name: "Ali Khan", plannedHours: 120 },
        { ...base, employeeId: "peter", name: "Peter Schmidt", plannedHours: 80 },
        { ...base, employeeId: "unq", name: "Unqualified", qualified: false },
        { ...base, employeeId: "wish", name: "Wunsch", dayStatus: "WUNSCHFREI", plannedHours: 0 },
      ],
      8,
    );
    expect(list.map((c) => c.employeeId)).toEqual(["peter", "ali", "wish", "busy", "unq"]);
    expect(list[0].eligible).toBe(true);
    expect(list.at(-1)!.eligible).toBe(false);
  });
});
