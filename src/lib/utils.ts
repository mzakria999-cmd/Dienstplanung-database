import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SHIFT_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; emoji: string }> = {
  F: { bg: "bg-shift-fbg", border: "border-shift-f", text: "text-shift-ftext", dot: "bg-shift-f", emoji: "🟢" },
  S: { bg: "bg-shift-sbg", border: "border-shift-s", text: "text-shift-stext", dot: "bg-shift-s", emoji: "🟡" },
  N: { bg: "bg-shift-nbg", border: "border-shift-n", text: "text-shift-ntext", dot: "bg-shift-n", emoji: "🟠" },
  K: { bg: "bg-red-100", border: "border-red-400", text: "text-red-800", dot: "bg-red-500", emoji: "🔴" },
  FT: { bg: "bg-slate-200", border: "border-slate-500", text: "text-slate-800", dot: "bg-slate-500", emoji: "⚫" },
  U: { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-800", dot: "bg-sky-500", emoji: "🔵" },
  FREI: { bg: "bg-white", border: "border-slate-200", text: "text-slate-400", dot: "bg-slate-300", emoji: "⚪" },
};

export function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
