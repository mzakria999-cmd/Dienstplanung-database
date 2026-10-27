"use client";
import * as React from "react";
import type { ActionResult } from "@/server/errors";
import { useToast } from "./ui/toast";

/** Führt eine Server Action aus, zeigt Erfolg/Fehler als Toast und liefert den Ladezustand */
export function useAction() {
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const run = React.useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (data: T) => void; onError?: (r: { error: string; data?: unknown }) => void; silent?: boolean } = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        start(async () => {
          try {
            const r = await fn();
            if (r.ok) {
              if (!opts.silent && (opts.success || r.message)) toast("success", opts.success ?? r.message!);
              opts.onSuccess?.(r.data);
            } else {
              if (opts.onError) opts.onError(r);
              else toast("error", r.error);
            }
            resolve(r);
          } catch (e) {
            toast("error", e instanceof Error ? e.message : String(e));
            resolve({ ok: false, error: String(e) });
          }
        });
      }),
    [toast],
  );
  return { run, pending };
}
