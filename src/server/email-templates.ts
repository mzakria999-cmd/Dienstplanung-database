import { formatDate, formatMonth } from "@/lib/time";

type L = "de" | "en";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

interface Company {
  companyName: string;
  emailSignature: string;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

function layout(company: Company, bodyHtml: string, opts: { accent?: string; link?: string; linkLabel?: string } = {}): string {
  const accent = opts.accent ?? "#16294a";
  const button = opts.link
    ? `<p style="margin:24px 0"><a href="${esc(opts.link)}" style="background:${accent};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${esc(opts.linkLabel ?? "Öffnen")}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0f1d36;color:#fff;padding:18px 24px;font-size:18px;font-weight:700">${esc(company.companyName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">${bodyHtml}${button}</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px">Diese Nachricht wurde automatisch von SecurityDienst Manager Pro erstellt.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");
const shiftTable = (rows: Array<[string, string]>) =>
  `<table style="border-collapse:collapse;margin:8px 0 16px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#64748b">${esc(k)}:</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`)
    .join("")}</table>`;

function greeting(locale: L): string {
  return locale === "de" ? "Sehr geehrte Mitarbeiterin,<br>sehr geehrter Mitarbeiter," : "Dear colleague,";
}

function closing(locale: L, company: Company): string {
  return p(`${locale === "de" ? "Mit freundlichen Grüßen" : "Kind regards"}<br><br>${nl2br(company.emailSignature)}`);
}

function textClosing(locale: L, company: Company) {
  return `\n\n${locale === "de" ? "Mit freundlichen Grüßen" : "Kind regards"}\n\n${company.emailSignature}`;
}

export function monthlyScheduleMail(locale: L, company: Company, year: number, month: number, link: string): RenderedMail {
  const label = formatMonth(year, month, locale);
  if (locale === "en") {
    return {
      subject: `Your duty roster for ${label}`,
      html: layout(company, p(greeting(locale)) + p(`please find attached your personal duty roster for <b>${esc(label)}</b>.`) + p("Please check your scheduled shifts.") + p("You will be informed automatically about any changes.") + closing(locale, company), { link, linkLabel: "Open roster" }),
      text: `Dear colleague,\n\nplease find attached your personal duty roster for ${label}.\n\nPlease check your scheduled shifts.\nYou will be informed automatically about any changes.${textClosing(locale, company)}\n\n${link}`,
    };
  }
  return {
    subject: `Ihr Dienstplan für ${label}`,
    html: layout(
      company,
      p(greeting(locale)) + p(`anbei erhalten Sie Ihren persönlichen Dienstplan<br>für <b>${esc(label)}</b>.`) + p("Bitte überprüfen Sie Ihre geplanten Dienste.") + p("Bei Änderungen werden Sie automatisch informiert.") + closing(locale, company),
      { link, linkLabel: "Dienstplan in der App öffnen" },
    ),
    text: `Sehr geehrte Mitarbeiterin,\nsehr geehrter Mitarbeiter,\n\nanbei erhalten Sie Ihren persönlichen Dienstplan\nfür ${label}.\n\nBitte überprüfen Sie Ihre geplanten Dienste.\n\nBei Änderungen werden Sie automatisch informiert.${textClosing(locale, company)}\n\n${link}`,
  };
}

export interface ShiftInfo {
  date: Date;
  shiftName: string;
  start: string;
  end: string;
  objectName: string;
}

/** An Ersatz-/neu eingeteilten Mitarbeiter: "WICHTIG – DIENSTPLANÄNDERUNG" */
export function newShiftMail(locale: L, company: Company, s: ShiftInfo, link: string, note?: string): RenderedMail {
  const date = formatDate(s.date, locale);
  if (locale === "en") {
    const rows: Array<[string, string]> = [["Date", date], ["Shift", s.shiftName], ["Working hours", `${s.start}–${s.end}`], ["Location", s.objectName]];
    return {
      subject: "IMPORTANT – ROSTER CHANGE",
      html: layout(company, p("Dear colleague,") + p("your duty roster has been changed.") + p("<b>New shift:</b>") + shiftTable(rows) + (note ? p(esc(note)) : "") + p("Please note the updated roster.") + closing(locale, company), { accent: "#dc2626", link, linkLabel: "Open roster" }),
      text: `Dear colleague,\n\nyour duty roster has been changed.\n\nNew shift:\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nPlease note the updated roster.${textClosing(locale, company)}`,
    };
  }
  const rows: Array<[string, string]> = [["Datum", date], ["Schicht", s.shiftName], ["Arbeitszeit", `${s.start}–${s.end}`], ["Objekt", s.objectName]];
  return {
    subject: "WICHTIG – DIENSTPLANÄNDERUNG",
    html: layout(
      company,
      p("Sehr geehrter Mitarbeiter,") + p("Ihr Dienstplan wurde geändert.") + p("<b>Neuer Dienst:</b>") + shiftTable(rows) + (note ? p(esc(note)) : "") + p("Bitte beachten Sie den aktualisierten Dienstplan.") + closing(locale, company),
      { accent: "#dc2626", link, linkLabel: "Dienstplan öffnen" },
    ),
    text: `Sehr geehrter Mitarbeiter,\n\nIhr Dienstplan wurde geändert.\n\nNeuer Dienst:\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nBitte beachten Sie den aktualisierten Dienstplan.${textClosing(locale, company)}`,
  };
}

/** An kranken Mitarbeiter */
export function sickChangeMail(locale: L, company: Company, shifts: ShiftInfo[], link: string): RenderedMail {
  const blocks = shifts
    .map((s) =>
      shiftTable(
        locale === "de"
          ? [["Datum", formatDate(s.date, locale)], ["Schicht", s.shiftName], ["Status", "Krank / Nicht gearbeitet"]]
          : [["Date", formatDate(s.date, locale)], ["Shift", s.shiftName], ["Status", "Sick / not worked"]],
      ),
    )
    .join("");
  const textBlocks = shifts
    .map((s) => (locale === "de" ? `Datum: ${formatDate(s.date, locale)}\nSchicht: ${s.shiftName}\nStatus: Krank / Nicht gearbeitet` : `Date: ${formatDate(s.date, locale)}\nShift: ${s.shiftName}\nStatus: Sick / not worked`))
    .join("\n\n");
  if (locale === "en") {
    return {
      subject: "Roster change due to your sick note",
      html: layout(company, p("Your duty roster has been updated.") + blocks + p("Your updated roster is attached.") + p("Get well soon!") + closing(locale, company), { link, linkLabel: "Open roster" }),
      text: `Your duty roster has been updated.\n\n${textBlocks}\n\nYour updated roster is attached.${textClosing(locale, company)}`,
    };
  }
  return {
    subject: "Dienstplanänderung aufgrund Ihrer Krankmeldung",
    html: layout(company, p("Ihr Dienstplan wurde aktualisiert.") + blocks + p("Ihr aktualisierter Dienstplan befindet sich im Anhang.") + p("Gute Besserung!") + closing(locale, company), { link, linkLabel: "Dienstplan öffnen" }),
    text: `Ihr Dienstplan wurde aktualisiert.\n\n${textBlocks}\n\nIhr aktualisierter Dienstplan befindet sich im Anhang.${textClosing(locale, company)}`,
  };
}

/** Allgemeine Änderung (verschoben, entfernt, geändert) */
export function genericChangeMail(locale: L, company: Company, lines: string[], link: string): RenderedMail {
  const list = `<ul style="margin:8px 0 16px;padding-left:20px">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  if (locale === "en") {
    return {
      subject: "IMPORTANT – ROSTER CHANGE",
      html: layout(company, p("Dear colleague,") + p("your duty roster has been changed:") + list + p("The updated roster is attached.") + closing(locale, company), { accent: "#dc2626", link, linkLabel: "Open roster" }),
      text: `Dear colleague,\n\nyour duty roster has been changed:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nThe updated roster is attached.${textClosing(locale, company)}`,
    };
  }
  return {
    subject: "WICHTIG – DIENSTPLANÄNDERUNG",
    html: layout(company, p("Sehr geehrter Mitarbeiter,") + p("Ihr Dienstplan wurde geändert:") + list + p("Ihr aktualisierter Dienstplan befindet sich im Anhang.") + closing(locale, company), { accent: "#dc2626", link, linkLabel: "Dienstplan öffnen" }),
    text: `Sehr geehrter Mitarbeiter,\n\nIhr Dienstplan wurde geändert:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nIhr aktualisierter Dienstplan befindet sich im Anhang.${textClosing(locale, company)}`,
  };
}

export function offerMail(locale: L, company: Company, s: ShiftInfo, link: string): RenderedMail {
  const date = formatDate(s.date, locale);
  if (locale === "en") {
    const rows: Array<[string, string]> = [["Date", date], ["Shift", s.shiftName], ["Working hours", `${s.start}–${s.end}`], ["Location", s.objectName]];
    return {
      subject: `Shift offer: ${s.shiftName} on ${date}`,
      html: layout(company, p("Dear colleague,") + p("we would like to offer you the following shift:") + shiftTable(rows) + p("Please accept or decline the offer in the app.") + closing(locale, company), { link, linkLabel: "Respond now" }),
      text: `We would like to offer you the following shift:\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nPlease respond in the app: ${link}`,
    };
  }
  const rows: Array<[string, string]> = [["Datum", date], ["Schicht", s.shiftName], ["Arbeitszeit", `${s.start}–${s.end}`], ["Objekt", s.objectName]];
  return {
    subject: `Dienstangebot: ${s.shiftName} am ${date}`,
    html: layout(company, p("Sehr geehrter Mitarbeiter,") + p("wir möchten Ihnen folgenden Dienst anbieten:") + shiftTable(rows) + p("Bitte nehmen Sie das Angebot in der App an oder lehnen Sie es ab.") + closing(locale, company), { link, linkLabel: "Jetzt antworten" }),
    text: `Wir möchten Ihnen folgenden Dienst anbieten:\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nBitte antworten Sie in der App: ${link}`,
  };
}

export function announcementMail(locale: L, company: Company, a: { subject: string; message: string; priority: string; requireAck: boolean }, link: string): RenderedMail {
  const prefix = a.priority === "DRINGEND" ? (locale === "de" ? "[DRINGEND] " : "[URGENT] ") : a.priority === "WICHTIG" ? (locale === "de" ? "[WICHTIG] " : "[IMPORTANT] ") : "";
  const accent = a.priority === "DRINGEND" ? "#dc2626" : a.priority === "WICHTIG" ? "#ea580c" : "#16294a";
  const ack = a.requireAck ? p(`<b>${locale === "de" ? "Lesebestätigung erforderlich: Bitte bestätigen Sie diese Mitteilung in der App." : "Read confirmation required: please acknowledge this message in the app."}</b>`) : "";
  return {
    subject: prefix + a.subject,
    html: layout(company, `<h2 style="margin:0 0 16px;font-size:20px">${esc(a.subject)}</h2>` + p(nl2br(a.message)) + ack + closing(locale, company), {
      accent,
      link,
      linkLabel: a.requireAck ? (locale === "de" ? "Gelesen und verstanden bestätigen" : "Confirm read & understood") : locale === "de" ? "In der App öffnen" : "Open in app",
    }),
    text: `${a.subject}\n\n${a.message}${a.requireAck ? `\n\n${locale === "de" ? "Lesebestätigung erforderlich" : "Read confirmation required"}: ${link}` : ""}${textClosing(locale, company)}`,
  };
}
