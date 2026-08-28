import type { useStore } from '~/plugin/useStore';

import { cn } from '~/lib/utils';

import { Button } from './Button';

type FooterProps = ReturnType<typeof useStore> & {};

export function Footer(props: FooterProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-row justify-between',
        'px-2 py-1.5',
        'border-t-2',
        'border-t-slate-400',
        'dark:border-t-zinc-600',
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <Button
          title="pin"
          type="button"
          set={props.enablePin ? 'positive' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            void props.saveEnablePin(!props.enablePin);
          }}
        >
          <span className="icon-[mynaui--pin] size-4"></span>
        </Button>

        <Button
          title="theme"
          type="button"
          set="none"
          className={cn(
            props.theme === 'light'
              ? 'border-amber-500 bg-white text-amber-500'
              : 'border-indigo-600 bg-indigo-900 text-indigo-500',
          )}
          onClick={(e) => {
            e.preventDefault();
            void props.saveTheme(props.theme === 'light' ? 'dark' : 'light');
          }}
        >
          <span
            className={cn(
              'size-4',
              props.theme === 'light'
                ? 'icon-[material-symbols--clear-day-outline-rounded]'
                : 'icon-[material-symbols--mode-night-rounded]',
            )}
          ></span>
        </Button>

        <div id="portal-footer-left" className="contents"></div>
      </div>

      <div id="portal-footer-middle" className="flex flex-row items-center gap-2"></div>

      <div title="page" className="inline-flex items-center justify-center gap-1.5">
        <div id="portal-footer-right" className="contents"></div>

        <Button
          title="clipboard"
          type="button"
          set={props.page === 'clipboard' ? 'default' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            props.setPage('clipboard');
          }}
        >
          <span className="icon-[solar--clipboard-outline] size-4"></span>
        </Button>
        <Button
          title="setting"
          type="button"
          set={props.page === 'setting' ? 'default' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            props.setPage('setting');
          }}
        >
          <span className="icon-[ep--setting] size-4"></span>
        </Button>
        <Button
          title="information"
          type="button"
          set={props.page === 'information' ? 'default' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            props.setPage('information');
          }}
        >
          <span className="icon-[mdi--information-outline] size-4"></span>
        </Button>
      </div>
    </div>
  );
}
