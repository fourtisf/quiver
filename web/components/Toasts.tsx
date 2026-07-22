"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { EXPLORER } from "@/lib/addresses";

export type Toast = {
  id: number;
  kind: "pending" | "success" | "error";
  text: string;
  txHash?: string;
};

type ToastApi = {
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);
let nextId = 1;

export function useToasts(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToasts outside provider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((ts) => [...ts, { ...t, id }]);
    if (t.kind !== "pending") setTimeout(() => dismiss(id), 7000);
    return id;
  }, [dismiss]);

  const update = useCallback((id: number, patch: Partial<Omit<Toast, "id">>) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (patch.kind && patch.kind !== "pending") setTimeout(() => dismiss(id), 7000);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={{ push, update, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,460px)] -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${
              t.kind === "error"
                ? "border-coral/40 bg-basin-3/95 text-coral"
                : "border-spring/30 bg-basin-3/95 text-foam"
            }`}
          >
            {t.kind === "pending" ? (
              <span className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-spring/25 border-t-spring-bright" />
            ) : t.kind === "success" ? (
              <span className="text-spring">✓</span>
            ) : (
              <span>✕</span>
            )}
            <span className="flex-1">{t.text}</span>
            {t.txHash ? (
              <a
                className="font-mono text-xs text-spring"
                href={`${EXPLORER}/tx/${t.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                tx ⧉
              </a>
            ) : null}
            <button aria-label="Dismiss" className="text-silt hover:text-foam" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
