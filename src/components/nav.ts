import type { TKey } from "@/lib/i18n";

export type NavRole = "ADMIN" | "SUPERVISOR" | "EMPLOYEE";
export interface NavItem {
  key: TKey;
  href: string;
  icon: string;
  roles: NavRole[];
  color?: string;
  section?: TKey;
}

const ALL: NavRole[] = ["ADMIN", "SUPERVISOR", "EMPLOYEE"];
const STAFF: NavRole[] = ["ADMIN", "SUPERVISOR"];
const ADMIN: NavRole[] = ["ADMIN"];
const SELF: NavRole[] = ["SUPERVISOR", "EMPLOYEE"];

export const NAV: NavItem[] = [
  { key: "nav.dashboard", href: "/dashboard", icon: "LayoutDashboard", roles: ALL },
  { key: "nav.myRoster", href: "/mein-dienstplan", icon: "CalendarCheck", roles: SELF },
  { key: "nav.planning", href: "/dienstplanung", icon: "CalendarDays", roles: STAFF, section: "nav.section.planning" },
  { key: "nav.templates", href: "/muster", icon: "LayoutTemplate", roles: ADMIN },
  { key: "nav.employees", href: "/mitarbeiter", icon: "Users", roles: STAFF },
  { key: "shift.F", href: "/schicht/F", icon: "dot", color: "bg-shift-f", roles: STAFF },
  { key: "shift.S", href: "/schicht/S", icon: "dot", color: "bg-shift-s", roles: STAFF },
  { key: "shift.N", href: "/schicht/N", icon: "dot", color: "bg-shift-n", roles: STAFF },
  { key: "nav.changes", href: "/aenderungen", icon: "History", roles: STAFF },
  { key: "nav.sick", href: "/krankmeldungen", icon: "HeartPulse", roles: ALL },
  { key: "nav.offers", href: "/angebote", icon: "Handshake", roles: SELF },
  { key: "nav.availability", href: "/verfuegbarkeit", icon: "CalendarX", roles: SELF },
  { key: "nav.announcements", href: "/mitteilungen", icon: "Megaphone", roles: ADMIN, section: "nav.section.communication" },
  { key: "nav.sentAnnouncements", href: "/mitteilungen/gesendet", icon: "Send", roles: ADMIN },
  { key: "nav.myAnnouncements", href: "/meine-mitteilungen", icon: "Megaphone", roles: SELF, section: "nav.section.communication" },
  { key: "nav.notifications", href: "/benachrichtigungen", icon: "Bell", roles: ALL },
  { key: "nav.hours", href: "/stunden", icon: "Clock", roles: ALL, section: "nav.section.reporting" },
  { key: "nav.payroll", href: "/abrechnung", icon: "Calculator", roles: ADMIN },
  { key: "nav.objects", href: "/objekte", icon: "Building2", roles: ADMIN },
  { key: "nav.reports", href: "/berichte", icon: "FileText", roles: ADMIN },
  { key: "nav.settings", href: "/einstellungen", icon: "Settings", roles: ADMIN },
  { key: "nav.profile", href: "/profil", icon: "UserCog", roles: ALL },
];
