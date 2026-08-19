import { useEffect, useState, type ReactNode } from 'react';

import invoke from '~/command';
import { Footer } from '~/component/Footer';
import { useDialog } from '~/plugin/useDialog';
import {
  defaultGlobalShortcutToggleWindow,
  defaultShortcutDeleteClip,
  defaultShortcutSendAndPaste,
  defaultShortcutSendClipboard,
  defaultShortcutToggleClipBookmark,
  defaultShortcutToggleSearchBookmark,
  defaultShortcutToggleSearchContentTypeImage,
  defaultShortcutToggleSearchContentTypeText,
  defaultShortcutToggleSearchMode,
  type Shortcut,
  type useStore,
} from '~/plugin/useStore';
import { useToast } from '~/plugin/useToast';

type SettingProps = ReturnType<typeof useStore> & {};

export function Setting(props: SettingProps) {
  const $toast = useToast();
  const $dialog = useDialog();

  return (
    <div className="flex max-h-198 flex-col">
      <div className="flex flex-col gap-8 overflow-y-auto px-12 py-8 focus:outline-none">
        <div className="text-lg font-bold text-gray-700 capitalize dark:text-zinc-300">setting</div>

        <section className="flex flex-col gap-2">
          <div className="text-base font-semibold text-gray-700 capitalize dark:text-zinc-300">
            appearance & behavior
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="font" className="text-xs capitalize">
                  font
                </label>
              </div>
              <div>
                <input
                  id="font"
                  type="text"
                  list="systemFontList"
                  defaultValue={props.font}
                  className="rounded-md border border-gray-300 bg-white p-2 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  onChange={(e) => {
                    const newFont = e.target.value;
                    if (newFont === '' || props.systemFontList.includes(newFont)) {
                      void props.saveAndApplyFont(newFont);
                    }
                  }}
                />
                <datalist id="systemFontList">
                  {props.systemFontList.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: `"${font}"` }}>
                      {font}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            <form
              className="flex flex-col gap-0.5"
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
                  history size (0 = unlimited)
                </label>
                <div className="text-[8px]">
                  Max history items to keep. Older items are deleted on startup and daily when
                  exceeding the limit.
                </div>
              </div>
              <div className="flex flex-row items-center gap-2">
                <input
                  id="history size"
                  type="number"
                  min={0}
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
        </section>

        <section className="flex flex-col gap-2">
          <div className="text-base font-semibold text-gray-700 capitalize dark:text-zinc-300">
            Keybindings
          </div>
          <div className="flex flex-col gap-2">
            {[
              {
                title: 'toggle window open / close',
                shortcut: props.globalShortcutToggleWindow,
                save: async (shortcut: Shortcut) => {
                  if (
                    !shortcut.ctrlKey &&
                    !shortcut.shiftKey &&
                    !shortcut.metaKey &&
                    !shortcut.altKey
                  ) {
                    throw () =>
                      $toast.warn(
                        'Please specify a modifier key (Ctrl, Alt, Shift, or Command) along with the main key.',
                      );
                  }

                  return invoke
                    .update_global_shortcut_toggle_window(shortcut)
                    .then(() => props.setGlobalShortcutToggleWindow(shortcut));
                },
                default: defaultGlobalShortcutToggleWindow,
              },
              {
                title: 'send and paste',
                shortcut: props.shortcutSendAndPaste,
                save: props.saveShortcutSendAndPaste,
                default: defaultShortcutSendAndPaste,
              },
              {
                title: 'send clipboard',
                shortcut: props.shortcutSendClipboard,
                save: props.saveShortcutSendClipboard,
                default: defaultShortcutSendClipboard,
              },
              {
                title: 'delete clip',
                shortcut: props.shortcutDeleteClip,
                save: props.saveShortcutDeleteClip,
                default: defaultShortcutDeleteClip,
              },
              {
                title: 'toggle clip bookmark',
                shortcut: props.shortcutToggleClipBookmark,
                save: props.saveShortcutToggleClipBookmark,
                default: defaultShortcutToggleClipBookmark,
              },
              {
                title: 'toggle search content type "text"',
                shortcut: props.shortcutToggleSearchContentTypeText,
                save: props.saveShortcutToggleSearchContentTypeText,
                default: defaultShortcutToggleSearchContentTypeText,
              },
              {
                title: 'toggle search content type "image"',
                shortcut: props.shortcutToggleSearchContentTypeImage,
                save: props.saveShortcutToggleSearchContentTypeImage,
                default: defaultShortcutToggleSearchContentTypeImage,
              },
              {
                title: 'toggle search bookmark (bookmark only / all)',
                shortcut: props.shortcutToggleSearchBookmark,
                save: props.saveShortcutToggleSearchBookmark,
                default: defaultShortcutToggleSearchBookmark,
              },
              {
                title: 'toggle search mode (fuzzy / exact)',
                shortcut: props.shortcutToggleSearchMode,
                save: props.saveShortcutToggleSearchMode,
                default: defaultShortcutToggleSearchMode,
              },
            ].map((x, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div>
                  <label className="text-xs capitalize">{x.title}</label>
                </div>
                <div className="flex flex-row items-center gap-2">
                  <ShortcutKey {...x.shortcut} />
                  <button
                    title="save"
                    type="button"
                    className="inline-flex items-center rounded bg-gray-200 p-2 transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
                    onClick={async () => {
                      const newShortcut: Shortcut = await $dialog.showModal(
                        EditShortcutDialog,
                        (resolve, reject) => ({
                          title: x.title,
                          initValue: x.shortcut,
                          onSave: (v) => resolve(v),
                          onCancel: () => reject(),
                        }),
                      );

                      try {
                        await x.save(newShortcut);
                        $toast.success('Shortcut updated successfully.');
                      } catch (err) {
                        if (typeof err === 'function') {
                          err();
                        } else {
                          console.error('Failed to update shortcut:', err);
                          $toast.danger('Failed to update shortcut. Please try again.');
                        }
                      }
                    }}
                  >
                    <span className="icon-[mage--edit] size-4"></span>
                  </button>
                  <button
                    title="reset"
                    type="button"
                    className="inline-flex items-center rounded bg-gray-200 p-2 transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
                    onClick={async () => {
                      try {
                        await x.save(x.default);
                        $toast.success('Shortcut updated successfully.');
                      } catch (err) {
                        if (typeof err === 'function') {
                          err();
                        } else {
                          console.error('Failed to update shortcut:', err);
                          $toast.danger('Failed to update shortcut. Please try again.');
                        }
                      }
                    }}
                  >
                    <span className="icon-[system-uicons--reset] size-4"></span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer {...props}></Footer>
    </div>
  );
}

function EditShortcutDialog(props: {
  title: string;
  initValue: Shortcut;
  onSave: (shortcut: Shortcut) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initValue);

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
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-base font-semibold text-gray-700 capitalize dark:text-zinc-300">
            {props.title}
          </div>
          <div className="text-sm text-gray-700 capitalize dark:text-zinc-300">
            Press the shortcut key you want to use.
          </div>
        </div>
        <button
          type="button"
          autoFocus
          className="flex flex-row items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-gray-200 py-6 transition outline-none hover:bg-gray-300 hover:ring-2 hover:ring-gray-400 focus:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:hover:ring-zinc-300 dark:focus:bg-zinc-600 dark:focus:ring-zinc-300"
          onKeyDown={(e) => {
            if (['Tab', 'Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
              return;
            }

            e.preventDefault();

            setValue({
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              altKey: e.altKey,
              metaKey: e.metaKey,
              code: e.code,
            });
          }}
        >
          <ShortcutKey {...value} />
        </button>
        <section className="flex flex-row items-center justify-center gap-4">
          <button
            type="button"
            className="inline-flex w-24 items-center justify-center rounded-lg border-2 border-green-300 bg-green-200 px-4 py-2 capitalize shadow transition-colors hover:bg-green-300 focus:bg-green-300 focus:outline-none dark:border-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80"
            onClick={() => props.onSave(value)}
          >
            save
          </button>
          <button
            type="button"
            className="inline-flex w-24 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-200 px-4 py-2 capitalize shadow transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
            onClick={() => props.onCancel()}
          >
            cancel
          </button>
        </section>
      </div>
    </div>
  );
}

function ShortcutKey(shortcut: Shortcut) {
  return (
    <div className="inline-flex flex-row gap-1 pb-1">
      {shortcut.metaKey && <Key>win</Key>}
      {shortcut.altKey && <Key>alt</Key>}
      {shortcut.ctrlKey && <Key>ctrl</Key>}
      {shortcut.shiftKey && <Key>shift</Key>}
      {shortcut.code && (
        <Key>{shortcut.code.startsWith('Key') ? shortcut.code.substring(3) : shortcut.code}</Key>
      )}
    </div>
  );
}

function Key(props: { children: ReactNode }) {
  return (
    <kbd className="inline-block min-w-9 cursor-default rounded-md border border-gray-300 bg-white px-3 py-1.5 text-center text-sm font-bold text-gray-800 capitalize shadow-[0_4px_0_#b1b1b1,0_5px_0_#999,0_5px_3px_rgba(0,0,0,0.3)]">
      {props.children}
    </kbd>
  );
}
