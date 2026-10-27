/**
 * Zeit-Hilfsfunktionen.
 *
 * Konvention: Schichtzeiten sind "floating local time" – die Wandzeit in Europe/Berlin
 * wird als UTC-Zeitpunkt abgelegt (06:00 Berlin => 06:00Z). Alle Berechnungen nutzen
 * daher ausschließlich die UTC-Methoden von Date. Zur Anzeige immer timeZone: "UTC".
 */

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const APP_TZ = "Europe/Berlin";

/** "YYYY-MM-DD" eines (floating) Datums */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> Date (00:00Z) */
export function parseDateKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Ungültiges Datum: ${key}`);
  const d = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Ungültiges Datum: ${key}`);
  return d;
}

export function parseTime(hhmm: string): { h: number; m: number; minutes: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new Error(`Ungültige Uhrzeit: ${hhmm}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  return { h, m, minutes: h * 60 + m };
}

export function isValidTime(hhmm: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hhmm);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function addDaysKey(key: string, days: number): string {
  return dateKey(addDays(parseDateKey(key), days));
}

/** Kombiniert Kalendertag + Uhrzeit zu einem floating-Zeitpunkt */
export function combine(day: Date | string, hhmm: string): Date {
  const base = typeof day === "string" ? parseDateKey(day) : startOfDay(day);
  return new Date(base.getTime() + parseTime(hhmm).minutes * 60_000);
}

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Schichtfenster für einen Kalendertag. Endet die Schicht "früher" als sie beginnt
 * (z. B. 22:00–06:00), endet sie am Folgetag. Gleiche Zeit = 24 Stunden.
 */
export function shiftWindow(day: Date | string, start: string, end: string): { startAt: Date; endAt: Date } {
  const startAt = combine(day, start);
  let endAt = combine(day, end);
  if (endAt.getTime() <= startAt.getTime()) endAt = addDays(endAt, 1);
  return { startAt, endAt };
}

export function durationHours(startAt: Date, endAt: Date, breakMinutes = 0): number {
  const h = (endAt.getTime() - startAt.getTime()) / HOUR_MS - breakMinutes / 60;
  return round2(Math.max(0, h));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Alle Tage eines Monats als Date (00:00Z) */
export function monthDays(year: number, month: number): Date[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(year, month - 1, i + 1)));
}

export function monthRange(year: number, month: number): { from: Date; to: Date; toExclusive: Date } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const toExclusive = new Date(Date.UTC(year, month, 1));
  return { from, to: addDays(toExclusive, -1), toExclusive };
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
export function isoWeekday(d: Date): number {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

export function startOfIsoWeek(d: Date): Date {
  return addDays(startOfDay(d), 1 - isoWeekday(d));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Aktuelle Wandzeit in Berlin als floating-Date */
export function berlinNow(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

export function berlinToday(now: Date = new Date()): Date {
  return startOfDay(berlinNow(now));
}

/** floating-Zeitpunkt -> echter UTC-Zeitpunkt (für Planung von Jobs, z. B. Erinnerungen) */
export function floatingToReal(floating: Date): Date {
  // Offset für diesen Zeitpunkt ermitteln (iterativ, DST-sicher genug für Jobs)
  const guess = new Date(floating.getTime());
  const offset = berlinNow(guess).getTime() - guess.getTime();
  return new Date(floating.getTime() - offset);
}

export function formatDate(d: Date, locale: "de" | "en" = "de", opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  }).format(d);
}

export function formatTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

export function formatMonth(year: number, month: number, locale: "de" | "en" = "de"): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function monthName(month: number, locale: "de" | "en" = "de"): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", month: "long" }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
}

export function weekdayShort(d: Date, locale: "de" | "en" = "de"): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", weekday: "short" }).format(d);
}

/** Nächster Monat relativ zu heute (Berlin) */
export function nextMonth(now: Date = new Date()): { year: number; month: number } {
  const t = berlinNow(now);
  const m = t.getUTCMonth() + 2;
  return m > 12 ? { year: t.getUTCFullYear() + 1, month: 1 } : { year: t.getUTCFullYear(), month: m };
}

export function currentMonth(now: Date = new Date()): { year: number; month: number } {
  const t = berlinNow(now);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
}

export function formatHours(h: number, locale: "de" | "en" = "de"): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(h);
}
