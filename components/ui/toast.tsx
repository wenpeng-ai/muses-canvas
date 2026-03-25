"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    [],
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 shrink-0" />,
  error: <AlertCircle className="h-5 w-5 shrink-0" />,
  info: <Info className="h-5 w-5 shrink-0" />,
};

const toastStyles: Record<
  ToastType,
  {
    container: string;
    iconWrap: string;
    closeButton: string;
  }
> = {
  success: {
    container:
      "border-[#b9e5c6] bg-[#effaf3] text-[#165b33] dark:border-[#255f3b] dark:bg-[#0f1f17] dark:text-[#7ce2a4]",
    iconWrap:
      "text-[#1f7a43] dark:text-[#7ce2a4]",
    closeButton:
      "text-[#1f7a43]/70 hover:text-[#1f7a43] dark:text-[#7ce2a4]/70 dark:hover:text-[#7ce2a4]",
  },
  error: {
    container:
      "border-[#f2c3c0] bg-[#fff1f0] text-[#a12f25] dark:border-[#6d2c2c] dark:bg-[#241314] dark:text-[#ffb4ae]",
    iconWrap:
      "text-[#cf3d31] dark:text-[#ffb4ae]",
    closeButton:
      "text-[#cf3d31]/70 hover:text-[#cf3d31] dark:text-[#ffb4ae]/70 dark:hover:text-[#ffb4ae]",
  },
  info: {
    container:
      "border-[#bfd9ff] bg-[#eff6ff] text-[#1f4f95] dark:border-[#284b78] dark:bg-[#101a2a] dark:text-[#9fc7ff]",
    iconWrap:
      "text-[#2c69bf] dark:text-[#9fc7ff]",
    closeButton:
      "text-[#2c69bf]/70 hover:text-[#2c69bf] dark:text-[#9fc7ff]/70 dark:hover:text-[#9fc7ff]",
  },
};

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-2xl border px-6 py-4 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.38)] animate-in slide-in-from-top-4 fade-in-0 duration-300 backdrop-blur-xl",
            toastStyles[toast.type].container,
          )}
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center",
              toastStyles[toast.type].iconWrap,
            )}
          >
            {icons[toast.type]}
          </span>
          <p className="flex-1 text-base font-medium leading-relaxed">
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className={cn(
              "shrink-0 transition-colors",
              toastStyles[toast.type].closeButton,
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
