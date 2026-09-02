import { createContext, type ComponentProps } from 'react';

import type { ColorSet, ReactComponent } from './_plugin';

export type DialogContent<T, C extends ReactComponent> = {
  Component: C;
  $props?: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ) => ComponentProps<C>;
  options?: {
    closedby?: 'any' | 'closerequest' | 'none';
    showCloseButton?: boolean;
    fixed?: {
      width: number;
      height: number;
      position: Position;
    };
  };
};

export type Position = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export type WindowDialogOptions = {
  set?: ColorSet;
  confirmText?: string;
  confirmValue?: string;
  cancelText?: string;
};
export type WindowDialogAlertOptions = Pick<WindowDialogOptions, 'set' | 'confirmText'>;
export type AlertOptions = Omit<WindowDialogAlertOptions, 'set'>;
export type WindowDialogConfirmOptions = Pick<
  WindowDialogOptions,
  'set' | 'confirmText' | 'cancelText'
>;
export type ConfirmOptions = Omit<WindowDialogConfirmOptions, 'set'>;

export type DialogPlugin = {
  /**
   * 任意の React コンポーネントをモーダルダイアログとして開きます。
   */
  showModal: <T, C extends ReactComponent>(args: DialogContent<T, C>) => Promise<T>;

  alert: {
    open: (message: string, options?: WindowDialogAlertOptions) => Promise<'confirm' | 'cancel'>;
    success: (message: string, options?: AlertOptions) => Promise<'confirm' | 'cancel'>;
    info: (message: string, options?: AlertOptions) => Promise<'confirm' | 'cancel'>;
    warn: (message: string, options?: AlertOptions) => Promise<'confirm' | 'cancel'>;
    danger: (message: string, options?: AlertOptions) => Promise<'confirm' | 'cancel'>;
  };

  confirm: {
    open: (message: string, options?: WindowDialogConfirmOptions) => Promise<'YES' | 'cancel'>;
    success: (message: string, options?: ConfirmOptions) => Promise<'YES' | 'cancel'>;
    info: (message: string, options?: ConfirmOptions) => Promise<'YES' | 'cancel'>;
    warn: (message: string, options?: ConfirmOptions) => Promise<'YES' | 'cancel'>;
    danger: (message: string, options?: ConfirmOptions) => Promise<'YES' | 'cancel'>;
  };
};

export const DialogContext = createContext<DialogPlugin | null>(null);
