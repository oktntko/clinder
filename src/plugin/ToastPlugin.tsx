import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '~/lib/utils';

import { colorClass, iconClass, type ColorSet } from './_plugin';
import { ToastContext, type ToastOptions, type ToastPlugin } from './toastContext';

type ToastItem = {
  id: number;
  message: string;
  set: ColorSet;
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const openToast = useCallback(
    (message: string, { set = 'default', ...options }: ToastOptions = {}) => {
      const id = ++toastIdRef.current;

      setToasts((current) => [
        ...current.slice(-4),
        {
          id,
          message,
          set,
          ...options,
        },
      ]);

      window.setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast],
  );

  const api = useMemo<ToastPlugin>(
    () => ({
      open: openToast,
      success(message: string, options: ToastOptions = {}) {
        return openToast(message, { set: 'positive', ...options });
      },
      info(message: string, options: ToastOptions = {}) {
        return openToast(message, { set: 'info', ...options });
      },
      warn(message: string, options: ToastOptions = {}) {
        return openToast(message, { set: 'warning', ...options });
      },
      danger(message: string, options: ToastOptions = {}) {
        return openToast(message, { set: 'danger', ...options });
      },
    }),
    [openToast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {toasts.map((toast, index, arr) => (
        <ToastContent
          key={toast.id}
          index={arr.length - 1 - index}
          message={toast.message}
          set={toast.set}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}

// React.memo で不要な再レンダリングを防止（index以外の変更時のみ）
const ToastContent = React.memo(function ({
  index,
  message,
  set,
  onClose,
}: {
  index: number;
  message: string;
  set: ColorSet;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toastRef = useRef<HTMLDivElement | null>(null);

  // onClose や close が変化してもタイマーが再設定されないよう Ref で最新関数を保持
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => {
      onCloseRef.current();
    }, 300);
  }, []);

  // 初回マウント時のみ 3000ms のタイマーをセットする
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      close();
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [close]);

  return (
    <div
      ref={toastRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={
        {
          '--index': index,
        } as React.CSSProperties
      }
      className={cn([
        'absolute bottom-0 left-1/2 z-10 w-sm -translate-x-1/2 overflow-hidden rounded-lg shadow-md',
        'transition-all duration-300 ease-out',
        'text-sm',
        'bg-white text-slate-900',
        'dark:bg-zinc-900 dark:text-zinc-100',
        open
          ? 'pointer-events-auto -translate-y-[calc(var(--spacing)*(var(--index)+1)*4)] scale-[calc(100%-(10%*var(--index)))] opacity-[calc(100%-(5%*var(--index)))]'
          : 'pointer-events-none -translate-y-[calc(var(--spacing)*var(--index)*4)] scale-[calc(100%-(10%*var(--index))-5%)] opacity-0',
      ])}
    >
      <div
        className={cn([
          'relative flex items-center gap-2 rounded-lg border px-4 py-2',
          colorClass(set),
        ])}
      >
        <span className={cn('size-5', iconClass(set))} />
        <span className="whitespace-pre-wrap">{message}</span>

        <button
          type="button"
          aria-label="Close"
          className={cn([
            'absolute top-1 right-1 size-5 cursor-pointer transition',
            'inline-flex items-center justify-center',
            'rounded-full outline-none hover:ring-1 focus:ring-2',
            'bg-transparent shadow',
            'text-slate-400',
            'hover:bg-white hover:ring-slate-400',
            'focus:bg-white focus:ring-slate-400',
            'dark:text-zinc-500',
            'dark:hover:bg-zinc-700 dark:hover:ring-zinc-500',
            'dark:focus:bg-zinc-700 dark:focus:ring-zinc-500',
          ])}
          onClick={close}
        >
          <span className="icon-[bi--x] size-4" />
        </button>
      </div>
    </div>
  );
});
