import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils.js';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toast: {
          success: (msg) => addToast(msg, 'success'),
          error: (msg) => addToast(msg, 'error'),
          info: (msg) => addToast(msg, 'info'),
        },
      }}
    >
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 w-80 max-w-[90vw] p-4 rounded-xl shadow-xl border bg-white animate-in slide-in-from-right-10 fade-in duration-300",
              t.type === 'success' ? "border-green-200" :
              t.type === 'error' ? "border-red-200" : "border-blue-200"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {t.type === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
              {t.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
            </div>
            <div className="flex-1 text-sm font-semibold text-slate-800 leading-tight">
              {t.message}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}
