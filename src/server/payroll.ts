import "server-only";
import React from "react";
import ExcelJS from "exceljs";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { formatMonth, monthRange } from "@/lib/time";
import { monthHoursFor } from "./hours-service";
import { getSettings } from "./settings";
import { PayrollDocument } from "./pdf/payroll-doc";

export interface PayrollRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  personnelNumber: string;
  employmentType: string;
  month: string;
  target: number;
  planned: number;
  actual: number;
  sick: number;
  vacation: number;
  overtime: number;
  minus: number;
  night: number;
  sunday: number;
  holiday: number;
  surcharge: number;
  total: number;
  unexcused: number;
  unconfirmed: number;
}

export const PAYROLL_COLUMNS: Array<{ key: keyof PayrollRow; de: string; en: string; num?: boolean }> = [
  { key: "firstName", de: "Vorname", en: "First name" },
  { key: "lastName", de: "Nachname", en: "Last name" },
  { key: "personnelNumber", de: "Personalnummer", en: "Personnel no." },
  { key: "month", de: "Abrechnungsmonat", en: "Payroll month" },
  { key: "target", de: "Sollstunden", en: "Target hours", num: true },
  { key: "planned", de: "Geplante Stunden", en: "Planned hours", num: true },
  { key: "actual", de: "Tatsächlich geleistete Stunden", en: "Actual hours worked", num: true },
  { key: "sick", de: "Krankheitsstunden", en: "Sick hours", num: true },
  { key: "vacation", de: "Urlaubsstunden", en: "Vacation hours", num: true },
  { key: "overtime", de: "Überstunden", en: "Overtime", num: true },
  { key: "minus", de: "Minusstunden", en: "Minus hours", num: true },
  { key: "night", de: "Nachtstunden", en: "Night hours", num: true },
  { key: "sunday", de: "Sonntagsstunden", en: "Sunday hours", num: true },
  { key: "holiday", de: "Feiertagsstunden", en: "Holiday hours", num: true },
  { key: "surcharge", de: "Zuschlagsrelevante Stunden", en: "Surcharge-relevant hours", num: true },
  { key: "total", de: "Gesamtstunden für Lohnabrechnung", en: "Total payroll hours", num: true },
];

/**
 * Monatsabrechnung: basiert auf BESTÄTIGTER Anwesenheit und erfassten Abwesenheiten –
 * nicht bestätigte Dienste werden NICHT als gearbeitet gezählt, sondern als Warnung ausgewiesen.
 */
export async function payrollRows(year: number, month: number): Promise<PayrollRow[]> {
  const { from, to } = monthRange(year, month);
  const employees = await prisma.employee.findMany({
    where: { OR: [{ status: "AKTIV" }, { assignments: { some: { date: { gte: from, lte: to } } } }, { absences: { some: { date: { gte: from, lte: to } } } }] },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const hours = await monthHoursFor(year, month, employees.map((e) => e.id));
  const label = `${String(month).padStart(2, "0")}/${year}`;
  return employees.map((e) => {
    const h = hours.get(e.id)!;
    return {
      employeeId: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      personnelNumber: e.personnelNumber,
      employmentType: e.employmentType,
      month: label,
      target: h.target,
      planned: h.planned,
      actual: h.actual,
      sick: h.sick,
      vacation: h.vacation,
      overtime: h.overtime,
      minus: h.minus,
      night: h.night,
      sunday: h.sunday,
      holiday: h.holiday,
      surcharge: h.surcharge,
      total: h.paid,
      unexcused: h.unexcused,
      unconfirmed: h.unconfirmed,
    };
  });
}

const de2 = (n: number) => n.toFixed(2).replace(".", ",");

export function payrollCsv(rows: PayrollRow[]): string {
  const head = PAYROLL_COLUMNS.map((c) => c.de).join(";");
  const lines = rows.map((r) => PAYROLL_COLUMNS.map((c) => (c.num ? de2(r[c.key] as number) : `"${String(r[c.key]).replace(/"/g, '""')}"`)).join(";"));
  return "﻿" + [head, ...lines].join("\r\n") + "\r\n";
}

export async function payrollXlsx(rows: PayrollRow[], year: number, month: number): Promise<Buffer> {
  const settings = await getSettings();
  const wb = new ExcelJS.Workbook();
  wb.creator = "SecurityDienst Manager Pro";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Abrechnung ${String(month).padStart(2, "0")}-${year}`, { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1 } });
  ws.mergeCells(1, 1, 1, PAYROLL_COLUMNS.length);
  ws.getCell(1, 1).value = `${settings.companyName} – Monatsabrechnung ${formatMonth(year, month)}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF0F1D36" } };
  ws.getCell(2, 1).value = `Erstellt am ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · Grundlage: bestätigte Anwesenheit & genehmigte Abwesenheiten`;
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  const header = ws.getRow(4);
  PAYROLL_COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.de;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1D36" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    ws.getColumn(i + 1).width = c.num ? 13 : 18;
  });
  header.height = 32;
  rows.forEach((r, idx) => {
    const row = ws.getRow(5 + idx);
    PAYROLL_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = r[c.key] as string | number;
      if (c.num) cell.numFmt = "#,##0.00";
    });
    if (r.unconfirmed > 0) row.getCell(PAYROLL_COLUMNS.length + 1).value = `${r.unconfirmed} Dienst(e) nicht bestätigt`;
    if (idx % 2) row.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }));
  });
  const sumRow = ws.getRow(5 + rows.length);
  sumRow.getCell(1).value = "Summe";
  sumRow.font = { bold: true };
  PAYROLL_COLUMNS.forEach((c, i) => {
    if (c.num && rows.length) {
      const col = ws.getColumn(i + 1).letter;
      sumRow.getCell(i + 1).value = { formula: `SUM(${col}5:${col}${4 + rows.length})` };
      sumRow.getCell(i + 1).numFmt = "#,##0.00";
    }
  });
  ws.getCell(4, PAYROLL_COLUMNS.length + 1).value = "Hinweis";
  ws.getCell(4, PAYROLL_COLUMNS.length + 1).font = { bold: true };
  ws.getColumn(PAYROLL_COLUMNS.length + 1).width = 28;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * DATEV LODAS ASCII-Import (Bewegungsdaten Stunden je Lohnart).
 * Lohnarten sind unter Einstellungen konfigurierbar – bitte mit dem Steuerberater abstimmen.
 */
export async function payrollDatev(rows: PayrollRow[], year: number, month: number): Promise<string> {
  const s = await getSettings();
  const period = `01.${String(month).padStart(2, "0")}.${year}`;
  const lines = [
    "[Allgemein]",
    "Ziel=LODAS",
    "Version_SST=1.0",
    `BeraterNr=${s.datevBeraterNr}`,
    `MandantenNr=${s.datevMandantNr}`,
    "Datumsangaben=TTMMJJJJ",
    "",
    "[Satzbeschreibung]",
    "1;u_lod_bwd_buchung_standard;abrechnung_zeitraum#bwd;pnr#bwd;la_eigene#bwd;bs_nr#bwd;bs_wert_butab#bwd;",
    "",
    "[Bewegungsdaten]",
  ];
  const map: Array<[keyof PayrollRow, string]> = [
    ["actual", s.datevLohnartWorked],
    ["overtime", s.datevLohnartOvertime],
    ["night", s.datevLohnartNight],
    ["sunday", s.datevLohnartSunday],
    ["holiday", s.datevLohnartHoliday],
    ["sick", s.datevLohnartSick],
    ["vacation", s.datevLohnartVacation],
  ];
  for (const r of rows) {
    const pnr = r.personnelNumber.replace(/\D/g, "") || r.personnelNumber;
    for (const [key, la] of map) {
      const v = r[key] as number;
      if (v > 0 && la) lines.push(`1;${period};${pnr};${la};1;${de2(v)};`);
    }
  }
  return lines.join("\r\n") + "\r\n";
}

export async function payrollPdf(rows: PayrollRow[], year: number, month: number): Promise<Buffer> {
  const s = await getSettings();
  const buf = await renderToBuffer(
    React.createElement(PayrollDocument, {
      company: s.companyName,
      logo: s.logoDataUrl,
      monthLabel: formatMonth(year, month),
      rows,
      generatedAt: new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
    }) as never,
  );
  return Buffer.from(buf);
}
