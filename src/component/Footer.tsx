import { cn } from '~/lib/utils';
import { useStore } from '~/plugin/useStore';

import { Button } from './Button';

export function Footer() {
  const { enablePin, saveEnablePin, theme, saveTheme, page, setPage } = useStore();

  return (
    <div
      className={cn(
        'grid shrink-0 grid-cols-3 items-center justify-center',
        'px-2 py-1.5',
        'border-t-2',
        'border-t-slate-400',
        'dark:border-t-zinc-600',
      )}
    >
      <div className="flex flex-row items-center justify-start gap-2">
        <Button
          title="pin"
          type="button"
          set={enablePin ? 'positive' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            void saveEnablePin(!enablePin);
          }}
        >
          <span className="icon-[mynaui--pin] size-4"></span>
        </Button>

        <div id="portal-footer-left" className="contents"></div>
      </div>

      <div
        id="portal-footer-middle"
        className="flex flex-row items-center justify-center gap-2"
      ></div>

      <div title="page" className="inline-flex items-center justify-end gap-1.5">
        <div id="portal-footer-right" className="contents"></div>

        <Button
          title="theme"
          type="button"
          set="none"
          className={cn(
            theme === 'light'
              ? 'border-amber-500 bg-white text-amber-500'
              : 'border-indigo-600 bg-indigo-900 text-indigo-500',
          )}
          onClick={(e) => {
            e.preventDefault();
            void saveTheme(theme === 'light' ? 'dark' : 'light');
          }}
        >
          <span
            className={cn(
              'size-4',
              theme === 'light'
                ? 'icon-[material-symbols--clear-day-outline-rounded]'
                : 'icon-[material-symbols--mode-night-rounded]',
            )}
          ></span>
        </Button>

        <Button
          title="clipboard"
          type="button"
          set={page === 'clipboard' ? 'default' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            setPage('clipboard');
          }}
        >
          <span className="icon-[solar--clipboard-outline] size-4"></span>
        </Button>
        <Button
          title="setting"
          type="button"
          set={page === 'setting' ? 'default' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            setPage('setting');
          }}
        >
          <span className="icon-[ep--setting] size-4"></span>
        </Button>
        <Button
          title="information"
          type="button"
          set={page === 'information' ? 'default' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            setPage('information');
          }}
        >
          <span className="icon-[mdi--information-outline] size-4"></span>
        </Button>
      </div>
    </div>
  );
}
