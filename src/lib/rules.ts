import { HOUR_MS, addDaysKey, dateKey, durationHours } from "./time";

export interface TimeWindow {
  id?: string;
  date: string; // Kalendertag der Schicht
  startAt: Date;
  endAt: Date;
  breakMinutes?: number;
  code?: string; // Schichtkürzel (F/S/N)
}

export interface RuleSettings {
  minRestHours: number;
  maxDailyHours: number;
  maxConsecutiveDays: number;
}

export type IssueCode = "OVERLAP" | "REST" | "MAX_DAILY" | "CONSECUTIVE" | "DOUBLE_DAY";

export interface RuleIssue {
  code: IssueCode;
  severity: "error" | "warning";
  message: string;
  relatedId?: string;
}

const fmt = (d: Date) => `${dateKey(d).split("-").reverse().join(".")} ${d.toISOString().slice(11, 16)}`;

/**
 * Prüft eine geplante Schicht gegen die bestehenden aktiven Schichten desselben Mitarbeiters:
 * Überschneidung, Ruhezeit (§5 ArbZG), Höchstarbeitszeit (§3 ArbZG), aufeinanderfolgende Arbeitstage.
 */
export function checkConflicts(candidate: TimeWindow, existing: TimeWindow[], s: RuleSettings): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const others = existing.filter((e) => !candidate.id || e.id !== candidate.id);
  const restMs = s.minRestHours * HOUR_MS;
  const cs = candidate.startAt.getTime();
  const ce = candidate.endAt.getTime();

  for (const e of others) {
    const es = e.startAt.getTime();
    const ee = e.endAt.getTime();
    if (cs < ee && es < ce) {
      issues.push({ code: "OVERLAP", severity: "error", message: `Überschneidung mit Dienst ${fmt(e.startAt)}–${e.endAt.toISOString().slice(11, 16)}`, relatedId: e.id });
      continue;
    }
    if (ee <= cs && cs - ee < restMs) {
      const gap = Math.round(((cs - ee) / HOUR_MS) * 10) / 10;
      issues.push({ code: "REST", severity: "error", message: `Ruhezeit nur ${gap} h nach Dienstende ${fmt(e.endAt)} (mind. ${s.minRestHours} h)`, relatedId: e.id });
    } else if (es >= ce && es - ce < restMs) {
      const gap = Math.round(((es - ce) / HOUR_MS) * 10) / 10;
      issues.push({ code: "REST", severity: "error", message: `Ruhezeit nur ${gap} h vor Dienstbeginn ${fmt(e.startAt)} (mind. ${s.minRestHours} h)`, relatedId: e.id });
    }
  }

  const hours = durationHours(candidate.startAt, candidate.endAt, candidate.breakMinutes ?? 0);
  if (hours > s.maxDailyHours) {
    issues.push({ code: "MAX_DAILY", severity: "warning", message: `Dienstdauer ${hours} h überschreitet ${s.maxDailyHours} h` });
  }

  const days = new Set(others.map((e) => e.date));
  if (days.has(candidate.date) && !issues.some((i) => i.code === "OVERLAP")) {
    issues.push({ code: "DOUBLE_DAY", severity: "warning", message: "Mitarbeiter hat an diesem Tag bereits einen Dienst" });
  }
  days.add(candidate.date);
  const run = consecutiveRun(days, candidate.date);
  if (run > s.maxConsecutiveDays) {
    issues.push({ code: "CONSECUTIVE", severity: "warning", message: `${run} Arbeitstage in Folge (max. ${s.maxConsecutiveDays})` });
  }
  return issues;
}

export function consecutiveRun(days: Set<string>, around: string): number {
  let run = 1;
  let k = addDaysKey(around, -1);
  while (days.has(k)) {
    run++;
    k = addDaysKey(k, -1);
  }
  k = addDaysKey(around, 1);
  while (days.has(k)) {
    run++;
    k = addDaysKey(k, 1);
  }
  return run;
}

export function hasBlockingIssue(issues: RuleIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
