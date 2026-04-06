import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toast: {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
  };
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-green-50/90',
    border: 'border-green-200',
    text: 'text-green-800',
    iconColor: 'text-green-500',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50/90',
    border: 'border-red-200',
    text: 'text-red-800',
    iconColor: 'text-red-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50/90',
    border: 'border-blue-200',
    text: 'text-blue-800',
    iconColor: 'text-blue-500',
  },
};

export default function Toast({ toast, onClose }: ToastProps) {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm min-w-[300px] max-w-sm pointer-events-auto ${config.bg} ${config.border}`}
      >
        <Icon size={20} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${config.text}`}>
            {toast.message}
          </p>
        </div>
        <button
          onClick={onClose}
          className={`shrink-0 p-1 rounded-md transition-colors hover:bg-black/5 ${config.iconColor}`}
        >
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
