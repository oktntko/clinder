import React, { Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  DialogContext,
  type ColorType,
  type ReactComponent,
  type WindowDialogOptions,
  type WindowDialogProps,
} from './dialogContext';

// --- WindowDialog Component ---
function WindowDialog({
  message,
  color = 'white',
  confirmText = 'confirm',
  confirmValue = 'confirm',
  cancelText,
  prompt,
  onConfirm,
  onCancel,
}: WindowDialogProps) {
  const [modelValue, setModelValue] = useState('');

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
    <div className="rounded-lg bg-white p-8 text-sm text-gray-900 shadow-md dark:bg-zinc-900 dark:text-zinc-100">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(prompt ? `confirm:${modelValue}` : confirmValue);
        }}
      >
        <main className="flex items-center gap-4">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass(color)}`}
          >
            <span className={`${iconClass(color)} h-6 w-6`} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm whitespace-pre-wrap">{message}</p>
            {prompt && (
              <input
                type="text"
                value={modelValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelValue(e.target.value)}
                className="w-full"
                autoFocus
                required
                {...prompt}
              />
            )}
          </div>
        </main>

        <footer className="flex items-center justify-center gap-4">
          <button
            type="submit"
            autoFocus
            className={`inline-flex w-24 items-center justify-center rounded-lg border-2 px-4 py-2 capitalize shadow transition-colors ${colorClass(color)}`}
          >
            <span className="capitalize">{confirmText}</span>
          </button>
          {cancelText && (
            <button
              type="button"
              color="white"
              className="inline-flex w-24 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-200 px-4 py-2 capitalize shadow transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
              onClick={() => onCancel()}
            >
              <span className="capitalize">{cancelText}</span>
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

function iconClass(color: ColorType) {
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
}

function colorClass(color: ColorType) {
  switch (color) {
    case 'white':
      return 'bg-gray-100 text-gray-400';
    case 'gray':
      return 'bg-gray-100 text-gray-800';
    case 'green':
      return 'bg-green-100 text-green-800';
    case 'red':
      return 'bg-red-100 text-red-800';
    case 'blue':
      return 'bg-blue-100 text-blue-800';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-400';
  }
}

// --- Loading Component ---
function LoadingFallback() {
  return (
    <div className="flex flex-col items-center bg-transparent p-8">
      <span className="icon-[eos-icons--bubble-loading] text-opacity-60 h-16 w-16 text-gray-600" />
      <span className="sr-only">Loading...</span>
      <input
        autoFocus
        name="loading"
        className="h-0 w-0 border-none bg-transparent caret-transparent outline-hidden"
      />
    </div>
  );
}

// --- Error Boundary ---
class DialogErrorBoundary extends React.Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_: unknown) {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// --- Helper Functions ---
function createDialogElement(closedby: 'any' | 'closerequest' | 'none' = 'any') {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('closedby', closedby);
  dialog.className = `
    m-auto overflow-visible bg-transparent outline-hidden
    transition transition-discrete duration-200 ease-out
    scale-95 opacity-0
    starting:[[open]]:scale-95 starting:[[open]]:opacity-0
    [[open]]:scale-100 [[open]]:opacity-100
    backdrop:bg-gray-500/20 backdrop:backdrop-blur-xs
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
    absolute top-1 right-1 h-6 w-6 cursor-pointer rounded-full transition shadow
    disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-100 disabled:hover:bg-gray-400 disabled:hover:text-gray-200 disabled:hover:ring-gray-300 disabled:focus:ring-gray-300
    dark:disabled:border-gray-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-500
    hover:ring-2 focus:ring-2 focus:outline-none outline-none
    bg-transparent text-gray-400 hover:bg-gray-50 hover:ring-gray-300 focus:ring-gray-300
    dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 dark:hover:ring-gray-600 dark:focus:ring-gray-600
  `;
  button.setAttribute('aria-label', 'Close');
  button.innerHTML = `<span class="icon-[bi--x] h-6 w-6"></span>`;
  return button;
}

// --- Core Plugin Core Logic ---
function createDialogPlugin() {
  async function showModal<T, C extends ReactComponent>(
    Component: C,
    getProps?: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: unknown) => void,
    ) => ComponentProps<C>,
    {
      closedby = 'any',
      showCloseButton = true,
    }: {
      closedby?: 'any' | 'closerequest' | 'none';
      showCloseButton?: boolean;
    } = {},
  ) {
    const dialog = createDialogElement(closedby);

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

      const componentProps = getProps
        ? getProps(trapResolve, trapReject)
        : ({} as ComponentProps<C>);

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

      root.render(
        <DialogErrorBoundary onError={() => dialog.close('cancel')}>
          <Suspense fallback={<LoadingFallback />}>
            <Component {...componentProps} />
          </Suspense>
        </DialogErrorBoundary>,
      );

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
      type O = Pick<WindowDialogOptions, 'color' | 'confirmText'>;
      return {
        async open(message: string, { confirmText = 'OK', ...options }: O = {}) {
          return showWindowDialog<'confirm' | 'cancel'>(message, { confirmText, ...options });
        },
        async success(message: string, { color = 'green', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async info(message: string, { color = 'blue', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async warn(message: string, { color = 'yellow', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async danger(message: string, { color = 'red', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
      };
    },

    get confirm() {
      type O = Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText'>;
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
        async success(message: string, { color = 'green', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async info(message: string, { color = 'blue', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async warn(message: string, { color = 'yellow', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async danger(message: string, { color = 'red', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
      };
    },

    get prompt() {
      type O = Pick<WindowDialogOptions, 'color' | 'confirmText' | 'cancelText' | 'prompt'>;
      return {
        async open(
          message: string,
          {
            confirmText = 'confirm',
            cancelText = 'cancel',
            prompt = { type: 'text' },
            ...options
          }: O = {},
        ) {
          return showWindowDialog<`confirm:${string}` | 'cancel'>(message, {
            confirmText,
            cancelText,
            prompt,
            ...options,
          });
        },
        async success(message: string, { color = 'green', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async info(message: string, { color = 'blue', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async warn(message: string, { color = 'yellow', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
        async danger(message: string, { color = 'red', ...options }: O = {}) {
          return this.open(message, { color, ...options });
        },
      };
    },

    loading() {
      const dialog = createDialogElement('none');

      dialog.addEventListener('close', () => {
        const timerId = setTimeout(() => {
          document.body.removeChild(dialog);
        }, 250);

        dialog.addEventListener(
          'transitionend',
          (e) => {
            if (e.target === dialog) {
              clearTimeout(timerId);
              document.body.removeChild(dialog);
            }
          },
          { once: true },
        );
      });

      dialog.insertAdjacentHTML(
        'beforeend',
        `
<div className="flex flex-col items-center bg-transparent p-8">
  <span className="icon-[eos-icons--bubble-loading] text-opacity-60 h-16 w-16 text-gray-600"></span>
  <span className="sr-only">Loading...</span>
  <input
    autofocus
    name="loading"
    className="h-0 w-0 border-none bg-transparent caret-transparent outline-hidden"
  />
</div>`,
      );

      document.body.appendChild(dialog);
      dialog.showModal();

      return {
        close: () => dialog.close('cancel'),
      };
    },
  };
}

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogPlugin] = useState(() => createDialogPlugin());

  return <DialogContext.Provider value={dialogPlugin}>{children}</DialogContext.Provider>;
}
