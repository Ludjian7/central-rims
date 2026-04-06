import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity no-print" 
        onClick={onClose}
      />
      <div className={cn(
        "relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl ring-1 ring-gray-950/5 animate-in fade-in zoom-in duration-200",
        className
      )}>
        <div className="flex items-center justify-between mb-4 no-print">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {description && (
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
};
