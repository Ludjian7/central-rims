import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { cn } from '../lib/utils.js';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolveFn, setResolveFn] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolveFn(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    if (resolveFn) resolveFn(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolveFn) resolveFn(false);
    setIsOpen(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {isOpen && options && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className={cn(
                "px-6 py-4 border-b flex items-center justify-between",
                options.danger ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
             )}>
                <div className="flex items-center gap-3">
                  {options.danger ? (
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                  ) : null}
                  <h3 className={cn("font-bold text-lg", options.danger ? "text-red-900" : "text-slate-900")}>
                    {options.title}
                  </h3>
                </div>
                <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
             </div>
             <div className="p-6">
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {options.message}
                </p>
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
               <Button variant="ghost" onClick={handleCancel}>
                 {options.cancelText || 'Batal'}
               </Button>
               <Button 
                onClick={handleConfirm}
                className={options.danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"}
               >
                 {options.confirmText || 'Ya, Lanjutkan'}
               </Button>
             </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}
