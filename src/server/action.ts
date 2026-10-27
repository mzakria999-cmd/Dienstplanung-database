import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, type ActionResult } from "./errors";
import { ForbiddenError } from "./session";
import { getLocale } from "./i18n";

/** Einheitliche Fehlerbehandlung für Server Actions inkl. Übersetzung */
export async function act<T>(fn: () => Promise<T>, opts: { revalidate?: boolean; message?: { de: string; en: string } } = {}): Promise<ActionResult<T>> {
  const locale = await getLocale();
  try {
    const data = await fn();
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, data, message: opts.message ? opts.message[locale as "de" | "en"] : undefined };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return { ok: false, error: locale === "en" ? e.en : e.de, data: e.data };
    if (e instanceof ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    if (e instanceof ForbiddenError) return { ok: false, error: locale === "en" ? "Not allowed" : "Keine Berechtigung" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const field = String((e.meta?.target as string[] | undefined)?.join(", ") ?? "");
      return { ok: false, error: locale === "en" ? `Value already exists (${field})` : `Wert bereits vergeben (${field})` };
    }
    console.error(e);
    return { ok: false, error: locale === "en" ? "Unexpected error" : "Unerwarteter Fehler" };
  }
}
