import {
  createContext,
  type ComponentClass,
  type ComponentProps,
  type FunctionComponent,
  type InputHTMLAttributes,
} from 'react';

export type ReactComponent = ComponentClass<any> | FunctionComponent<any>;

export type ColorType = 'white' | 'gray' | 'green' | 'red' | 'blue' | 'yellow';

export type WindowDialogOptions = {
  color?: ColorType;
  confirmText?: string;
  confirmValue?: string;
  cancelText?: string;
  prompt?: InputHTMLAttributes<HTMLInputElement>;
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
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
    success: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
    info: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
    warn: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
    danger: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText'>,
    ) => Promise<'confirm' | 'cancel'>;
  };

  /**
   * 確認ダイアログ（YES/NOなどのボタン）を表示するユーティリティ
   */
  confirm: {
    open: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
    success: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
    info: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
    warn: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
    danger: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText'>,
    ) => Promise<'YES' | 'cancel'>;
  };

  /**
   * 入力フィールド付きのプロンプトダイアログを表示するユーティリティ
   */
  prompt: {
    open: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText' | 'prompt'>,
    ) => Promise<`confirm:${string}` | 'cancel'>;
    success: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText' | 'prompt'>,
    ) => Promise<`confirm:${string}` | 'cancel'>;
    info: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText' | 'prompt'>,
    ) => Promise<`confirm:${string}` | 'cancel'>;
    warn: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText' | 'prompt'>,
    ) => Promise<`confirm:${string}` | 'cancel'>;
    danger: (
      message: string,
      options?: Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText' | 'prompt'>,
    ) => Promise<`confirm:${string}` | 'cancel'>;
  };

  /**
   * ローディングダイアログを表示します。
   */
  loading: () => {
    close: () => void;
  };
};

export const DialogContext = createContext<DialogPlugin | null>(null);
