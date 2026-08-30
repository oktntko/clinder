import { useEffect, useState, type ReactNode } from 'react';

import invoke from '~/command';
import { Button } from '~/component/Button';
import { Checkbox, Input, Radio } from '~/component/Input';
import { cn, sleep } from '~/lib/utils';
import { useDialog } from '~/plugin/useDialog';
import {
  defaultFont,
  defaultGlobalShortcutToggleWindow,
  defaultHistorySize,
  defaultMaxHeight,
  defaultMaxItems,
  defaultMinHeight,
  defaultShortcutClearClipboard,
  defaultShortcutDeleteClip,
  defaultShortcutSendAndPaste,
  defaultShortcutSendClipboard,
  defaultShortcutShowPasteMenu,
  defaultShortcutToggleClipBookmark,
  defaultShortcutToggleSearchBookmark,
  defaultShortcutToggleSearchContentTypeFiles,
  defaultShortcutToggleSearchContentTypeImage,
  defaultShortcutToggleSearchContentTypeText,
  defaultShortcutToggleShowSubContents,
  defaultShortcutToggleWrapTextAutomatically,
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
      <div className="flex flex-col gap-6 overflow-y-auto px-12 py-8 focus:outline-none">
        <div className="text-lg font-bold capitalize">setting</div>

        <section className="flex flex-col gap-3">
          <div className="text-base font-semibold capitalize">appearance</div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="font" className="capitalize">
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

            <InlineForm
              id="min height"
              name="Min Height"
              label="min height (min: 100px)"
              initialValue={props.minHeight}
              defaultValue={defaultMinHeight}
              save={props.saveMinHeight}
              input={{ type: 'number', min: 100 }}
            />

            <InlineForm
              id="max height"
              name="Max Height"
              label="max height (min: 150px)"
              initialValue={props.maxHeight}
              defaultValue={defaultMaxHeight}
              save={props.saveMaxHeight}
              input={{ type: 'number', min: 150 }}
            />

            <div className="flex flex-col gap-0.5">
              <div>
                <div className="capitalize">wrap text automatically</div>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Radio
                  id="wrap"
                  name="wrap text automatically"
                  checked={props.wrapTextAutomatically}
                  value="true"
                  onChange={async (e) => {
                    await props.saveWrapTextAutomatically(e.target.value === 'true');

                    return $toast.success('Wrap Text Automatically updated successfully.');
                  }}
                >
                  wrap
                </Radio>
                <Radio
                  id="one-line"
                  name="wrap text automatically"
                  checked={!props.wrapTextAutomatically}
                  value="false"
                  onChange={async (e) => {
                    await props.saveWrapTextAutomatically(e.target.value === 'true');

                    return $toast.success('Wrap Text Automatically updated successfully.');
                  }}
                >
                  one-line
                </Radio>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="show sub contents" className="capitalize">
                  show sub contents (e.g., excel image, ocr text)
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="show sub contents"
                  checked={props.showSubContents}
                  onChange={async (e) => {
                    await props.saveShowSubContents(e.target.checked);

                    return $toast.success(
                      `Show Sub Contents ${e.target.checked ? 'enabled' : 'disabled'} successfully.`,
                    );
                  }}
                >
                  enabled
                </Checkbox>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="text-base font-semibold capitalize">behavior</div>
          <div className="flex flex-col gap-3">
            <InlineForm
              id="history size"
              name="History Size"
              label="history size (0 = unlimited)"
              initialValue={props.historySize}
              defaultValue={defaultHistorySize}
              save={props.saveHistorySize}
              input={{ type: 'number', min: 0 }}
            >
              <div className="text-xs">
                Max history items to keep. Older items are deleted on startup and daily when
                exceeding the limit.
              </div>
            </InlineForm>

            <InlineForm
              id="max items"
              name="Max Items"
              label="max items (min: 10, max: 100)"
              initialValue={props.maxItems}
              defaultValue={defaultMaxItems}
              save={props.saveMaxItems}
              input={{ type: 'number', min: 10, max: 100 }}
            />

            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="trim final newlines" className="capitalize">
                  trim final newlines (requires restart)
                </label>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="trim final newlines"
                  checked={props.trimFinalNewlines}
                  onChange={async (e) => {
                    await props.saveTrimFinalNewlines(e.target.checked);

                    $toast.success(
                      `Trim Final Newlines ${e.target.checked ? 'enabled' : 'disabled'} successfully.`,
                    );

                    await sleep(1000);

                    await $dialog.confirm.success(
                      `Trim Final Newlines ${e.target.checked ? 'enabled' : 'disabled'} successfully.\nDo you want to restart now?`,
                    );

                    return invoke.restart_app();
                  }}
                >
                  enabled
                </Checkbox>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <div>
                <label htmlFor="enable OCR" className="capitalize">
                  enable OCR (requires restart)
                </label>
                <div className="text-xs">
                  Extracts text from images so you can search them like regular text.
                </div>
                <div
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg text-xs',
                    'border p-2',
                    'border-blue-800 bg-blue-200 text-blue-800',
                    'dark:border-blue-700 dark:bg-blue-900 dark:text-blue-100',
                  )}
                >
                  <div>
                    Uses built-in OS features for OCR. Your images stay local and are never sent to
                    external servers.
                  </div>
                </div>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="enable OCR"
                  checked={props.enableOCR}
                  disabled={!props.ocr}
                  onChange={async (e) => {
                    await props.saveEnableOCR(e.target.checked);

                    $toast.success(
                      `OCR ${e.target.checked ? 'enabled' : 'disabled'} successfully.`,
                    );

                    await sleep(1000);

                    await $dialog.confirm.success(
                      `OCR ${e.target.checked ? 'enabled' : 'disabled'} successfully.\nDo you want to restart now?`,
                    );

                    return invoke.restart_app();
                  }}
                >
                  enabled
                </Checkbox>
              </div>
              {props.ocr ? (
                <div className="text-xs">
                  Detected OS Languages:
                  <span className="font-mono text-base font-bold text-blue-500"> {props.ocr}</span>
                </div>
              ) : (
                <div className="text-xs text-red-500">
                  <p className="font-bold">No OCR-compatible language packs found.</p>
                  <span>
                    Please install a supported language pack (e.g., English, Japanese) in Settings
                    to use OCR.
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="text-base font-semibold capitalize">Keybindings</div>
          <div className="flex flex-col gap-3">
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
                title: 'send clipboard',
                shortcut: props.shortcutSendClipboard,
                save: props.saveShortcutSendClipboard,
                default: defaultShortcutSendClipboard,
              },
              {
                title: 'send and paste',
                shortcut: props.shortcutSendAndPaste,
                save: props.saveShortcutSendAndPaste,
                default: defaultShortcutSendAndPaste,
              },
              {
                title: 'delete clip',
                shortcut: props.shortcutDeleteClip,
                save: props.saveShortcutDeleteClip,
                default: defaultShortcutDeleteClip,
              },
              {
                title: 'clear clipboard',
                shortcut: props.shortcutClearClipboard,
                save: props.saveShortcutClearClipboard,
                default: defaultShortcutClearClipboard,
              },
              {
                title: 'toggle clip bookmark',
                shortcut: props.shortcutToggleClipBookmark,
                save: props.saveShortcutToggleClipBookmark,
                default: defaultShortcutToggleClipBookmark,
              },
              {
                title: 'show paste menu',
                shortcut: props.shortcutShowPasteMenu,
                save: props.saveShortcutShowPasteMenu,
                default: defaultShortcutShowPasteMenu,
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
                title: 'toggle wrap text automatically',
                shortcut: props.shortcutToggleWrapTextAutomatically,
                save: props.saveShortcutToggleWrapTextAutomatically,
                default: defaultShortcutToggleWrapTextAutomatically,
              },
              {
                title: 'toggle show sub contents',
                shortcut: props.shortcutToggleShowSubContents,
                save: props.saveShortcutToggleShowSubContents,
                default: defaultShortcutToggleShowSubContents,
              },
            ].map((x, i, arr) => {
              const duplicate = arr
                .filter((_, ii) => ii !== i)
                .some((y) => matchShortcut(x.shortcut, y.shortcut));
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <div>
                    <label className="capitalize">{x.title}</label>
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
                      disabled={matchShortcut(x.shortcut, x.default)}
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

            <div
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg',
                'border p-4',
                'border-blue-800 bg-blue-200 text-blue-800',
                'dark:border-blue-700 dark:bg-blue-900 dark:text-blue-100',
              )}
            >
              <div>
                <div className="flex items-center gap-1 capitalize">
                  <div className="inline-flex items-center justify-center">
                    <span className="icon-[material-symbols--info-outline-rounded] size-5"></span>
                  </div>
                  <div>move window</div>
                </div>
              </div>
              <div>
                <div>
                  <Key>Alt</Key> Drag anywhere in the window to move it.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function InlineForm<T extends string | number>(props: {
  id: string;
  name: string;
  label: string;
  initialValue: T;
  defaultValue: T;
  save: (v: T) => Promise<void>;
  input: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'defaultValue' | 'required'>;
  children?: ReactNode;
}) {
  const $toast = useToast();
  const [value, setValue] = useState<T>(props.initialValue);

  return (
    <form
      className="flex flex-col gap-0.5"
      onSubmit={async (e) => {
        e.preventDefault();

        await props.save(value);
        return $toast.success(`${props.name} updated successfully.`);
      }}
    >
      <div>
        <label htmlFor={props.id} className="capitalize">
          {props.label}
        </label>
      </div>
      {props.children}
      <div className="flex flex-row items-center gap-2">
        <Input
          id={props.id}
          required
          value={value}
          onChange={(e) =>
            setValue((typeof value === 'number' ? Number(e.target.value) : e.target.value) as T)
          }
          {...props.input}
        />
        <Button
          type="submit"
          set={value !== props.initialValue ? 'positive' : 'default'}
          disabled={value === props.initialValue}
        >
          <span className="icon-[material-symbols--check-rounded] size-4"></span>
        </Button>
        <Button
          title="reset"
          type="button"
          set="default"
          disabled={value === props.defaultValue}
          onClick={async () => {
            await props.save(props.defaultValue);

            setValue(props.defaultValue);

            return $toast.success(`${props.name} updated successfully.`);
          }}
        >
          <span className="icon-[system-uicons--reset] size-4"></span>
        </Button>
      </div>
    </form>
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
        'bg-slate-100 text-slate-900',
        'dark:bg-zinc-900 dark:text-zinc-100',
      )}
    >
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-base font-semibold capitalize">{props.title}</div>
          <div className="text-sm text-slate-700 dark:text-zinc-300">
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
          <Button type="button" set="positive" variant="text" onClick={() => props.onSave(value)}>
            save
          </Button>
          <Button type="button" set="default" variant="text" onClick={() => props.onCancel()}>
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
