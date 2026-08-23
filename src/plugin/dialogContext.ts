import {
  createContext,
  type ComponentClass,
  type ComponentProps,
  type FunctionComponent,
} from 'react';

export type ReactComponent = ComponentClass<any> | FunctionComponent<any>;

export type ColorSet = 'default' | 'positive' | 'warning';

export type WindowDialogOptions = {
  set?: ColorSet;
  confirmText?: string;
  confirmValue?: string;
  cancelText?: string;
};

export type WindowDialogProps = WindowDialogOptions & {
  message: string;
  onConfirm: (value: string) => void;
  onCancel: (reason?: unknown) => void;
};

export type DialogPlugin = {
  /**
   * 任意の React コンポーネントをモーダルダイアログとして開きます。
   */
  showModal: <T, C extends ReactComponent>(
    Component: C,
    $props?: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void,
    ) => ComponentProps<C>,
    options?: {
      closedby?: 'any' | 'closerequest' | 'none';
      showCloseButton?: boolean;
    },
  ) => Promise<T>;

  /**
   * アラートダイアログ（OKボタンのみ）を表示するユーティリティ
   */
  alert: {
    open: (
      message: string,
      options?: Pick<WindowDialogOptions, 'set' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
    success: (
      message: string,
      options?: Pick<WindowDialogOptions, 'set' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
    warn: (
      message: string,
      options?: Pick<WindowDialogOptions, 'set' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
  };

  /**
   * 確認ダイアログ（YES/NOなどのボタン）を表示するユーティリティ
   */
  confirm: {
    open: (
      message: string,
      options?: Pick<WindowDialogOptions, 'set' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
    success: (
      message: string,
      options?: Pick<WindowDialogOptions, 'set' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
    warn: (
      message: string,
      options?: Pick<WindowDialogOptions, 'set' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
  };
};

export const DialogContext = createContext<DialogPlugin | null>(null);
