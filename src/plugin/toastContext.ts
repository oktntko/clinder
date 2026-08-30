import { createContext } from 'react';

export type ColorType = 'default' | 'positive' | 'warning' | 'danger';

export type ToastOptions = { set?: ColorType };

export type ToastPlugin = {
  open(message: string, options?: ToastOptions): void;
  success(message: string, options?: ToastOptions): void;
  warn(message: string, options?: ToastOptions): void;
  danger(message: string, options?: ToastOptions): void;
};

export const ToastContext = createContext<ToastPlugin | null>(null);
