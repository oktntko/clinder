import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef, useState } from 'react';

type SearchResult = {
  id: number;
  content: string;
  score: number;
};

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);

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

  const handleSelect = useCallback(async (content: string) => {
    try {
      await invoke('select_and_paste', { content });
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
        case 'Home':
          e.preventDefault();
          setCursor(0);
          return;
        case 'End':
          e.preventDefault();
          setCursor(Math.max(results.length - 1, 0));
          return;
        case 'Enter':
          e.preventDefault();
          const selected = results[cursor];
          if (selected != null) {
            void handleSelect(selected.content);
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
  }, [cursor, results, handleSelect]);

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
        if (!isDraggingRef.current) {
          void appWindow.hide();
        }
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [search]);

  async function deleteSearchResult(id: number) {
    setResults((results) => results.filter((r) => r.id !== id));
    await invoke('delete_history_item', { id });
  }

  async function clearAllSearchResult() {
    setResults([]);
    await invoke('clear_all_history');
  }

  return (
    <div
      ref={containerRef}
      className="mx-auto flex max-h-200 w-full flex-col divide-y divide-gray-300 rounded-lg bg-gray-100 text-sm text-gray-900 shadow-md"
    >
      <div
        className="pointer-events-auto flex-none cursor-move bg-white p-2 select-none"
        onMouseDown={handleMouseDown}
      >
        <input
          ref={inputRef}
          type="text"
          className="pointer-events-auto w-full p-2 transition focus:outline-none"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div
        id="clipboard-history"
        className="pointer-events-auto flex min-h-0 w-full flex-1 flex-col divide-y divide-gray-300 overflow-y-auto focus:outline-none"
      >
        {results.length > 0 ? (
          results.map((result, i) => {
            const isActive = cursor === i;
            return (
              <button
                key={i}
                ref={isActive ? activeItemRef : null}
                type="button"
                className={`group relative line-clamp-2 shrink-0 cursor-pointer border-l-4 py-1 pl-2 text-start whitespace-pre-wrap transition-colors hover:bg-white focus:outline-none ${isActive ? 'border-l-red-400 bg-white ' : 'border-l-transparent'}`}
                onFocus={() => {
                  setCursor(i);
                }}
                onClick={() => {
                  setCursor(i);
                  void handleSelect(result.content);
                }}
              >
                {result.content}
                <div className="pointer-events-none absolute top-1/2 right-5 hidden size-5 -translate-y-1/2 rounded-full bg-white transition-all transition-discrete group-hover:block">
                  <button
                    title="delete"
                    type="button"
                    tabIndex={-1}
                    className="pointer-events-auto inline-flex size-5 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteSearchResult(result.id);
                    }}
                  >
                    <span className="icon-[mingcute--close-fill] size-4"></span>
                  </button>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex h-60 w-full items-center justify-center">No matches found</div>
        )}
      </div>

      <div className="flex flex-row p-2">
        <button
          title="clear all"
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-white focus:bg-white focus:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            void clearAllSearchResult();
          }}
        >
          <span className="icon-[material-symbols--delete-sweep-outline] size-4"></span>
        </button>
      </div>
    </div>
  );
}

export default App;
