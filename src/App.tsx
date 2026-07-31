import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { Store } from '@tauri-apps/plugin-store';
import { useCallback, useEffect, useRef, useState } from 'react';

type SearchResult = {
  id: number;
  content: string;
  score: number;
  indices: number[];
};

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const { enablePin, theme, saveEnablePin, saveTheme } = useStore();

  const search = useCallback(async () => {
    try {
      const _results = await invoke<SearchResult[]>('search_history', { query });
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

  const handleSelectAndPaste = useCallback(async (content: string) => {
    try {
      await invoke('select_and_paste', { content });
    } catch (err) {
      console.error('Failed to paste content:', err);
    }
  }, []);

  const handleSelect = useCallback(async (content: string) => {
    try {
      await invoke('select', { content });
    } catch (err) {
      console.error('Failed to paste content:', err);
    }
  }, []);

  useEffect(() => {
    const unlistenPromise = listen('clipboard-updated', () => {
      void search();
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [search]);

  useEffect(() => {
    // 'Alt' を prevent しているのは復帰時にOSのウィンドウメニューが開くことがあるため
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.key === 'Alt') {
        e.preventDefault();
      }

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
            if (e.ctrlKey) {
              void handleSelect(selected.content);
            } else {
              void handleSelectAndPaste(selected.content);
            }
          }
          return;
        case 'Escape':
          e.preventDefault();
          void getCurrentWindow().hide();
          return;
        case 'Tab':
          const selector =
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';
          const focusableElements = document.querySelectorAll(selector);
          const lastElementChild: Element | undefined =
            focusableElements[focusableElements.length - 1];

          // target === input かつ Shift の場合、 最後の要素にフォーカス
          if (e.target === inputRef.current && e.shiftKey) {
            e.preventDefault();

            if (lastElementChild instanceof HTMLElement) {
              lastElementChild.focus();
            } else {
              inputRef.current?.focus();
            }

            return;
          }

          // target === 最後の要素 かつ not Shift の場合、 input にフォーカス
          if (e.target === lastElementChild && !e.shiftKey) {
            e.preventDefault();
            inputRef.current?.focus();
          }

          return;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.altKey || e.key === 'Alt') {
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyDown, true);
    };
  }, [cursor, results, handleSelect, handleSelectAndPaste]);

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

  // コンテナ全体の DOM 参照
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 検索結果が変わったタイミングで、Tauri ウィンドウの高さを自動調整する
  useEffect(() => {
    async function updateWindowSize() {
      if (!containerRef.current) return;

      const contentHeight = containerRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(contentHeight, 80), 800);
      await getCurrentWindow().setSize(new LogicalSize(800, targetHeight));
    }

    requestAnimationFrame(() => {
      void updateWindowSize();
    });
  }, [results]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingRef = useRef(false);

  // マウスダウンでドラッグを開始する関数
  async function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      return;
    }

    isDraggingRef.current = true;
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error('Failed to start dragging:', err);
    } finally {
      isDraggingRef.current = false;
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
          inputRef.current?.focus();
        });
      } else {
        if (!isDraggingRef.current && !enablePin) {
          void appWindow.hide();
        }
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [enablePin]);

  async function deleteSearchResult(id: number) {
    setResults((results) => results.filter((r) => r.id !== id));
    void invoke('delete_history_item', { id });
  }

  async function clearAllSearchResult() {
    setResults([]);
    void invoke('clear_all_history');
  }

  return (
    <div
      ref={containerRef}
      className={`flex max-h-200 w-full flex-col rounded-lg bg-gray-100 text-sm text-gray-900 shadow-md dark:bg-zinc-800 dark:text-zinc-100 ${theme === 'dark' ? 'dark' : ''}`}
    >
      <div
        className="pointer-events-auto flex-none cursor-move border-b border-b-gray-300 bg-white p-2 select-none dark:border-b-zinc-700 dark:bg-zinc-900"
        onMouseDown={handleMouseDown}
      >
        <input
          ref={inputRef}
          type="text"
          className="pointer-events-auto w-full p-2 transition focus:outline-none dark:bg-transparent dark:text-zinc-100"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div
        tabIndex={-1}
        className="pointer-events-auto flex min-h-0 w-full flex-1 flex-col divide-y divide-gray-300 overflow-y-auto focus:outline-none dark:divide-zinc-700"
      >
        {results.length > 0 ? (
          results.map((result, i) => {
            const isActive = cursor === i;
            return (
              <div key={i} className="group relative">
                <button
                  ref={isActive ? activeItemRef : null}
                  type="button"
                  className={`line-clamp-2 w-full shrink-0 cursor-pointer border-l-4 py-1 pl-2 text-start whitespace-pre-wrap transition-colors hover:bg-white focus:outline-none dark:hover:bg-zinc-700/50 ${
                    isActive
                      ? 'border-l-red-400 bg-white dark:border-l-red-500 dark:bg-zinc-700'
                      : 'border-l-transparent'
                  }`}
                  onFocus={() => {
                    setCursor(i);
                  }}
                  onClick={() => {
                    setCursor(i);
                    void handleSelectAndPaste(result.content);
                  }}
                >
                  <FastHighlight {...result} />
                </button>
                <div className="pointer-events-none absolute top-1/2 right-5 hidden size-5 -translate-y-1/2 rounded-full bg-white transition-all transition-discrete group-hover:block dark:bg-zinc-700">
                  <button
                    title="delete"
                    type="button"
                    tabIndex={-1}
                    className="pointer-events-auto inline-flex size-5 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-600"
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

      <div className="flex flex-row justify-between gap-2 border-t border-t-gray-300 p-2 dark:border-t-zinc-700">
        <div className="flex flex-row items-center gap-2">
          <button
            title="pin"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none ${
              enablePin
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-100 hover:bg-white focus:bg-white dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              void saveEnablePin(!enablePin);
            }}
          >
            <span className="icon-[mynaui--pin] size-4"></span>
          </button>
          <button
            title="theme"
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 bg-gray-100 p-1 transition-colors hover:bg-white focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
            onClick={(e) => {
              e.stopPropagation();
              void saveTheme(theme === 'light' ? 'dark' : 'light');
            }}
          >
            <div
              className={`inline-flex items-center rounded-full p-1 ${
                theme === 'light' ? 'bg-green-200 dark:bg-emerald-900/60 dark:text-emerald-300' : ''
              }`}
            >
              <span className="icon-[material-symbols--clear-day-outline-rounded] size-4"></span>
            </div>
            <div
              className={`inline-flex items-center rounded-full p-1 ${
                theme === 'dark' ? 'bg-green-200 dark:bg-emerald-900/60 dark:text-emerald-300' : ''
              }`}
            >
              <span className="icon-[material-symbols--mode-night-outline-rounded] size-4"></span>
            </div>
          </button>
        </div>

        <button
          title="clear all"
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-gray-100 p-2 transition-colors hover:bg-white focus:bg-white focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
          onClick={(e) => {
            e.stopPropagation();
            void clearAllSearchResult();
          }}
        >
          <span className="icon-[tabler--trash] size-4"></span>
        </button>
      </div>
    </div>
  );
}

function useStore() {
  const [store, setStore] = useState<Store>();
  const [enablePin, setEnablePin] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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

      setEnablePin(await getEnablePin(store));
      setTheme(await getTheme(store));
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

  return {
    store,
    enablePin,
    saveEnablePin,
    theme,
    saveTheme,
  };
}

function FastHighlight({ content, indices }: SearchResult) {
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

export default App;
