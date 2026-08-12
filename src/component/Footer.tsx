import type { ReactNode } from 'react';

import type { useStore } from '~/plugin/useStore';

type FooterProps = ReturnType<typeof useStore> & { children?: ReactNode };

export function Footer(props: FooterProps) {
  return (
    <div className="flex shrink-0 flex-row justify-between gap-8 border-t border-t-gray-300 p-2 dark:border-t-zinc-700">
      <div className="flex flex-row items-center gap-4">
        <div
          title="page"
          className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 bg-gray-100 p-1 transition-colors hover:bg-white focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
        >
          <button
            title="text clipboard"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
              props.page === 'clipboard'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              props.setPage('clipboard');
            }}
          >
            <span className="icon-[solar--clipboard-outline] size-4"></span>
          </button>
          <button
            title="setting"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
              props.page === 'setting'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              props.setPage('setting');
            }}
          >
            <span className="icon-[material-symbols--keyboard-outline] size-4"></span>
          </button>
        </div>

        <div className="flex flex-row items-center gap-2">
          <button
            title="pin"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none ${
              props.enablePin
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              void props.saveEnablePin(!props.enablePin);
            }}
          >
            <span className="icon-[mynaui--pin] size-4"></span>
          </button>
          <div
            title="theme"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 bg-gray-100 p-1 transition-colors hover:bg-white focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
          >
            <button
              title="theme light"
              type="button"
              className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
                props.theme === 'light'
                  ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                  : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                void props.saveTheme('light');
              }}
            >
              <span className="icon-[material-symbols--clear-day-outline-rounded] size-4"></span>
            </button>
            <button
              title="theme dark"
              type="button"
              className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
                props.theme === 'dark'
                  ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                  : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                void props.saveTheme('dark');
              }}
            >
              <span className="icon-[material-symbols--mode-night-outline-rounded] size-4"></span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">{props.children}</div>
    </div>
  );
}
