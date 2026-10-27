/**
 * Automatische Monatsplanung aus einem Muster-Dienstplan (reine Logik, ohne DB).
 *
 * Ablauf: Slots (Tag × Schicht × Objekt × Sollbesetzung) werden chronologisch abgearbeitet.
 * Für jeden offenen Platz wird der am besten geeignete Mitarbeiter gewählt:
 *  harte Regeln  – aktiv, Objekt-Freigabe, zulässige Schichtart, nicht abwesend/krank/Urlaub/
 *                  nicht verfügbar, keine Überschneidung, Ruhezeit, max. Folgetage,
 *                  Sollstunden + Toleranz (Minijob: harte Obergrenze)
 *  Bewertung     – größte Reststunden zuerst, Schichtkontinuität, Stammobjekt, Wunschfrei vermeiden.
 * Nicht besetzbare Plätze werden als "unbesetzt" zurückgegeben.
 */
import { checkConflicts, hasBlockingIssue, type RuleSettings, type TimeWindow } from "./rules";
import { addDaysKey, durationHours } from "./time";

export interface PlannerSlot {
  date: string;
  shiftTypeId: string;
  shiftCode: string;
  objectId: string;
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  required: number;
  alreadyAssigned: number; // bestehende aktive Besetzungen für diesen Slot
  presetEmployeeIds?: string[]; // z. B. aus Rotationsmuster gewünscht
}

export interface PlannerEmployee {
  id: string;
  name: string;
  targetHours: number;
  employmentType: "VOLLZEIT" | "TEILZEIT" | "MINIJOB";
  allowedShiftCodes: string[];
  qualifiedObjectIds: Set<string>;
  primaryObjectId: string | null;
  blockedDates: Set<string>; // Krank, Urlaub, Fehltag, nicht verfügbar (ganztägig)
  blockedShifts: Set<string>; // "YYYY-MM-DD|F"
  preferredOff: Set<string>;
  existing: TimeWindow[]; // bereits aktive Dienste (auch Vormonat/Folgemonat für Ruhezeiten)
  plannedHours: number; // bereits geplante Stunden im Zielmonat (inkl. Krank/Urlaub-Gutschrift)
}

export interface PlannerSettings extends RuleSettings {
  overtimeTolerance: number;
  minijobMaxHours: number;
}

export interface PlannedAssignment {
  slotIndex: number;
  employeeId: string;
  hours: number;
}

export interface UnfilledSlot {
  slotIndex: number;
  missing: number;
  reasons: string[];
}

export interface PlannerResult {
  assignments: PlannedAssignment[];
  unfilled: UnfilledSlot[];
  hoursByEmployee: Record<string, number>;
}

export function maxHoursFor(e: PlannerEmployee, s: PlannerSettings): number {
  if (e.employmentType === "MINIJOB") return Math.min(e.targetHours, s.minijobMaxHours);
  return e.targetHours + s.overtimeTolerance;
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

export function eligibility(e: PlannerEmployee, slot: PlannerSlot, s: PlannerSettings, hours: number): Eligibility {
  if (!e.qualifiedObjectIds.has(slot.objectId)) return { ok: false, reason: "keine Objektfreigabe" };
  if (!e.allowedShiftCodes.includes(slot.shiftCode)) return { ok: false, reason: "Schichtart nicht zulässig" };
  if (e.blockedDates.has(slot.date)) return { ok: false, reason: "abwesend / nicht verfügbar" };
  if (e.blockedShifts.has(`${slot.date}|${slot.shiftCode}`)) return { ok: false, reason: "für diese Schicht nicht verfügbar" };
  if (e.plannedHours + hours > maxHoursFor(e, s) + 1e-9) return { ok: false, reason: "Sollstunden erreicht" };
  const issues = checkConflicts({ date: slot.date, startAt: slot.startAt, endAt: slot.endAt, breakMinutes: slot.breakMinutes }, e.existing, s);
  if (hasBlockingIssue(issues)) return { ok: false, reason: issues.find((i) => i.severity === "error")!.message };
  if (issues.some((i) => i.code === "CONSECUTIVE" || i.code === "DOUBLE_DAY" || i.code === "MAX_DAILY")) {
    return { ok: false, reason: issues.find((i) => i.code !== "OVERLAP")!.message };
  }
  return { ok: true };
}

function score(e: PlannerEmployee, slot: PlannerSlot, hours: number): number {
  const remaining = e.targetHours - e.plannedHours;
  let sc = remaining; // wer am weitesten vom Soll entfernt ist, zuerst
  const prevDay = addDaysKey(slot.date, -1);
  const prev = e.existing.find((w) => w.date === prevDay);
  if (prev) sc += 6; // Schichtblöcke bevorzugen (Kontinuität)
  if (prev && prev.code === slot.shiftCode) sc += 10;
  if (e.primaryObjectId === slot.objectId) sc += 8;
  if (e.preferredOff.has(slot.date)) sc -= 100;
  if (remaining - hours < 0) sc -= 20; // würde Überstunden erzeugen
  return sc;
}

export function planMonth(slots: PlannerSlot[], employees: PlannerEmployee[], s: PlannerSettings): PlannerResult {
  const order = slots
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => a.slot.startAt.getTime() - b.slot.startAt.getTime() || a.slot.objectId.localeCompare(b.slot.objectId));
  const result: PlannerResult = { assignments: [], unfilled: [], hoursByEmployee: {} };
  const byId = new Map(employees.map((e) => [e.id, e]));

  const assign = (e: PlannerEmployee, slot: PlannerSlot, slotIndex: number, hours: number) => {
    e.existing.push({ date: slot.date, startAt: slot.startAt, endAt: slot.endAt, breakMinutes: slot.breakMinutes, code: slot.shiftCode });
    e.plannedHours += hours;
    result.assignments.push({ slotIndex, employeeId: e.id, hours });
    result.hoursByEmployee[e.id] = (result.hoursByEmployee[e.id] ?? 0) + hours;
  };

  for (const { slot, i } of order) {
    const hours = durationHours(slot.startAt, slot.endAt, slot.breakMinutes);
    let missing = Math.max(0, slot.required - slot.alreadyAssigned);
    const assignedHere = new Set<string>();

    // 1. Vorbelegung (Rotationsmuster)
    for (const pid of slot.presetEmployeeIds ?? []) {
      if (missing <= 0) break;
      const e = byId.get(pid);
      if (!e || assignedHere.has(pid)) continue;
      if (eligibility(e, slot, s, hours).ok) {
        assign(e, slot, i, hours);
        assignedHere.add(pid);
        missing--;
      }
    }

    // 2. Beste Kandidaten wählen
    const reasons = new Map<string, number>();
    while (missing > 0) {
      let best: PlannerEmployee | null = null;
      let bestScore = -Infinity;
      for (const e of employees) {
        if (assignedHere.has(e.id)) continue;
        const el = eligibility(e, slot, s, hours);
        if (!el.ok) {
          reasons.set(el.reason, (reasons.get(el.reason) ?? 0) + 1);
          continue;
        }
        const sc = score(e, slot, hours);
        if (sc > bestScore || (sc === bestScore && best && e.name.localeCompare(best.name) < 0)) {
          best = e;
          bestScore = sc;
        }
      }
      if (!best) break;
      assign(best, slot, i, hours);
      assignedHere.add(best.id);
      missing--;
    }
    if (missing > 0) {
      const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, n]) => `${r} (${n})`);
      result.unfilled.push({ slotIndex: i, missing, reasons: top });
    }
  }
  return result;
}

/** Rotationsmuster: liefert für jeden Tag die gewünschte Schicht (oder "FREI") eines Mitglieds */
export function rotationCode(pattern: string[], rotationStart: string, day: string, offset: number): string {
  if (pattern.length === 0) return "FREI";
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${rotationStart}T00:00:00Z`)) / 86_400_000);
  const idx = (((diff + offset) % pattern.length) + pattern.length) % pattern.length;
  return pattern[idx];
}
