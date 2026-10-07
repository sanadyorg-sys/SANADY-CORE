"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "danger" | "info";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Polite live region for transient notifications (auto-dismiss 5 s). */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const Icon = { success: CircleCheck, danger: CircleAlert, info: Info }[toast.tone];
  return (
    <div
      role={toast.tone === "danger" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-pop"
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          toast.tone === "success" && "text-success-600",
          toast.tone === "danger" && "text-danger-600",
          toast.tone === "info" && "text-navy-600",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-ink-900">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-label text-ink-600">{toast.description}</p> : null}
      </div>
      <button onClick={onDismiss} className="rounded-sm p-0.5 text-ink-400 hover:text-ink-700" aria-label="Fermer la notification">
        <X className="size-4" />
      </button>
    </div>
  );
}
