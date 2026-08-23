import { useEffect, useState, type ReactNode } from 'react';

import invoke from '~/command';
import { Button } from '~/component/Button';
import { Checkbox } from '~/component/Checkbox';
import { Input } from '~/component/Input';
import { cn } from '~/lib/utils';
import { useDialog } from '~/plugin/useDialog';
import {
  defaultFont,
  defaultGlobalShortcutToggleWindow,
  defaultHistorySize,
  defaultMaxHeight,
  defaultMaxItems,
  defaultMinHeight,
  defaultShortcutDeleteClip,
  defaultShortcutSendAndPaste,
  defaultShortcutSendClipboard,
  defaultShortcutToggleClipBookmark,
  defaultShortcutToggleSearchBookmark,
  defaultShortcutToggleSearchContentTypeFiles,
  defaultShortcutToggleSearchContentTypeImage,
  defaultShortcutToggleSearchContentTypeText,
  defaultShortcutToggleSearchMode,
  matchShortcut,
  type Shortcut,
  type useStore,
} from '~/plugin/useStore';
import { useToast } from '~/plugin/useToast';

type SettingProps = ReturnType<typeof useStore> & {};

export function Setting(props: SettingProps) {
  const $toast = useToast();
  const $dialog = useDialog();

  return (
    <>
      <div className="flex flex-col gap-8 overflow-y-auto px-12 py-8 focus:outline-none">
        <div className="text-lg font-bold capitalize">setting</div>

        <section className="flex flex-col gap-2">
          <div className="text-base font-semibold capitalize">appearance</div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="font" className="text-xs capitalize">
                  font
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Input
                  id="font"
                  type="text"
                  list="systemFontList"
                  defaultValue={props.font}
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
                <Button
                  title="reset"
                  type="button"
                  set="default"
                  onClick={async () => {
                    await props.saveAndApplyFont(defaultFont);

                    const input = document.getElementById('font') as HTMLInputElement;
                    input.value = `${defaultFont}`;
                  }}
                >
                  <span className="icon-[system-uicons--reset] size-4"></span>
                </Button>
              </div>
            </div>
            <form
              className="flex flex-col gap-0.5"
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const value = (document.getElementById('min height') as HTMLInputElement).value;

                await props.saveMinHeight(Number(value));
                return $toast.success('Min Height updated successfully.');
              }}
            >
              <div>
                <label htmlFor="min height" className="text-xs capitalize">
                  min height (min: 100px)
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Input
                  id="min height"
                  type="number"
                  min={100}
                  defaultValue={props.minHeight}
                  required
                />
                <Button type="submit" set="default">
                  <span className="icon-[material-symbols--check-rounded] size-4"></span>
                </Button>
                <Button
                  title="reset"
                  type="button"
                  set="default"
                  onClick={async () => {
                    await props.saveMinHeight(defaultMinHeight);

                    const input = document.getElementById('min height') as HTMLInputElement;
                    input.value = `${defaultMinHeight}`;

                    return $toast.success('Min Height updated successfully.');
                  }}
                >
                  <span className="icon-[system-uicons--reset] size-4"></span>
                </Button>
              </div>
            </form>

            <form
              className="flex flex-col gap-0.5"
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const value = (document.getElementById('max height') as HTMLInputElement).value;

                await props.saveMaxHeight(Number(value));
                return $toast.success('Max Height updated successfully.');
              }}
            >
              <div>
                <label htmlFor="max height" className="text-xs capitalize">
                  max height (min: 150px)
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Input
                  id="max height"
                  type="number"
                  min={150}
                  defaultValue={props.maxHeight}
                  required
                />
                <Button type="submit" set="default">
                  <span className="icon-[material-symbols--check-rounded] size-4"></span>
                </Button>
                <Button
                  title="reset"
                  type="button"
                  set="default"
                  onClick={async () => {
                    await props.saveMaxHeight(defaultMaxHeight);

                    const input = document.getElementById('max height') as HTMLInputElement;
                    input.value = `${defaultMaxHeight}`;

                    return $toast.success('Max Height updated successfully.');
                  }}
                >
                  <span className="icon-[system-uicons--reset] size-4"></span>
                </Button>
              </div>
            </form>

            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="wrap text automatically" className="text-xs capitalize">
                  wrap text automatically
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="wrap text automatically"
                  checked={props.wrapTextAutomatically}
                  onChange={async (e) => {
                    await props.saveWrapTextAutomatically(e.target.checked);

                    return $toast.success('Wrap Text Automatically updated successfully.');
                  }}
                >
                  enabled
                </Checkbox>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="text-base font-semibold capitalize">behavior</div>
          <div className="flex flex-col gap-2">
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
                <Input
                  id="history size"
                  type="number"
                  min={0}
                  defaultValue={props.historySize}
                  required
                />
                <Button type="submit" set="default">
                  <span className="icon-[material-symbols--check-rounded] size-4"></span>
                </Button>
                <Button
                  title="reset"
                  type="button"
                  set="default"
                  onClick={async () => {
                    await props.saveHistorySize(defaultHistorySize);

                    const input = document.getElementById('history size') as HTMLInputElement;
                    input.value = `${defaultHistorySize}`;

                    return $toast.success('History Size updated successfully.');
                  }}
                >
                  <span className="icon-[system-uicons--reset] size-4"></span>
                </Button>
              </div>
            </form>

            <form
              className="flex flex-col gap-0.5"
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const value = (document.getElementById('max items') as HTMLInputElement).value;

                await props.saveMaxItems(Number(value));
                return $toast.success('Max Items updated successfully.');
              }}
            >
              <div>
                <label htmlFor="max items" className="text-xs capitalize">
                  max items (min: 10, max: 100)
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Input
                  id="max items"
                  type="number"
                  min={10}
                  max={100}
                  defaultValue={props.maxItems}
                  required
                />
                <Button type="submit" set="default">
                  <span className="icon-[material-symbols--check-rounded] size-4"></span>
                </Button>
                <Button
                  title="reset"
                  type="button"
                  set="default"
                  onClick={async () => {
                    await props.saveMaxItems(defaultMaxItems);

                    const input = document.getElementById('max items') as HTMLInputElement;
                    input.value = `${defaultMaxItems}`;

                    return $toast.success('Max Items updated successfully.');
                  }}
                >
                  <span className="icon-[system-uicons--reset] size-4"></span>
                </Button>
              </div>
            </form>

            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="trim final newlines" className="text-xs capitalize">
                  trim final newlines (requires restart)
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="trim final newlines"
                  checked={props.trimFinalNewlines}
                  onChange={async (e) => {
                    await props.saveTrimFinalNewlines(e.target.checked);

                    await $dialog.confirm.success(
                      'Trim Final Newlines updated successfully. Do you want to restart now?',
                    );

                    return invoke.restart_app();
                  }}
                >
                  enabled
                </Checkbox>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="text-base font-semibold capitalize">Keybindings</div>
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
                title: 'toggle search content type "files"',
                shortcut: props.shortcutToggleSearchContentTypeFiles,
                save: props.saveShortcutToggleSearchContentTypeFiles,
                default: defaultShortcutToggleSearchContentTypeFiles,
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
            ].map((x, i, arr) => {
              const duplicate = arr
                .filter((_, ii) => ii !== i)
                .some((y) => matchShortcut(x.shortcut, y.shortcut));
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <div>
                    <label className="text-xs capitalize">{x.title}</label>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <ShortcutKey shortcut={x.shortcut} duplicate={duplicate} />
                    <Button
                      title="save"
                      type="button"
                      set="default"
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
                    </Button>
                    <Button
                      title="reset"
                      type="button"
                      set="default"
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
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="text-base font-semibold capitalize">Danger Zone</div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <div>
                <label className="text-xs capitalize">clear clipboard</label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Button
                  type="button"
                  set="warning"
                  className="min-w-24 font-bold"
                  onClick={async () => {
                    await $dialog.confirm.warn(
                      'Are you sure you want to clear all clipboard history?',
                    );
                    await invoke.clear_clipboard();
                    return $toast.success('Clipboard history cleared!');
                  }}
                >
                  clear
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
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
    <div
      className={cn(
        'rounded-lg p-8 shadow-md',
        'text-sm',
        'bg-gray-200 text-gray-900',
        'dark:bg-zinc-900 dark:text-zinc-100',
      )}
    >
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-base font-semibold capitalize">{props.title}</div>
          <div className="text-sm text-gray-700 dark:text-zinc-300">
            Press the shortcut key you want to use.
          </div>
        </div>
        <Button
          type="button"
          set="default"
          autoFocus
          className="flex rounded-2xl border-2 p-6"
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
          <ShortcutKey shortcut={value} />
        </Button>
        <section className="flex flex-row items-center justify-center gap-4">
          <Button
            type="button"
            set="positive"
            className="min-w-24 font-bold"
            onClick={() => props.onSave(value)}
          >
            save
          </Button>
          <Button
            type="button"
            set="default"
            className="min-w-24 font-bold"
            onClick={() => props.onCancel()}
          >
            cancel
          </Button>
        </section>
      </div>
    </div>
  );
}

function ShortcutKey({ shortcut, duplicate }: { shortcut: Shortcut; duplicate?: boolean }) {
  return (
    <div className="inline-flex flex-row gap-1 pb-1">
      {shortcut.metaKey /*   */ && <Key duplicate={duplicate}>win</Key>}
      {shortcut.altKey /*    */ && <Key duplicate={duplicate}>alt</Key>}
      {shortcut.ctrlKey /*   */ && <Key duplicate={duplicate}>ctrl</Key>}
      {shortcut.shiftKey /*  */ && <Key duplicate={duplicate}>shift</Key>}
      {shortcut.code && (
        <Key duplicate={duplicate}>
          {shortcut.code.startsWith('Key') ? shortcut.code.substring(3) : shortcut.code}
        </Key>
      )}
    </div>
  );
}

function Key(props: { children: ReactNode; duplicate?: boolean }) {
  return (
    <kbd
      className={cn(
        `inline-block min-w-9 cursor-default rounded-md border bg-white px-3 py-1.5 text-center text-sm font-bold text-gray-700 capitalize select-none`,
        props.duplicate
          ? 'border-red-500 bg-red-100 shadow-[0_4px_0_#faa3a3,0_5px_0_#fb2c36,0_5px_3px_rgba(0,0,0,0.3)]'
          : 'border-gray-300 bg-white shadow-[0_4px_0_#b1b1b1,0_5px_0_#999,0_5px_3px_rgba(0,0,0,0.3)]',
      )}
    >
      {props.children}
    </kbd>
  );
}
