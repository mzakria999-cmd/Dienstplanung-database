import type { RuleIssue } from "./rules";

export type DayStatus = "FREI" | "IM_DIENST" | "KRANK" | "URLAUB" | "FEHLTAG" | "NICHT_VERFUEGBAR" | "WUNSCHFREI";

export interface ReplacementInput {
  employeeId: string;
  name: string;
  personnelNumber: string;
  phone: string;
  email: string;
  active: boolean;
  availableForReplacement: boolean;
  qualified: boolean;
  dayStatus: DayStatus;
  issues: RuleIssue[];
  plannedHours: number; // aktuell geplante Stunden im Monat
  targetHours: number;
  maxHours: number;
}

export interface ReplacementCandidate extends ReplacementInput {
  eligible: boolean;
  remainingHours: number;
  reasons: string[];
  rank: number;
}

/**
 * Ermittelt und sortiert Ersatzkandidaten:
 * Geeignet = aktiv, für Dienstübernahme verfügbar, für das Objekt qualifiziert, an dem Tag FREI
 * (bzw. "Wunschfrei" als nachrangige Option), keine Überschneidung, ausreichende Ruhezeit.
 * Reihenfolge: FREI vor Wunschfrei, dann größte Reststunden zum Soll, dann ohne Warnungen.
 */
export function rankReplacements(inputs: ReplacementInput[], projectedShiftHours: number): ReplacementCandidate[] {
  const out = inputs.map((c) => {
    const reasons: string[] = [];
    if (!c.active) reasons.push("inaktiv");
    if (!c.availableForReplacement) reasons.push("nicht für Dienstübernahmen verfügbar");
    if (!c.qualified) reasons.push("keine Freigabe für dieses Objekt");
    if (c.dayStatus === "KRANK") reasons.push("krank");
    if (c.dayStatus === "URLAUB") reasons.push("Urlaub");
    if (c.dayStatus === "FEHLTAG") reasons.push("Fehltag");
    if (c.dayStatus === "NICHT_VERFUEGBAR") reasons.push("nicht verfügbar");
    for (const i of c.issues) if (i.severity === "error") reasons.push(i.message);
    if (c.plannedHours + projectedShiftHours > c.maxHours + 1e-9) reasons.push("Stundengrenze überschritten");
    const eligible = reasons.length === 0;
    return { ...c, eligible, reasons, remainingHours: Math.round((c.targetHours - c.plannedHours) * 100) / 100, rank: 0 };
  });

  const tier = (c: ReplacementCandidate) => {
    if (!c.eligible) return 9;
    if (c.dayStatus === "FREI") return c.issues.length === 0 ? 0 : 1;
    if (c.dayStatus === "WUNSCHFREI") return 2;
    return 3; // z. B. weiterer Dienst am gleichen Tag ohne Konflikt
  };

  out.sort((a, b) => tier(a) - tier(b) || b.remainingHours - a.remainingHours || a.name.localeCompare(b.name, "de"));
  out.forEach((c, i) => (c.rank = i + 1));
  return out;
}
