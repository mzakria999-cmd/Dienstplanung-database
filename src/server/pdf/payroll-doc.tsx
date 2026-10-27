import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PayrollRow } from "../payroll";

const s = StyleSheet.create({
  page: { padding: 24, paddingBottom: 36, fontSize: 7.5, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottom: "2pt solid #0f1d36", paddingBottom: 6, marginBottom: 8 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f1d36" },
  head: { flexDirection: "row", backgroundColor: "#0f1d36", color: "#fff", fontFamily: "Helvetica-Bold", paddingVertical: 4 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #e2e8f0", paddingVertical: 3 },
  c: { paddingHorizontal: 2 },
  footer: { position: "absolute", bottom: 14, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94a3b8" },
});

const COLS: Array<{ key: keyof PayrollRow; label: string; w: number; num?: boolean }> = [
  { key: "personnelNumber", label: "Pers.-Nr.", w: 6 },
  { key: "lastName", label: "Nachname", w: 9 },
  { key: "firstName", label: "Vorname", w: 8 },
  { key: "target", label: "Soll", w: 5, num: true },
  { key: "planned", label: "Geplant", w: 5.5, num: true },
  { key: "actual", label: "Geleistet", w: 6, num: true },
  { key: "sick", label: "Krank", w: 5, num: true },
  { key: "vacation", label: "Urlaub", w: 5, num: true },
  { key: "overtime", label: "Überst.", w: 5.5, num: true },
  { key: "minus", label: "Minusst.", w: 5.5, num: true },
  { key: "night", label: "Nacht", w: 5, num: true },
  { key: "sunday", label: "Sonntag", w: 5.5, num: true },
  { key: "holiday", label: "Feiertag", w: 5.5, num: true },
  { key: "surcharge", label: "Zuschl.-rel.", w: 6.5, num: true },
  { key: "total", label: "Gesamt Lohn", w: 7, num: true },
  { key: "unconfirmed", label: "Unbest.", w: 5, num: true },
];

const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PayrollDocument(props: { company: string; logo?: string | null; monthLabel: string; rows: PayrollRow[]; generatedAt: string }) {
  const total = COLS.filter((c) => c.num).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.key]: props.rows.reduce((a, r) => a + (r[c.key] as number), 0) }), {});
  const width = COLS.reduce((a, c) => a + c.w, 0);
  const pct = (w: number) => `${(w / width) * 100}%`;
  return (
    <Document title={`Monatsabrechnung ${props.monthLabel}`} author={props.company} language="de">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header} fixed>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {props.logo ? <Image style={{ width: 70, height: 30, objectFit: "contain" }} src={props.logo} /> : null}
            <Text style={s.title}>{props.company}</Text>
          </View>
          <View>
            <Text style={s.title}>Monatsabrechnung {props.monthLabel}</Text>
            <Text style={{ fontSize: 7, color: "#64748b", textAlign: "right" }}>für die Buchhaltung · Grundlage: bestätigte Anwesenheit</Text>
          </View>
        </View>
        <View style={s.head} fixed>
          {COLS.map((c) => (
            <Text key={c.key} style={[s.c, { width: pct(c.w), textAlign: c.num ? "right" : "left" }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {props.rows.map((r, i) => (
          <View key={r.employeeId} style={[s.row, i % 2 ? { backgroundColor: "#f8fafc" } : {}]} wrap={false}>
            {COLS.map((c) => (
              <Text key={c.key} style={[s.c, { width: pct(c.w), textAlign: c.num ? "right" : "left", color: c.key === "unconfirmed" && r.unconfirmed > 0 ? "#dc2626" : "#0f172a" }]}>
                {c.num ? (c.key === "unconfirmed" ? String(r.unconfirmed) : fmt(r[c.key] as number)) : String(r[c.key])}
              </Text>
            ))}
          </View>
        ))}
        <View style={[s.row, { borderTop: "1pt solid #0f1d36", fontFamily: "Helvetica-Bold" }]} wrap={false}>
          {COLS.map((c, i) => (
            <Text key={c.key} style={[s.c, { width: pct(c.w), textAlign: c.num ? "right" : "left" }]}>
              {i === 0 ? "Summe" : c.num ? (c.key === "unconfirmed" ? String(total[c.key]) : fmt(total[c.key])) : ""}
            </Text>
          ))}
        </View>
        <Text style={{ marginTop: 10, fontSize: 7, color: "#475569" }}>
          Gesamt Lohn = tatsächlich geleistete Stunden + Krankheitsstunden (Entgeltfortzahlung) + Urlaubsstunden. Über-/Minusstunden = Gesamt Lohn − Soll. Zuschlagsrelevant = Stunden mit Nacht-, Sonntags- oder Feiertagsanteil (ohne Doppelzählung). „Unbest.“ = Anzahl
          vergangener Dienste ohne Anwesenheitsbestätigung (nicht in den Stunden enthalten).
        </Text>
        <View style={s.footer} fixed>
          <Text>Erstellt am {props.generatedAt} · SecurityDienst Manager Pro</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
