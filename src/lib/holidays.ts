import { addDays, dateKey } from "./time";

export const BUNDESLAENDER: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

/** Ostersonntag nach dem Gaußschen/Meeus-Algorithmus (gregorianisch) */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Gesetzliche Feiertage in Deutschland für ein Bundesland */
export function germanHolidays(year: number, state = "BE"): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (m: number, d: number) => dateKey(new Date(Date.UTC(year, m - 1, d)));
  const rel = (days: number) => dateKey(addDays(easter, days));
  const s = state.toUpperCase();
  const inStates = (...states: string[]) => states.includes(s);

  const list: Holiday[] = [
    { date: fixed(1, 1), name: "Neujahr" },
    { date: rel(-2), name: "Karfreitag" },
    { date: rel(1), name: "Ostermontag" },
    { date: fixed(5, 1), name: "Tag der Arbeit" },
    { date: rel(39), name: "Christi Himmelfahrt" },
    { date: rel(50), name: "Pfingstmontag" },
    { date: fixed(10, 3), name: "Tag der Deutschen Einheit" },
    { date: fixed(12, 25), name: "1. Weihnachtstag" },
    { date: fixed(12, 26), name: "2. Weihnachtstag" },
  ];

  if (inStates("BW", "BY", "ST")) list.push({ date: fixed(1, 6), name: "Heilige Drei Könige" });
  if (inStates("BE") && year >= 2019) list.push({ date: fixed(3, 8), name: "Internationaler Frauentag" });
  if (inStates("MV") && year >= 2023) list.push({ date: fixed(3, 8), name: "Internationaler Frauentag" });
  if (inStates("BB")) {
    list.push({ date: rel(0), name: "Ostersonntag" });
    list.push({ date: rel(49), name: "Pfingstsonntag" });
  }
  if (inStates("BW", "BY", "HE", "NW", "RP", "SL")) list.push({ date: rel(60), name: "Fronleichnam" });
  if (inStates("SL")) list.push({ date: fixed(8, 15), name: "Mariä Himmelfahrt" });
  if (inStates("TH") && year >= 2019) list.push({ date: fixed(9, 20), name: "Weltkindertag" });
  if (inStates("BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH")) list.push({ date: fixed(10, 31), name: "Reformationstag" });
  if (inStates("BW", "BY", "NW", "RP", "SL")) list.push({ date: fixed(11, 1), name: "Allerheiligen" });
  if (inStates("SN")) {
    // Mittwoch vor dem 23. November
    const nov23 = new Date(Date.UTC(year, 10, 23));
    const diff = ((nov23.getUTCDay() - 3 + 7) % 7) || 7;
    list.push({ date: dateKey(addDays(nov23, -diff)), name: "Buß- und Bettag" });
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function holidayMap(years: number[], state: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const y of years) for (const h of germanHolidays(y, state)) map.set(h.date, h.name);
  return map;
}
