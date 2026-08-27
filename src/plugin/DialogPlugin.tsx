import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { Button } from '~/component/Button';
import { cn } from '~/lib/utils';

import {
  DialogContext,
  type ColorSet,
  type ReactComponent,
  type WindowDialogOptions,
  type WindowDialogProps,
} from './dialogContext';

// --- WindowDialog Component ---
function WindowDialog({
  message,
  set = 'default',
  confirmText = 'confirm',
  confirmValue = 'confirm',
  cancelText,
  onConfirm,
  onCancel,
}: WindowDialogProps) {
  useEffect(() => {
    function closeDialog(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation(); // App.tsx の hideWindow に突き抜けないようにする
      }
    }

    window.addEventListener('keydown', closeDialog, true);

    return () => {
      window.removeEventListener('keydown', closeDialog, true);
    };
  });

  return (
    <div
      className={cn(
        'max-w-80 rounded-lg p-8 shadow-md',
        'text-sm',
        'bg-slate-100 text-slate-900',
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
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}>
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

// --- Helper Functions ---
function createDialogElement(
  closedby: 'any' | 'closerequest' | 'none' = 'any',
  anchor?: HTMLElement,
) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('closedby', closedby);
  dialog.className = `
    m-auto overflow-visible bg-transparent outline-hidden
    transition transition-discrete duration-200 ease-out
    scale-95 opacity-0
    starting:[[open]]:scale-95 starting:[[open]]:opacity-0
    [[open]]:scale-100 [[open]]:opacity-100
    backdrop:bg-gray-500/20
    ${anchor ? 'backdrop:backdrop-grayscale-xs' : 'backdrop:backdrop-blur-xs'}
    backdrop:transition backdrop:transition-discrete backdrop:duration-200 backdrop:ease-out
    backdrop:opacity-0
    starting:[[open]]:backdrop:opacity-0
    [[open]]:backdrop:opacity-100
  `;
  return dialog;
}

function createCloseButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `
    absolute top-1 right-1 size-6 cursor-pointer transition
    inline-flex items-center justify-center
    rounded-full outline-none hover:ring-1 focus:ring-2
    bg-transparent shadow
    text-slate-400
    hover:bg-white hover:ring-slate-400
    focus:bg-white focus:ring-slate-400
    dark:text-zinc-500
    dark:hover:bg-zinc-700 dark:hover:ring-zinc-500
    dark:focus:bg-zinc-700 dark:focus:ring-zinc-500
  `;
  button.setAttribute('aria-label', 'Close');
  button.innerHTML = `<span class="icon-[bi--x] h-6 w-6"></span>`;
  return button;
}

// --- Core Plugin Core Logic ---
function createDialogPlugin() {
  async function showModal<T, C extends ReactComponent>(
    Component: C,
    $props?: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void,
    ) => ComponentProps<C>,
    {
      closedby = 'any',
      showCloseButton = true,
      anchor,
      anchorChildHeight,
    }: {
      closedby?: 'any' | 'closerequest' | 'none';
      showCloseButton?: boolean;
      anchor?: HTMLElement;
      anchorChildHeight?: number;
    } = {},
  ) {
    const dialog = createDialogElement(closedby, anchor);

    if (showCloseButton) {
      const closeButton = createCloseButton();
      dialog.appendChild(closeButton);
      closeButton.addEventListener('click', () => {
        dialog.close('cancel');
      });
    }

    return new Promise<T>((resolve, reject) => {
      const container = document.createElement('div');
      dialog.appendChild(container);
      const root = createRoot(container);

      const trapResolve = (value: T | PromiseLike<T>) => {
        dialog.close('cancel');
        resolve(value);
      };

      const trapReject = (reason?: unknown) => {
        dialog.close('cancel');
        reject(reason);
      };

      const componentProps = $props ? $props(trapResolve, trapReject) : ({} as ComponentProps<C>);

      const handleClose = () => {
        const timerId = setTimeout(() => {
          root.unmount();
          document.body.removeChild(dialog);
        }, 250);

        dialog.addEventListener(
          'transitionend',
          (e) => {
            if (e.target === dialog) {
              clearTimeout(timerId);
              root.unmount();
              document.body.removeChild(dialog);
            }
          },
          { once: true },
        );

        reject(dialog.returnValue || 'cancel');
      };

      dialog.addEventListener('close', handleClose, { once: true });

      if (anchor) {
        dialog.style.margin = '0'; // マージで中の要素を中央寄せしているので消す
        dialog.style.insetInlineStart = 'unset'; // 消すと right: が効くようになる
        dialog.style.insetBlockStart = 'unset'; // 消すと bottom: が効くようになる
        dialog.style.position = 'fixed';
        dialog.style.right = 'calc(4px + var(--spacing) * 1.5)'; // scrollbar 分

        const rect = anchor.getBoundingClientRect();
        const spaceBelow = window.innerHeight + anchor.clientHeight - rect.bottom;

        if (spaceBelow >= (anchorChildHeight ?? 300)) {
          dialog.style.top = `${rect.top}px`;
        } else {
          dialog.style.bottom = `${window.innerHeight - rect.bottom}px`;
        }
      }

      root.render(<Component {...componentProps} />);

      document.body.appendChild(dialog);
      dialog.showModal();
    });
  }

  async function showWindowDialog<T extends string>(
    message: string,
    options?: WindowDialogOptions,
  ) {
    return showModal<T, typeof WindowDialog>(WindowDialog, (resolve, reject) => ({
      message,
      ...options,
      onConfirm: (value) => resolve(value as T),
      onCancel: reject,
    }));
  }

  return {
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
  };
}

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogPlugin] = useState(() => createDialogPlugin());

  return <DialogContext.Provider value={dialogPlugin}>{children}</DialogContext.Provider>;
}
