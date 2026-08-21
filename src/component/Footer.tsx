import type { useStore } from '~/plugin/useStore';

type FooterProps = ReturnType<typeof useStore> & {};

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
            <span className="icon-[ep--setting] size-4"></span>
          </button>
          <button
            title="information"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
              props.page === 'information'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              props.setPage('information');
            }}
          >
            <span className="icon-[mdi--information-outline] size-4"></span>
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
          <button
            title="theme"
            type="button"
            className="relative inline-flex items-center rounded-full border border-gray-300 bg-gray-200 p-1 transition-colors dark:border-zinc-600 dark:bg-zinc-700"
            onClick={(e) => {
              e.stopPropagation();
              void props.saveTheme(props.theme === 'dark' ? 'light' : 'dark');
            }}
          >
            <div
              title="theme light"
              aria-label="theme light"
              aria-pressed={props.theme === 'light'}
              className={`z-10 inline-flex size-6 items-center justify-center rounded-full transition-all focus:outline-none ${
                props.theme === 'light'
                  ? 'bg-white text-amber-500 shadow-sm hover:bg-gray-50 focus:bg-gray-50 dark:bg-zinc-100 dark:text-amber-500 dark:hover:bg-white dark:focus:bg-white'
                  : 'text-gray-500 hover:text-gray-700 focus:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 dark:focus:text-zinc-200'
              }`}
            >
              <span className="icon-[material-symbols--clear-day-outline-rounded] size-4"></span>
            </div>
            <div
              title="theme dark"
              aria-label="theme dark"
              aria-pressed={props.theme === 'dark'}
              className={`z-10 inline-flex size-6 items-center justify-center rounded-full transition-all focus:outline-none ${
                props.theme === 'dark'
                  ? 'bg-white text-indigo-500 shadow-sm hover:bg-gray-50 focus:bg-gray-50 dark:bg-zinc-100 dark:text-indigo-500 dark:hover:bg-white dark:focus:bg-white'
                  : 'text-gray-500 hover:text-gray-700 focus:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 dark:focus:text-zinc-200'
              }`}
            >
              <span className="icon-[material-symbols--mode-night-outline-rounded] size-4"></span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
