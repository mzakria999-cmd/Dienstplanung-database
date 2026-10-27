import "server-only";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { holidayMap } from "@/lib/holidays";
import { shiftHours } from "@/lib/hours";
import { dateKey, formatDate, formatHours, formatMonth, formatTime, isoWeekday, monthDays, monthName, monthRange, weekdayShort } from "@/lib/time";
import { getSettings, hourRules } from "../settings";
import { monthHoursFor } from "../hours-service";
import { ScheduleDocument, type ScheduleDocData, type ScheduleRow } from "./schedule-doc";

const EMPLOYMENT: Record<string, { de: string; en: string }> = {
  VOLLZEIT: { de: "Vollzeit", en: "Full-time" },
  TEILZEIT: { de: "Teilzeit", en: "Part-time" },
  MINIJOB: { de: "Minijob", en: "Mini-job" },
};

/** Dateiname laut Vorgabe: Dienstplan_November_2026_SD001.pdf */
export function schedulePdfFilename(year: number, month: number, personnelNumber: string) {
  const m = monthName(month, "de").replace(/ä/g, "ae");
  return `Dienstplan_${m}_${year}_${personnelNumber.replace(/[^A-Za-z0-9_-]/g, "")}.pdf`;
}

export async function buildScheduleDocData(employeeId: string, year: number, month: number, locale: "de" | "en" = "de"): Promise<ScheduleDocData> {
  const [settings, employee] = await Promise.all([
    getSettings(),
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { primaryObject: true } }),
  ]);
  const { from, to } = monthRange(year, month);
  const [assignments, absences, plan] = await Promise.all([
    prisma.assignment.findMany({ where: { employeeId, date: { gte: from, lte: to }, isDraft: false, status: { not: "CANCELLED" } }, include: { shiftType: true, object: true }, orderBy: { startAt: "asc" } }),
    prisma.absence.findMany({ where: { employeeId, date: { gte: from, lte: to } } }),
    prisma.monthPlan.findUnique({ where: { year_month: { year, month } } }),
  ]);
  const holidays = holidayMap([year], settings.bundesland);
  const rules = hourRules(settings, [year]);
  const hours = (await monthHoursFor(year, month, [employeeId])).get(employeeId)!;

  const rows: ScheduleRow[] = [];
  let daysOff = 0;
  for (const day of monthDays(year, month)) {
    const key = dateKey(day);
    const base = {
      date: formatDate(day, locale),
      weekday: weekdayShort(day, locale),
      weekend: isoWeekday(day) >= 6,
      holiday: holidays.get(key),
    };
    const list = assignments.filter((a) => dateKey(a.date) === key);
    if (list.length === 0) {
      const ab = absences.find((x) => dateKey(x.date) === key);
      const code = ab?.type === "SICK" ? "K" : ab?.type === "VACATION" ? "U" : ab?.type === "UNEXCUSED" ? "FT" : "FREI";
      const label = { K: locale === "de" ? "Krank" : "Sick", U: locale === "de" ? "Urlaub" : "Vacation", FT: locale === "de" ? "Fehltag" : "Absent", FREI: "" }[code]!;
      if (code === "FREI") daysOff++;
      rows.push({ ...base, code, label, start: "", end: "", object: "", hours: ab?.hours ? formatHours(ab.hours, locale) : "", changed: false });
      continue;
    }
    for (const a of list) {
      const name = locale === "de" ? a.shiftType.nameDe : a.shiftType.nameEn;
      const code = a.status === "SICK" ? "K" : a.status === "ABSENT" ? "FT" : a.status === "VACATION" ? "U" : a.shiftType.code;
      const label = a.status === "PLANNED" ? name : `${{ K: locale === "de" ? "Krank" : "Sick", FT: locale === "de" ? "Fehltag" : "Absent", U: locale === "de" ? "Urlaub" : "Vacation" }[code as "K"]} (${a.shiftType.code})`;
      rows.push({
        ...base,
        code,
        label,
        start: formatTime(a.startAt),
        end: formatTime(a.endAt),
        object: a.object.name,
        hours: formatHours(shiftHours(a.startAt, a.endAt, a.breakMinutes, rules).total, locale),
        changed: a.isChanged,
      });
    }
  }
  const generated = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date());
  return {
    locale,
    company: { name: settings.companyName, address: settings.address, phone: settings.phone, email: settings.email, logo: settings.logoDataUrl },
    employee: {
      name: `${employee.firstName} ${employee.lastName}`,
      personnelNumber: employee.personnelNumber,
      objectName: employee.primaryObject?.name ?? "—",
      employmentType: EMPLOYMENT[employee.employmentType][locale],
    },
    monthLabel: formatMonth(year, month, locale),
    rows,
    summary: {
      target: formatHours(hours.target, locale),
      planned: formatHours(hours.activePlanned, locale),
      remaining: formatHours(hours.remainingToPlan, locale),
      sick: formatHours(hours.sick, locale),
      vacation: formatHours(hours.vacation, locale),
      shifts: hours.shiftCount,
      daysOff,
    },
    version: plan?.version ? `Version ${plan.version}` : locale === "de" ? "Entwurf" : "Draft",
    generatedAt: generated,
  };
}

export async function renderEmployeeSchedulePdf(employeeId: string, year: number, month: number, locale: "de" | "en" = "de") {
  const data = await buildScheduleDocData(employeeId, year, month, locale);
  const buffer = await renderToBuffer(React.createElement(ScheduleDocument, { d: data }) as never);
  const emp = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { personnelNumber: true } });
  return { buffer: Buffer.from(buffer), filename: schedulePdfFilename(year, month, emp.personnelNumber) };
}
