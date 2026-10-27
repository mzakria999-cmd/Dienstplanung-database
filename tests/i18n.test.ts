import { describe, expect, it } from "vitest";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { translate } from "@/lib/i18n";

// Schlüssel, die im Code dynamisch aus Enum-Werten gebildet werden
const dynamic: Record<string, string[]> = {
  "shift.": ["F", "S", "N"],
  "role.": ["ADMIN", "SUPERVISOR", "EMPLOYEE"],
  "plan.status.": ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED"],
  "status.": ["PLANNED", "SICK", "ABSENT", "VACATION", "CANCELLED"],
  "attendance.": ["PENDING", "CONFIRMED", "NO_SHOW"],
  "absence.": ["K", "U", "FT", "W"],
  "emp.type.": ["VOLLZEIT", "TEILZEIT", "MINIJOB"],
  "emp.status.": ["AKTIV", "INAKTIV"],
  "tpl.type.": ["DAILY", "WEEKLY", "MONTHLY", "ROTATION"],
  "tpl.step": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  "day.": ["FREI", "IM_DIENST", "KRANK", "URLAUB", "FEHLTAG", "NICHT_VERFUEGBAR", "WUNSCHFREI"],
  "offer.": ["OFFERED", "ACCEPTED", "REJECTED", "WITHDRAWN", "ASSIGNED"],
  "changeType.": ["CREATED", "DELETED", "MODIFIED", "SICK", "ABSENT", "VACATION", "REPLACEMENT", "ATTENDANCE", "RESTORED"],
  "notify.": ["NOT_REQUIRED", "PENDING", "SENT", "PARTIAL", "FAILED"],
  "request.": ["OPEN", "APPROVED", "REJECTED"],
  "priority.": ["NORMAL", "WICHTIG", "DRINGEND"],
  "channel.": ["EMAIL", "APP", "BOTH"],
  "recipientMode.": ["ALL", "SHIFT_F", "SHIFT_S", "SHIFT_N", "SELECTED"],
  "annStatus.": ["SCHEDULED", "SENDING", "SENT", "FAILED"],
  "notifType.": ["SCHEDULE_PUBLISHED", "SCHEDULE_CHANGED", "ANNOUNCEMENT", "URGENT_ANNOUNCEMENT", "SHIFT_REMINDER", "SHIFT_OFFER", "SHIFT_TAKEOVER", "SCHEDULE_UPDATED", "SICK_REPORTED", "REQUEST", "SYSTEM"],
  "avail.": ["UNAVAILABLE", "PREFERRED_OFF", "AVAILABLE"],
  "ann.when.": ["today", "tomorrow", "date", "range"],
  "grid.copy.": ["day", "week", "month"],
  "dispatch.": ["SENT", "FAILED", "NO_EMAIL"],
  "login.error.": ["invalid", "inactive", "locked", "totp_required", "totp_invalid"],
};

describe("Übersetzungen", () => {
  it("DE und EN haben dieselben Schlüssel und keine leeren Texte", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    for (const [k, v] of Object.entries(en)) expect(v, k).not.toBe("");
  });
  it("alle dynamisch gebildeten Schlüssel existieren", () => {
    for (const [prefix, values] of Object.entries(dynamic)) for (const v of values) expect(de, `${prefix}${v}`).toHaveProperty([`${prefix}${v}`]);
  });
  it("Platzhalter werden ersetzt", () => {
    expect(translate("de", "ann.confirmText", { n: 18 })).toBe("Diese Mitteilung wird an 18 Mitarbeiter gesendet.");
    expect(translate("en", "ann.confirmText", { n: 18 })).toBe("This message will be sent to 18 employees.");
  });
});
