import { DAY_MS, HOUR_MS, dateKey, overlapMs, parseTime, round2, startOfDay } from "./time";

export interface HourRules {
  nightStart: string; // "23:00"
  nightEnd: string; // "06:00"
  holidays: Set<string> | Map<string, string>; // YYYY-MM-DD
}

export interface ShiftHourBreakdown {
  total: number; // bezahlte Arbeitszeit (abzgl. Pause)
  night: number;
  sunday: number;
  holiday: number;
  surcharge: number; // Stunden, in denen mindestens ein Zuschlag greift (keine Doppelzählung)
}

const EMPTY: ShiftHourBreakdown = { total: 0, night: 0, sunday: 0, holiday: 0, surcharge: 0 };

/** Nachtfenster [start,end) für jeden Kalendertag, der das Intervall berührt */
function nightIntervals(from: number, to: number, nightStart: string, nightEnd: string): Array<[number, number]> {
  const ns = parseTime(nightStart).minutes * 60_000;
  const ne = parseTime(nightEnd).minutes * 60_000;
  const out: Array<[number, number]> = [];
  let day = startOfDay(new Date(from)).getTime() - DAY_MS;
  while (day <= to) {
    if (ns > ne) out.push([day + ns, day + DAY_MS + ne]);
    else if (ns < ne) out.push([day + ns, day + ne]);
    day += DAY_MS;
  }
  return out;
}

function dayIntervals(from: number, to: number, predicate: (d: Date) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let day = startOfDay(new Date(from)).getTime();
  while (day < to) {
    if (predicate(new Date(day))) out.push([day, day + DAY_MS]);
    day += DAY_MS;
  }
  return out;
}

function sumOverlap(a: number, b: number, intervals: Array<[number, number]>): number {
  return intervals.reduce((acc, [s, e]) => acc + overlapMs(a, b, s, e), 0);
}

/** Vereinigung von Intervallen innerhalb [a,b) messen */
function unionOverlap(a: number, b: number, intervals: Array<[number, number]>): number {
  const clipped = intervals
    .map(([s, e]) => [Math.max(a, s), Math.min(b, e)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curS = -Infinity;
  let curE = -Infinity;
  for (const [s, e] of clipped) {
    if (s > curE) {
      if (curE > curS) total += curE - curS;
      curS = s;
      curE = e;
    } else curE = Math.max(curE, e);
  }
  if (curE > curS) total += curE - curS;
  return total;
}

/**
 * Stunden einer Schicht inkl. Nacht-, Sonntags- und Feiertagsanteil.
 * Die Pause wird von der Gesamtzeit abgezogen; Zuschlagsstunden werden anteilig gekürzt.
 * Beispiel: Mo 22:00 – Di 06:00 = 8 h, davon (bei Nacht 23–6) 7 h Nacht.
 */
export function shiftHours(startAt: Date, endAt: Date, breakMinutes: number, rules: HourRules): ShiftHourBreakdown {
  const a = startAt.getTime();
  const b = endAt.getTime();
  if (!(b > a)) return { ...EMPTY };
  const gross = b - a;
  const net = Math.max(0, gross - breakMinutes * 60_000);
  const factor = gross > 0 ? net / gross : 0;

  const night = nightIntervals(a, b, rules.nightStart, rules.nightEnd);
  const sundays = dayIntervals(a, b, (d) => d.getUTCDay() === 0);
  const holidays = dayIntervals(a, b, (d) => rules.holidays.has(dateKey(d)));

  const f = (ms: number) => round2((ms / HOUR_MS) * factor);
  return {
    total: round2(net / HOUR_MS),
    night: f(sumOverlap(a, b, night)),
    sunday: f(sumOverlap(a, b, sundays)),
    holiday: f(sumOverlap(a, b, holidays)),
    surcharge: f(unionOverlap(a, b, [...night, ...sundays, ...holidays])),
  };
}

// ------------------------------------------------------------------ Monatsauswertung

export type AssignmentStatusLike = "PLANNED" | "SICK" | "ABSENT" | "VACATION" | "CANCELLED";
export type AttendanceLike = "PENDING" | "CONFIRMED" | "NO_SHOW";

export interface HoursAssignment {
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  status: AssignmentStatusLike;
  attendance: AttendanceLike;
  actualStartAt?: Date | null;
  actualEndAt?: Date | null;
}

export interface HoursAbsence {
  type: "VACATION" | "SICK" | "UNEXCUSED" | "DAY_OFF";
  hours: number;
}

export interface MonthHours {
  target: number;
  planned: number; // ursprünglich geplante Stunden (inkl. später krank/abwesend)
  activePlanned: number; // aktuell geplante, zu leistende Dienste
  actual: number; // bestätigte, tatsächlich gearbeitete Stunden
  sick: number; // Krankheitsstunden (Entgeltfortzahlung, Lohnausfallprinzip)
  vacation: number;
  unexcused: number; // Fehltage (unbezahlt)
  remainingToPlan: number;
  paid: number; // Gesamtstunden für Lohnabrechnung = gearbeitet + krank + Urlaub
  overtime: number;
  minus: number;
  night: number;
  sunday: number;
  holiday: number;
  surcharge: number;
  plannedNight: number;
  plannedSunday: number;
  plannedHoliday: number;
  unconfirmed: number; // Anzahl vergangener Dienste ohne Anwesenheitsbestätigung
  unconfirmedHours: number;
  shiftCount: number;
}

export function emptyMonthHours(target = 0): MonthHours {
  return {
    target,
    planned: 0,
    activePlanned: 0,
    actual: 0,
    sick: 0,
    vacation: 0,
    unexcused: 0,
    remainingToPlan: target,
    paid: 0,
    overtime: 0,
    minus: target,
    night: 0,
    sunday: 0,
    holiday: 0,
    surcharge: 0,
    plannedNight: 0,
    plannedSunday: 0,
    plannedHoliday: 0,
    unconfirmed: 0,
    unconfirmedHours: 0,
    shiftCount: 0,
  };
}

/**
 * Monatsstunden eines Mitarbeiters.
 * - "actual"/Zuschläge basieren ausschließlich auf BESTÄTIGTER Anwesenheit (für die Lohnabrechnung).
 * - Krankheit: Stunden der ausgefallenen geplanten Dienste (Lohnausfallprinzip, §4 EFZG).
 * - Überstunden/Minusstunden: bezahlte Stunden (gearbeitet + krank + Urlaub) gegen Sollstunden.
 */
export function computeMonthHours(
  target: number,
  assignments: HoursAssignment[],
  absences: HoursAbsence[],
  rules: HourRules,
  now: Date,
): MonthHours {
  const r = emptyMonthHours(target);
  for (const a of assignments) {
    if (a.status === "CANCELLED") continue;
    const planned = shiftHours(a.startAt, a.endAt, a.breakMinutes, rules);
    r.planned += planned.total;
    if (a.status === "SICK") r.sick += planned.total;
    else if (a.status === "VACATION") r.vacation += planned.total;
    else if (a.status === "ABSENT") r.unexcused += planned.total;
    else {
      // PLANNED
      r.shiftCount += 1;
      if (a.attendance === "NO_SHOW") {
        r.unexcused += planned.total;
        continue;
      }
      r.activePlanned += planned.total;
      r.plannedNight += planned.night;
      r.plannedSunday += planned.sunday;
      r.plannedHoliday += planned.holiday;
      if (a.attendance === "CONFIRMED") {
        const s = a.actualStartAt ?? a.startAt;
        const e = a.actualEndAt ?? a.endAt;
        const act = shiftHours(s, e, a.breakMinutes, rules);
        r.actual += act.total;
        r.night += act.night;
        r.sunday += act.sunday;
        r.holiday += act.holiday;
        r.surcharge += act.surcharge;
      } else if (a.endAt.getTime() <= now.getTime()) {
        r.unconfirmed += 1;
        r.unconfirmedHours += planned.total;
      }
    }
  }
  for (const ab of absences) {
    if (ab.type === "VACATION") r.vacation += ab.hours;
    else if (ab.type === "SICK") r.sick += ab.hours;
  }
  for (const k of Object.keys(r) as Array<keyof MonthHours>) r[k] = round2(r[k]);
  r.remainingToPlan = round2(Math.max(0, target - (r.activePlanned + r.sick + r.vacation)));
  r.paid = round2(r.actual + r.sick + r.vacation);
  r.overtime = round2(Math.max(0, r.paid - target));
  r.minus = round2(Math.max(0, target - r.paid));
  return r;
}
