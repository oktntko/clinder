import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '~/lib/utils';

import { ToastContext, type ColorType, type ToastOptions, type ToastPlugin } from './toastContext';

type ToastItem = {
  id: number;
  message: string;
  color: ColorType;
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    const element = document.createElement('div');
    element.className =
      'toast-container pointer-events-none fixed bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 flex-col gap-4';
    document.body.appendChild(element);
    setContainer(element);

    return () => {
      element.remove();
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const openToast = useCallback(
    (message: string, { color = 'white', ...options }: ToastOptions = {}) => {
      const id = ++toastIdRef.current;

      setToasts((current) => [
        ...current,
        {
          id,
          message,
          color,
          ...options,
        },
      ]);

      window.setTimeout(() => {
        removeToast(id);
      }, 3250);
    },
    [removeToast],
  );

  const api = useMemo<ToastPlugin>(
    () => ({
      open: openToast,
      success(message: string, options?: ToastOptions) {
        return openToast(message, { color: 'green', ...options });
      },
      info(message: string, options?: ToastOptions) {
        return openToast(message, { color: 'blue', ...options });
      },
      warn(message: string, options?: ToastOptions) {
        return openToast(message, { color: 'yellow', ...options });
      },
      danger(message: string, options?: ToastOptions) {
        return openToast(message, { color: 'red', ...options });
      },
    }),
    [openToast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {container != null
        ? createPortal(
            <div className="pointer-events-none fixed bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 flex-col gap-4">
              {toasts.map((toast) => (
                <ToastContent
                  key={toast.id}
                  message={toast.message}
                  color={toast.color}
                  onClose={() => removeToast(toast.id)}
                />
              ))}
            </div>,
            container,
          )
        : null}
    </ToastContext.Provider>
  );
}

function ToastContent({
  message,
  color,
  onClose,
}: {
  message: string;
  color: ColorType;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toastRef = useRef<HTMLDivElement | null>(null);

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
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      close();
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [close]);

  const contentColor = (() => {
    switch (color) {
      case 'green':
        return 'border-green-300 text-green-800';
      case 'blue':
        return 'border-blue-300 text-blue-800';
      case 'yellow':
        return 'border-yellow-300 text-yellow-800';
      case 'red':
        return 'border-red-300 text-red-800';
      case 'white':
        return 'border-gray-300 text-gray-400';
      case 'gray':
        return 'border-gray-300 text-gray-800';
      default:
        return 'border-gray-300 text-gray-800';
    }
  })();

  const iconContainerColor = (() => {
    switch (color) {
      case 'green':
        return 'bg-green-100 text-green-800';
      case 'blue':
        return 'bg-blue-100 text-blue-800';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800';
      case 'red':
        return 'bg-red-100 text-red-800';
      case 'white':
        return 'bg-gray-100 text-gray-400';
      case 'gray':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  })();

  const icon = (() => {
    switch (color) {
      case 'green':
        return 'icon-[qlementine-icons--success-12]';
      case 'blue':
        return 'icon-[material-symbols--info-outline-rounded]';
      case 'yellow':
        return 'icon-[material-symbols--warning-outline-rounded]';
      case 'red':
        return 'icon-[material-symbols--dangerous-outline-rounded]';
      case 'white':
      case 'gray':
      default:
        return 'icon-[solar--dialog-line-duotone]';
    }
  })();

  return (
    <div
      ref={toastRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn([
        'pointer-events-auto relative flex w-sm items-center gap-2 rounded-lg border bg-white p-4 shadow-md',
        'transition-all duration-200 ease-out',
        contentColor,
        open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0',
      ])}
    >
      <div
        className={cn([
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          iconContainerColor,
        ])}
      >
        <span className={cn(['h-4 w-4', icon])}></span>
      </div>

      <span className="text-sm leading-relaxed whitespace-pre-wrap">{message}</span>

      <button
        type="button"
        className={cn([
          'absolute top-1 right-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent text-gray-400 transition outline-none',
          'hover:bg-gray-50 hover:ring-2 hover:ring-gray-300 focus:ring-2 focus:ring-gray-300 focus:outline-none',
          'disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-100 disabled:hover:bg-gray-400 disabled:hover:text-gray-200 disabled:hover:ring-gray-300 disabled:focus:ring-gray-300',
        ])}
        onClick={close}
      >
        <span className="icon-[bi--x] h-4 w-4" />
      </button>
    </div>
  );
}
