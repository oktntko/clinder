import { createContext } from 'react';

export type ColorType = 'white' | 'gray' | 'green' | 'red' | 'blue' | 'yellow';

export type ToastOptions = { color?: ColorType };

export type ToastPlugin = {
  open(message: string, options?: ToastOptions): void;
  success(message: string, options?: ToastOptions): void;
  info(message: string, options?: ToastOptions): void;
  warn(message: string, options?: ToastOptions): void;
  danger(message: string, options?: ToastOptions): void;
};

export const ToastContext = createContext<ToastPlugin | null>(null);
