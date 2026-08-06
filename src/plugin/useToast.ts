import { useContext } from 'react';

import { ToastContext } from './toastContext';

export function useToast() {
  const context = useContext(ToastContext);

  if (context == null) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
