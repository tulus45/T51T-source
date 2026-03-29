import { createContext, useContext, useState } from 'react';
import ToastViewport from '../components/ui/ToastViewport';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  function removeToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function showToast({ title, message, type = 'info' }) {
    const id = crypto.randomUUID();

    setToasts((current) => [...current, { id, title, message, type }]);

    window.setTimeout(() => {
      removeToast(id);
    }, 4000);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport onClose={removeToast} toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastContext harus digunakan di dalam ToastProvider.');
  }

  return context;
}
