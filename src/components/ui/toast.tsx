"use client";
import * as React from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
const Ctx = React.createContext<(kind: Toast["kind"], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const push = React.useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 9000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg ${t.kind === "error" ? "bg-red-600 text-white" : t.kind === "success" ? "bg-green-600 text-white" : "bg-navy-800 text-white"}`}>
            {t.kind === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="Schließen">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => React.useContext(Ctx);
