import { createContext } from 'react';

import type { ColorSet } from './_plugin';

export type ToastOptions = { set?: ColorSet };

export type ToastPlugin = {
  open(message: string, options?: ToastOptions): void;
  success(message: string, options?: ToastOptions): void;
  info(message: string, options?: ToastOptions): void;
  warn(message: string, options?: ToastOptions): void;
  danger(message: string, options?: ToastOptions): void;
};

export const ToastContext = createContext<ToastPlugin | null>(null);
