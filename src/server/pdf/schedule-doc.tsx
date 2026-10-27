import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface ScheduleRow {
  date: string; // dd.mm.yyyy
  weekday: string;
  code: string; // F, S, N, FREI, K, FT, U
  label: string;
  start: string;
  end: string;
  object: string;
  hours: string;
  changed: boolean;
  weekend: boolean;
  holiday?: string;
}

export interface ScheduleDocData {
  locale: "de" | "en";
  company: { name: string; address: string; phone: string; email: string; logo?: string | null };
  employee: { name: string; personnelNumber: string; objectName: string; employmentType: string };
  monthLabel: string;
  rows: ScheduleRow[];
  summary: { target: string; planned: string; remaining: string; sick: string; vacation: string; shifts: number; daysOff: number };
  version: string;
  generatedAt: string;
}

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  F: { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
  S: { bg: "#fef9c3", border: "#eab308", text: "#713f12" },
  N: { bg: "#ffedd5", border: "#f97316", text: "#7c2d12" },
  K: { bg: "#fee2e2", border: "#ef4444", text: "#7f1d1d" },
  FT: { bg: "#f1f5f9", border: "#64748b", text: "#0f172a" },
  U: { bg: "#e0f2fe", border: "#0ea5e9", text: "#0c4a6e" },
  FREI: { bg: "#ffffff", border: "#e2e8f0", text: "#94a3b8" },
};

const s = StyleSheet.create({
  page: { padding: 28, paddingBottom: 40, fontSize: 8.5, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: "2pt solid #0f1d36", paddingBottom: 8, marginBottom: 10 },
  logo: { width: 90, height: 40, objectFit: "contain" },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f1d36" },
  small: { fontSize: 7.5, color: "#475569" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f1d36", textAlign: "right" },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  infoBox: { flex: 1, border: "1pt solid #e2e8f0", borderRadius: 4, padding: 6 },
  infoLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase" },
  infoValue: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tableHead: { flexDirection: "row", backgroundColor: "#0f1d36", color: "#ffffff", fontFamily: "Helvetica-Bold", paddingVertical: 4, borderRadius: 2 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #e2e8f0", minHeight: 15, alignItems: "center" },
  cell: { paddingHorizontal: 4 },
  badge: { borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 4, borderWidth: 1, fontFamily: "Helvetica-Bold", textAlign: "center" },
  changed: { color: "#dc2626", fontFamily: "Helvetica-Bold", fontSize: 7 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94a3b8" },
});

const W = { date: "11%", wd: "6%", shift: "22%", start: "8%", end: "8%", object: "25%", hours: "8%", note: "12%" };

export function ScheduleDocument({ d }: { d: ScheduleDocData }) {
  const de = d.locale === "de";
  const L = de
    ? { title: "Dienstplan", emp: "Mitarbeiter", pnr: "Personalnummer", obj: "Objekt", type: "Beschäftigung", date: "Datum", wd: "Tag", shift: "Schicht", start: "Beginn", end: "Ende", object: "Objekt", hours: "Std.", note: "Hinweis", target: "Sollstunden", planned: "Geplante Stunden", remaining: "Reststunden", sick: "Krankheit", vac: "Urlaub", changed: "ÄNDERUNG", legend: "Legende", gen: "Erstellt am", page: "Seite", shifts: "Dienste", off: "Freie Tage" }
    : { title: "Duty roster", emp: "Employee", pnr: "Personnel no.", obj: "Location", type: "Employment", date: "Date", wd: "Day", shift: "Shift", start: "Start", end: "End", object: "Location", hours: "Hrs", note: "Note", target: "Target hours", planned: "Planned hours", remaining: "Remaining", sick: "Sick", vac: "Vacation", changed: "CHANGED", legend: "Legend", gen: "Generated", page: "Page", shifts: "Shifts", off: "Days off" };

  return (
    <Document title={`${L.title} ${d.monthLabel} ${d.employee.personnelNumber}`} author={d.company.name} language={d.locale}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {d.company.logo ? <Image style={s.logo} src={d.company.logo} /> : null}
            <View>
              <Text style={s.company}>{d.company.name}</Text>
              <Text style={s.small}>{[d.company.address, d.company.phone, d.company.email].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <View>
            <Text style={s.title}>{L.title}</Text>
            <Text style={[s.title, { fontSize: 12 }]}>{d.monthLabel}</Text>
          </View>
        </View>

        <View style={s.infoRow}>
          <View style={[s.infoBox, { flex: 2 }]}>
            <Text style={s.infoLabel}>{L.emp}</Text>
            <Text style={s.infoValue}>{d.employee.name}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>{L.pnr}</Text>
            <Text style={s.infoValue}>{d.employee.personnelNumber}</Text>
          </View>
          <View style={[s.infoBox, { flex: 2 }]}>
            <Text style={s.infoLabel}>{L.obj}</Text>
            <Text style={s.infoValue}>{d.employee.objectName}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>{L.type}</Text>
            <Text style={s.infoValue}>{d.employee.employmentType}</Text>
          </View>
        </View>

        <View style={s.infoRow}>
          {[
            [L.target, d.summary.target],
            [L.planned, d.summary.planned],
            [L.remaining, d.summary.remaining],
            [L.sick, d.summary.sick],
            [L.vac, d.summary.vacation],
            [L.shifts, String(d.summary.shifts)],
            [L.off, String(d.summary.daysOff)],
          ].map(([k, v]) => (
            <View key={k} style={[s.infoBox, { backgroundColor: "#f8fafc" }]}>
              <Text style={s.infoLabel}>{k}</Text>
              <Text style={s.infoValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.tableHead} fixed>
          <Text style={[s.cell, { width: W.date }]}>{L.date}</Text>
          <Text style={[s.cell, { width: W.wd }]}>{L.wd}</Text>
          <Text style={[s.cell, { width: W.shift }]}>{L.shift}</Text>
          <Text style={[s.cell, { width: W.start }]}>{L.start}</Text>
          <Text style={[s.cell, { width: W.end }]}>{L.end}</Text>
          <Text style={[s.cell, { width: W.object }]}>{L.object}</Text>
          <Text style={[s.cell, { width: W.hours, textAlign: "right" }]}>{L.hours}</Text>
          <Text style={[s.cell, { width: W.note }]}>{L.note}</Text>
        </View>
        {d.rows.map((r, i) => {
          const c = COLORS[r.code] ?? COLORS.FREI;
          return (
            <View key={i} style={[s.row, r.weekend ? { backgroundColor: "#f8fafc" } : {}]} wrap={false}>
              <Text style={[s.cell, { width: W.date }]}>{r.date}</Text>
              <Text style={[s.cell, { width: W.wd, color: r.weekend ? "#dc2626" : "#0f172a" }]}>{r.weekday}</Text>
              <View style={[s.cell, { width: W.shift }]}>
                <Text style={[s.badge, { backgroundColor: c.bg, borderColor: r.changed ? "#dc2626" : c.border, color: c.text, borderWidth: r.changed ? 1.5 : 1 }]}>
                  {r.code === "FREI" ? "FREI" : `${r.code} · ${r.label}`}
                </Text>
              </View>
              <Text style={[s.cell, { width: W.start }]}>{r.start}</Text>
              <Text style={[s.cell, { width: W.end }]}>{r.end}</Text>
              <Text style={[s.cell, { width: W.object }]}>{r.object}</Text>
              <Text style={[s.cell, { width: W.hours, textAlign: "right" }]}>{r.hours}</Text>
              <View style={[s.cell, { width: W.note }]}>
                {r.changed ? <Text style={s.changed}>{L.changed}</Text> : null}
                {r.holiday ? <Text style={{ fontSize: 6.5, color: "#7c3aed" }}>{r.holiday}</Text> : null}
              </View>
            </View>
          );
        })}

        <View style={s.legend} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{L.legend}:</Text>
          {(de
            ? [["F", "Frühschicht"], ["S", "Spätschicht"], ["N", "Nachtschicht"], ["FREI", "Freier Tag"], ["K", "Krank"], ["FT", "Fehltag"], ["U", "Urlaub"]]
            : [["F", "Early shift"], ["S", "Late shift"], ["N", "Night shift"], ["FREI", "Day off"], ["K", "Sick"], ["FT", "Absent"], ["U", "Vacation"]]
          ).map(([code, label]) => (
            <Text key={code} style={[s.badge, { backgroundColor: COLORS[code].bg, borderColor: COLORS[code].border, color: COLORS[code].text }]}>
              {code} = {label}
            </Text>
          ))}
          <Text style={[s.badge, { borderColor: "#dc2626", color: "#dc2626", borderWidth: 1.5 }]}>{de ? "Rot umrandet = Änderung" : "Red border = changed"}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {L.gen} {d.generatedAt} · {d.version}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${L.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
