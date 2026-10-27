import "server-only";
import { prisma } from "@/lib/db";
import { holidayMap } from "@/lib/holidays";
import type { HourRules } from "@/lib/hours";

export async function getSettings() {
  return prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;

export function hourRules(s: Settings, years: number[]): HourRules {
  return { nightStart: s.nightStart, nightEnd: s.nightEnd, holidays: holidayMap(years, s.bundesland) };
}

export function ruleSettings(s: Settings) {
  return {
    minRestHours: s.minRestHours,
    maxDailyHours: s.maxDailyHours,
    maxConsecutiveDays: s.maxConsecutiveDays,
    overtimeTolerance: s.overtimeTolerance,
    minijobMaxHours: s.minijobMaxHours,
  };
}

export function appUrl(path = ""): string {
  const base = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
