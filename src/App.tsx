import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Store } from '@tauri-apps/plugin-store';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import invoke, { type SearchResult } from '~/invoke';
import { cn } from '~/lib/utils';
import { useToast } from '~/plugin/useToast';

function App() {
  const store = useStore();

  useEffect(() => {
    // 'Alt' を prevent しているのは復帰時にOSのウィンドウメニューが開くことがあるため
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape': {
          e.preventDefault();
          void getCurrentWindow().hide();
          return;
        }
        case 'Tab': {
          if (e.ctrlKey) {
            switch (store.page) {
              case 'clipboard':
                e.preventDefault();
                return store.setPage('keybindings');
              case 'keybindings':
                e.preventDefault();
                return store.setPage('clipboard');
            }
          }

          const focusable = document.querySelectorAll(FOCUSABLE_SELECTOR);
          const firstElement: Element | undefined = focusable[0];
          const lastElement: Element | undefined = focusable[focusable.length - 1];

          if (e.target === firstElement && e.shiftKey) {
            if (lastElement instanceof HTMLElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else if (e.target === lastElement && !e.shiftKey) {
            if (firstElement instanceof HTMLElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }

          return;
        }
      }
    }

    function preventAltKey(e: KeyboardEvent) {
      if (e.altKey || e.key === 'Alt') {
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', preventAltKey, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', preventAltKey, true);

    return () => {
      window.removeEventListener('keydown', preventAltKey, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', preventAltKey, true);
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  async function handleMouseDown() {
    setIsDragging(true);
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error('Failed to start dragging:', err);
    } finally {
      setIsDragging(false);
    }
  }

  // ウィンドウのフォーカス変化を監視
  // フォーカスされたら input をフォーカスする
  // フォーカスが外れたら非表示にする
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlistenPromise = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        requestAnimationFrame(() => {
          const focusable = document.querySelectorAll(FOCUSABLE_SELECTOR);
          const firstElement: Element | undefined = focusable[0];
          if (firstElement instanceof HTMLElement) {
            firstElement.focus();
          }
        });
      } else {
        if (!isDragging && !store.enablePin) {
          void appWindow.hide();
        }
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isDragging, store.enablePin]);

  return (
    <>
      <div
        className={`max-h-200 w-150 rounded-lg bg-white text-sm text-gray-900 shadow-md dark:bg-zinc-900 dark:text-zinc-100 ${store.theme === 'dark' ? 'dark' : ''}`}
      >
        {/* data-tauri-drag-region */}
        <div className="block h-2 cursor-move select-none" onMouseDown={handleMouseDown}></div>

        {store.page === 'clipboard' ? <Clipboard {...store} /> : <Keybindings {...store} />}
      </div>
    </>
  );
}

type ClipboardProps = ReturnType<typeof useStore> & {};

function Clipboard(props: ClipboardProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);

  const search = useCallback(async () => {
    try {
      const _results = await invoke.search_history(query);
      setResults(_results);
      if (_results.length === 0) {
        setCursor(0);
      } else {
        setCursor(Math.min(cursor, _results.length - 1));
      }
    } catch (err) {
      console.error('Failed to search history:', err);
    }
  }, [query, cursor]);

  useEffect(() => {
    void search();
  }, [query, search]);

  useEffect(() => {
    const unlistenPromise = listen('clipboard-updated', () => {
      void search();
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [search]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setCursor((prev) => Math.max(prev - 1, 0));
          return;
        case 'ArrowDown':
          e.preventDefault();
          setCursor((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
          return;
        case 'PageUp':
          e.preventDefault();
          setCursor((prev) => Math.max(prev - 10, 0));
          return;
        case 'PageDown':
          e.preventDefault();
          setCursor((prev) => Math.min(prev + 10, Math.max(results.length - 1, 0)));
          return;
        case 'Enter':
          e.preventDefault();
          const selected = results[cursor];
          if (selected != null) {
            if (!e.ctrlKey) {
              if (props.selectAction === 'send-and-paste') {
                void invoke.select_and_paste(selected.content);
              } else {
                void invoke.select(selected.content);
              }
            } else {
              if (props.selectAction === 'send-and-paste') {
                void invoke.select(selected.content);
              } else {
                void invoke.select_and_paste(selected.content);
              }
            }
          }
          return;
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [cursor, results, props.selectAction]);

  // アクティブな要素を参照するための Ref
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  // cursor が変化したら、アクティブな要素を可視領域にスクロールさせる
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest', // 画面外に出たときだけ最小限スクロール
        inline: 'nearest',
      });
    }
  }, [cursor]);

  async function deleteSearchResult(id: number) {
    setResults((results) => results.filter((r) => r.id !== id));
    void invoke.delete_history_item(id);
  }

  async function clearAllSearchResult() {
    setResults([]);
    void invoke.clear_all_history();
  }

  return (
    <div className={`flex max-h-198 flex-col`}>
      <div className="shrink-0 border-b border-b-gray-300 select-none dark:border-b-zinc-700 dark:bg-zinc-900">
        <input
          type="text"
          className="w-full px-2 pt-2 pb-4 transition focus:outline-none dark:bg-transparent dark:text-zinc-100"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div
        tabIndex={-1}
        className="flex min-h-0 w-full flex-1 flex-col divide-y divide-gray-300 overflow-y-auto focus:outline-none dark:divide-zinc-700"
      >
        {results.length > 0 ? (
          results.map((result, i) => {
            const isActive = cursor === i;
            return (
              <div key={i} className="group relative">
                <button
                  ref={isActive ? activeItemRef : null}
                  type="button"
                  className={`line-clamp-2 w-full shrink-0 cursor-pointer border-l-4 py-1 pl-2 text-start whitespace-pre-wrap transition-colors hover:bg-gray-200/50 focus:outline-none dark:hover:bg-zinc-700/50 ${
                    isActive
                      ? 'border-l-red-500 bg-gray-200 dark:bg-zinc-700'
                      : 'border-l-transparent'
                  }`}
                  onFocus={() => {
                    setCursor(i);
                  }}
                  onClick={() => {
                    setCursor(i);
                    void invoke.select_and_paste(result.content);
                  }}
                >
                  <Highlight {...result} />
                </button>
                <div className="pointer-events-none absolute top-1/2 right-5 hidden size-5 -translate-y-1/2 rounded-full bg-gray-200 transition-all transition-discrete group-hover:block dark:bg-zinc-700">
                  <button
                    title="delete"
                    type="button"
                    tabIndex={-1}
                    className="pointer-events-auto inline-flex size-5 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteSearchResult(result.id);
                    }}
                  >
                    <span className="icon-[mingcute--close-fill] size-4"></span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex h-60 w-full items-center justify-center text-gray-500 dark:text-zinc-400">
            No matches found
          </div>
        )}
      </div>

      <Footer {...props}>
        <button
          title="clear all"
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-gray-200 p-2 transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
          onClick={(e) => {
            e.stopPropagation();
            void clearAllSearchResult();
          }}
        >
          <span className="icon-[tabler--trash] size-4"></span>
        </button>
      </Footer>
    </div>
  );

  function Highlight({ content, indices }: SearchResult) {
    if (!indices || indices.length === 0) {
      return <>{content}</>;
    }

    // サロゲートペアや絵文字を考慮して文字単位の配列にする
    const chars = Array.from(content);
    const indexSet = new Set(indices);

    const elements: React.ReactNode[] = [];
    let currentChunk = '';
    let inMark = false;

    for (let i = 0; i < chars.length; i++) {
      const isMatch = indexSet.has(i);

      if (isMatch !== inMark) {
        if (currentChunk) {
          if (inMark) {
            elements.push(
              <mark key={i} className="rounded-sm bg-yellow-200 text-black">
                {currentChunk}
              </mark>,
            );
          } else {
            elements.push(currentChunk);
          }
        }
        currentChunk = '';
        inMark = isMatch;
      }

      currentChunk += chars[i];
    }

    if (currentChunk) {
      if (inMark) {
        elements.push(
          <mark key="last" className="rounded-sm bg-yellow-200 text-black">
            {currentChunk}
          </mark>,
        );
      } else {
        elements.push(currentChunk);
      }
    }

    return <>{elements}</>;
  }
}

type KeybindingsProps = ReturnType<typeof useStore> & {};

function Keybindings(props: KeybindingsProps) {
  const $toast = useToast();

  return (
    <div className="flex max-h-198 flex-col">
      <div className="mx-auto pt-4 pb-10">
        <div className="py-4 text-lg font-bold">Keybindings</div>

        <div className="flex flex-col gap-4">
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
                autoFocus={true}
                className="rounded-md border border-gray-300 bg-white p-2 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="inline-flex items-center rounded bg-gray-200 p-2 text-sm transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
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
        </div>
      </div>

      <Footer {...props}></Footer>
    </div>
  );

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
}

type FooterProps = ReturnType<typeof useStore> & { children?: ReactNode };

function Footer(props: FooterProps) {
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
            title="keybindings"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
              props.page === 'keybindings'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              props.setPage('keybindings');
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

function useStore() {
  const [store, setStore] = useState<Store>();
  const [enablePin, setEnablePin] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [page, setPage] = useState<'clipboard' | 'keybindings'>('clipboard');
  const [windowToggleShortcut, setWindowToggleShortcut] = useState<string>('Alt+V');
  const [selectAction, setSelectAction] = useState<'send-and-paste' | 'send-only'>(
    'send-and-paste',
  );

  useEffect(() => {
    void (async () => {
      // %USERPROFILE%\AppData\Roaming\oktntko.clinder
      const store = await Store.load('settings.json');
      setStore(store);

      async function getEnablePin(store: Store) {
        const v = await store?.get<boolean>('pin');
        return v ?? false;
      }

      async function getTheme(store: Store) {
        const v = await store?.get<'light' | 'dark'>('theme');
        return v ?? 'dark';
      }

      async function getWindowToggleShortcut(store: Store) {
        const v = await store?.get<string>('window_toggle_shortcut');
        return v ?? 'Alt+V';
      }

      async function getSelectAction(store: Store) {
        const v = await store?.get<'send-and-paste' | 'send-only'>('select_action');
        return v ?? 'send-and-paste';
      }

      setEnablePin(await getEnablePin(store));
      setTheme(await getTheme(store));
      setWindowToggleShortcut(await getWindowToggleShortcut(store));
      setSelectAction(await getSelectAction(store));
    })();

    return () => undefined;
  }, []);

  async function saveEnablePin(v: boolean) {
    setEnablePin(v);
    await store?.set('pin', v);
    await store?.save();
  }

  async function saveTheme(v: 'light' | 'dark') {
    setTheme(v);
    await store?.set('theme', v);
    await store?.save();
  }

  async function saveSelectAction(v: 'send-and-paste' | 'send-only') {
    setSelectAction(v);
    await store?.set('clipboard_send_mode', v);
    await store?.save();
  }

  return {
    enablePin,
    saveEnablePin,
    theme,
    saveTheme,
    page,
    setPage,
    windowToggleShortcut,
    selectAction,
    saveSelectAction,
  };
}

export default App;

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';
