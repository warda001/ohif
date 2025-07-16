'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/24/solid';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastManager: ToastContextType | null = null;

export const toast = {
  success: (title: string, message?: string, options?: Partial<Toast>) => {
    toastManager?.addToast({ type: 'success', title, message, ...options });
  },
  error: (title: string, message?: string, options?: Partial<Toast>) => {
    toastManager?.addToast({ type: 'error', title, message, ...options });
  },
  warning: (title: string, message?: string, options?: Partial<Toast>) => {
    toastManager?.addToast({ type: 'warning', title, message, ...options });
  },
  info: (title: string, message?: string, options?: Partial<Toast>) => {
    toastManager?.addToast({ type: 'info', title, message, ...options });
  },
};

const ToastIcon = ({ type }: { type: Toast['type'] }) => {
  switch (type) {
    case 'success':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    case 'info':
      return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
    default:
      return null;
  }
};

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`
        relative flex items-start p-4 rounded-lg border shadow-lg backdrop-blur-sm
        ${bgColor}
        max-w-md w-full
      `}
    >
      <div className="flex-shrink-0 mr-3">
        <ToastIcon type={toast.type} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900">{toast.title}</h4>
        {toast.message && (
          <p className="mt-1 text-sm text-gray-600">{toast.message}</p>
        )}
        
        {toast.action && (
          <div className="mt-2">
            <button
              onClick={() => {
                toast.action?.onClick();
                onRemove(toast.id);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>
      
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    toastManager = {
      toasts,
      addToast: (newToast) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { ...newToast, id }]);
      },
      removeToast: (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      },
      clearToasts: () => {
        setToasts([]);
      },
    };

    return () => {
      toastManager = null;
    };
  }, [toasts]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem
              toast={toast}
              onRemove={(id) => {
                setToasts(prev => prev.filter(t => t.id !== id));
              }}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}