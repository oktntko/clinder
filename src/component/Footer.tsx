import type { useStore } from '~/plugin/useStore';

import { cn } from '~/lib/utils';

import { Button } from './Button';
import { ToggleButton } from './ToggleButton';

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
        <ToggleButton
          title="pin"
          type="button"
          isActive={props.enablePin}
          onClick={(e) => {
            e.preventDefault();
            void props.saveEnablePin(!props.enablePin);
          }}
        >
          <span className="icon-[mynaui--pin] size-4"></span>
        </ToggleButton>

        <Button
          title="theme"
          type="button"
          className={cn(
            'rounded-full p-1',
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
      </div>

      <div title="page" className="inline-flex items-center justify-center gap-1.5">
        <ToggleButton
          title="clipboard"
          type="button"
          isActive={props.page === 'clipboard'}
          set="default"
          onClick={(e) => {
            e.preventDefault();
            props.setPage('clipboard');
          }}
        >
          <span className="icon-[solar--clipboard-outline] size-4"></span>
        </ToggleButton>
        <ToggleButton
          title="setting"
          type="button"
          isActive={props.page === 'setting'}
          set="default"
          onClick={(e) => {
            e.preventDefault();
            props.setPage('setting');
          }}
        >
          <span className="icon-[ep--setting] size-4"></span>
        </ToggleButton>
        <ToggleButton
          title="information"
          type="button"
          isActive={props.page === 'information'}
          set="default"
          onClick={(e) => {
            e.preventDefault();
            props.setPage('information');
          }}
        >
          <span className="icon-[mdi--information-outline] size-4"></span>
        </ToggleButton>
      </div>
    </div>
  );
}
