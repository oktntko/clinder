import { useState } from 'react';

import type { useStore } from '~/plugin/useStore';

import invoke from '~/command';
import { Footer } from '~/component/Footer';
import { cn } from '~/lib/utils';
import { useToast } from '~/plugin/useToast';

type SettingProps = ReturnType<typeof useStore> & {};

export function Setting(props: SettingProps) {
  const $toast = useToast();

  return (
    <div className="flex max-h-198 flex-col">
      <div className="mx-auto pt-4 pb-10">
        <div className="py-4 text-lg font-bold">Setting</div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div>
              <label htmlFor="font" className="text-xs capitalize">
                font
              </label>
            </div>
            <div className="ps-2">
              <select
                id="font"
                value={props.font}
                className="w-full rounded-md border border-gray-300 bg-white p-2 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                onChange={(e) => {
                  const newFont = (e.target as HTMLSelectElement).value;
                  void props.saveAndApplyFont(newFont);
                }}
                autoFocus={true}
              >
                <option value="">System Font</option>
                {props.systemFontList.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: `"${font}"` }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form
            className="flex flex-col gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const value = (document.getElementById('window open / hide') as HTMLInputElement)
                .value;

              // TODO: '+' が入力されたときのケア
              const keys = value.split('+');
              if (keys.length <= 1) {
                return $toast.warn(
                  'Please specify a modifier key (Ctrl, Alt, Shift, or Command) along with the main key.',
                );
              }

              try {
                await invoke.update_window_toggle_shortcut(value);
                return $toast.success('Shortcut updated successfully.');
              } catch (err) {
                console.error('Failed to update window toggle shortcut:', err);
                return $toast.danger('Failed to update shortcut. Please try again.');
              }
            }}
          >
            <div>
              <label htmlFor="window open / hide" className="text-xs capitalize">
                window open / hide
              </label>
            </div>
            <div className="flex flex-row items-center gap-2 ps-2">
              <div className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-100 p-2 dark:border-zinc-600 dark:bg-zinc-700">
                <span>{props.windowToggleShortcut}</span>
              </div>
              <div className="inline-flex items-center justify-center rounded-full p-1">
                <span className="icon-[mingcute--arrow-right-fill] size-4 animate-pulse"></span>
              </div>
              <ShortcutInput
                id="window open / hide"
                default={props.windowToggleShortcut}
                className="rounded-md border border-gray-300 bg-white p-2 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                required
              />
              <button
                type="submit"
                className="inline-flex items-center rounded bg-gray-200 p-2 transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
              >
                <span className="icon-[material-symbols--check-rounded] size-4"></span>
              </button>
            </div>
          </form>

          <div className="flex flex-col gap-1">
            <div>
              <label className="text-xs capitalize">select action</label>
            </div>
            <div className="grid grid-cols-2 gap-2 ps-2">
              <div className="py-2 capitalize">send clipboard and paste</div>
              <div className="text-center">
                <div className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-100 p-2 dark:border-zinc-600 dark:bg-zinc-700">
                  {props.selectAction === 'send-and-paste' ? 'Enter' : ' Ctrl + Enter'}
                </div>
              </div>
              <div className="col-start-2 text-center">
                <button
                  title="select action"
                  type="button"
                  className={cn(
                    `inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none`,
                    'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    void props.saveSelectAction(
                      props.selectAction === 'send-and-paste' ? 'send-only' : 'send-and-paste',
                    );
                  }}
                >
                  <span className="icon-[proicons--arrow-sort] size-4"></span>
                </button>
              </div>
              <div className="py-2 capitalize">send clipboard only</div>
              <div className="text-center">
                <div className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-100 p-2 dark:border-zinc-600 dark:bg-zinc-700">
                  {props.selectAction !== 'send-and-paste' ? 'Enter' : ' Ctrl + Enter'}
                </div>
              </div>
            </div>
          </div>

          <form
            className="flex flex-col gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const value = (document.getElementById('history size') as HTMLInputElement).value;

              await props.saveHistorySize(Number(value));
              return $toast.success('History Size updated successfully.');
            }}
          >
            <div>
              <label htmlFor="history size" className="text-xs capitalize">
                history size
              </label>
            </div>
            <div className="flex flex-row items-center gap-2 ps-2">
              <input
                id="history size"
                type="number"
                defaultValue={props.historySize}
                className="rounded-md border border-gray-300 bg-white p-2 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                required
              />
              <button
                type="submit"
                className="inline-flex items-center rounded bg-gray-200 p-2 transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
              >
                <span className="icon-[material-symbols--check-rounded] size-4"></span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer {...props}></Footer>
    </div>
  );
}

function ShortcutInput(props: React.InputHTMLAttributes<HTMLInputElement> & { default: string }) {
  const [value, setValue] = useState(props.default);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'Tab'
    ) {
      return;
    }

    e.preventDefault();

    // 修飾キー単体押しは無視
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }

    const keys: string[] = [];
    if (e.ctrlKey || e.metaKey) {
      keys.push('Control'); // CommandOrControl を統一して 'Control' とする
    }
    if (e.altKey) {
      keys.push('Alt');
    }
    if (e.shiftKey) {
      keys.push('Shift');
    }

    // キー名の正規化（例: 'v' -> 'V'）
    const mainKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    keys.push(mainKey);

    const newShortcut = keys.join('+');

    setValue(newShortcut);
  }

  return <input {...props} type="text" readOnly value={value} onKeyDown={handleKeyDown} />;
}
