import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { Button } from '~/component/Button';
import { cn } from '~/lib/utils';

import {
  DialogContext,
  type ColorSet,
  type DialogContent,
  type ReactComponent,
  type WindowDialogOptions,
  type WindowDialogProps,
} from './dialogContext';

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DialogContentInner<any, ReactComponent>[]>([]);
  const idRef = useRef(0);

  const removeDialog = useCallback((id: number) => {
    setItems((current) => current.filter((dialog) => dialog.id !== id));
  }, []);

  const showModal = useMemo(
    () =>
      <T, C extends ReactComponent>(args: DialogContent<T, C>) => {
        const id = ++idRef.current;
        return new Promise<T>((resolve, reject) => {
          setItems((current) => [...current, { id, resolve, reject, ...args }]);
        });
      },
    [],
  );

  const showWindowDialog = useMemo(
    () =>
      <T extends string>(message: string, options?: WindowDialogOptions) => {
        return showModal<T, typeof WindowDialog>({
          Component: WindowDialog,
          $props: (resolve, reject) => ({
            message,
            ...options,
            onConfirm: (value) => resolve(value as T),
            onCancel: reject,
          }),
        });
      },
    [showModal],
  );

  const api = useMemo(
    () => ({
      showModal,

      get alert() {
        type O = Pick<WindowDialogOptions, 'set' | 'confirmText'>;
        return {
          async open(message: string, { confirmText = 'OK', ...options }: O = {}) {
            return showWindowDialog<'confirm' | 'cancel'>(message, { confirmText, ...options });
          },
          async success(message: string, { set = 'positive', ...options }: O = {}) {
            return this.open(message, { set, ...options });
          },
          async warn(message: string, { set = 'warning', ...options }: O = {}) {
            return this.open(message, { set, ...options });
          },
        };
      },
      get confirm() {
        type O = Pick<WindowDialogOptions, 'set' | 'confirmText' | 'cancelText'>;
        return {
          async open(
            message: string,
            { confirmText = 'YES', cancelText = 'NO', ...options }: O = {},
          ) {
            return showWindowDialog<'YES' | 'cancel'>(message, {
              confirmText,
              cancelText,
              confirmValue: 'YES',
              ...options,
            });
          },
          async success(message: string, { set = 'positive', ...options }: O = {}) {
            return this.open(message, { set, ...options });
          },
          async warn(message: string, { set = 'warning', ...options }: O = {}) {
            return this.open(message, { set, ...options });
          },
        };
      },
    }),
    [showModal, showWindowDialog],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}

      {items.map((dialogContent) => (
        <DialogContainer
          key={dialogContent.id}
          {...dialogContent}
          onClose={() => removeDialog(dialogContent.id)}
        />
      ))}
    </DialogContext.Provider>
  );
}

type DialogContentInner<T, C extends ReactComponent> = DialogContent<T, C> & {
  id: number;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function DialogContainer<T, C extends ReactComponent>({
  onClose,
  Component,
  resolve,
  reject,
  $props,
  options,
}: {
  onClose: () => void;
} & DialogContentInner<T, C>) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const trapResolve = useCallback(
    (value: T | PromiseLike<T>) => {
      dialogRef.current?.close('cancel');
      resolve(value);
    },
    [resolve],
  );

  const trapReject = useCallback(
    (reason?: unknown) => {
      dialogRef.current?.close('cancel');
      reject(reason);
    },
    [reject],
  );

  const componentProps = useMemo(
    () => ($props ? $props(trapResolve, trapReject) : ({} as ComponentProps<C>)),
    [$props, trapResolve, trapReject],
  );

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleClose = () => {
      const timerId = setTimeout(() => {
        onCloseRef.current();
      }, 250);

      dialog.addEventListener(
        'transitionend',
        (e) => {
          if (e.target === dialog) {
            clearTimeout(timerId);
            onCloseRef.current();
          }
        },
        { once: true },
      );

      reject(dialog.returnValue || 'cancel');
    };

    dialog.addEventListener('close', handleClose, { once: true });

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [reject]);

  useEffect(() => {
    function closeDialog(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation(); // App.tsx の hideWindow に突き抜けないようにする
      }
    }
    function preventContextMenu(e: MouseEvent) {
      e.stopPropagation();
    }

    window.addEventListener('keydown', closeDialog, true);
    window.addEventListener('contextmenu', preventContextMenu, true);

    return () => {
      window.removeEventListener('keydown', closeDialog, true);
      window.removeEventListener('contextmenu', preventContextMenu, true);
    };
  });

  const style = useMemo(() => {
    const style: CSSProperties = {};
    if (options?.fixed) {
      const fixed = options?.fixed;

      style.margin = '0'; // マージで中の要素を中央寄せしているので消す
      style.insetInlineStart = 'unset'; // 消すと right: が効くようになる
      style.insetBlockStart = 'unset'; // 消すと bottom: が効くようになる
      style.position = 'fixed';

      if (window.innerWidth >= fixed.position.left + fixed.width) {
        style.left = `${fixed.position.left}px`;
      } else {
        style.right = 'calc(4px + var(--spacing) * 1.5)'; // scrollbar 分
      }

      if (window.innerHeight >= fixed.position.top + fixed.height) {
        style.top = `${fixed.position.top}px`;
      } else {
        style.bottom = `${window.innerHeight - fixed.position.bottom}px`;
      }
    }

    return style;
  }, [options?.fixed]);

  return (
    <dialog
      ref={dialogRef}
      style={style}
      className={cn([
        'm-auto overflow-visible bg-transparent outline-hidden',
        'transition transition-discrete duration-200 ease-out',
        'scale-95 opacity-0',
        'starting:[[open]]:scale-95 starting:[[open]]:opacity-0',
        '[[open]]:scale-100 [[open]]:opacity-100',
        'backdrop:bg-gray-500/20',
        options?.fixed ? 'backdrop:backdrop-grayscale-xs' : 'backdrop:backdrop-blur-xs',
        'backdrop:transition backdrop:transition-discrete backdrop:duration-200 backdrop:ease-out',
        'backdrop:opacity-0',
        'starting:[[open]]:backdrop:opacity-0',
        '[[open]]:backdrop:opacity-100',
      ])}
      closedby={options?.closedby ?? 'any'}
    >
      <Component {...componentProps} />

      {options?.showCloseButton !== false && (
        <button
          type="button"
          aria-label="Close"
          className={cn(
            'absolute top-1 right-1 size-6 cursor-pointer transition',
            'inline-flex items-center justify-center',
            'rounded-full outline-none hover:ring-1 focus:ring-2',
            'bg-transparent shadow',
            'text-slate-400',
            'hover:bg-white hover:ring-slate-400',
            'focus:bg-white focus:ring-slate-400',
            'dark:text-zinc-500',
            'dark:hover:bg-zinc-700 dark:hover:ring-zinc-500',
            'dark:focus:bg-zinc-700 dark:focus:ring-zinc-500',
          )}
        >
          <span className="icon-[bi--x] size-5"></span>
        </button>
      )}
    </dialog>
  );
}

function WindowDialog({
  message,
  set = 'default',
  confirmText = 'confirm',
  confirmValue = 'confirm',
  cancelText,
  onConfirm,
  onCancel,
}: WindowDialogProps) {
  return (
    <div
      className={cn(
        'max-w-120 rounded-lg p-8 shadow-md',
        'text-sm',
        'bg-white text-slate-900',
        'dark:bg-zinc-900 dark:text-zinc-100',
      )}
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(confirmValue);
        }}
      >
        <main className="flex items-center gap-4">
          <div className={`inline-flex shrink-0 items-center justify-center rounded-full`}>
            <span
              className={cn(
                'size-6',
                iconClass(set),
                set === 'default'
                  ? ['bg-white', 'dark:bg-zinc-700']
                  : set === 'positive'
                    ? ['bg-green-800 dark:bg-green-300']
                    : set === 'warning'
                      ? ['bg-amber-500 dark:bg-amber-300']
                      : [],
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm whitespace-pre-wrap">{message}</p>
          </div>
        </main>

        <footer className="flex items-center justify-center gap-4">
          <Button type="submit" set={set} variant="text" autoFocus>
            <span className="capitalize">{confirmText}</span>
          </Button>
          {cancelText && (
            <Button type="button" set="default" variant="text" onClick={() => onCancel()}>
              <span className="capitalize">{cancelText}</span>
            </Button>
          )}
        </footer>
      </form>
    </div>
  );
}

function iconClass(set: ColorSet) {
  switch (set) {
    case 'positive':
      return 'icon-[qlementine-icons--success-12]';
    case 'warning':
      return 'icon-[material-symbols--warning-outline-rounded]';
    case 'default':
    default:
      return 'icon-[solar--dialog-line-duotone]';
  }
}
