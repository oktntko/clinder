import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef, useState } from 'react';

type SearchResult = {
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
        case 'Escape': {
          e.preventDefault();
          void getCurrentWindow().hide();
          return;
        }
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
      const targetHeight = Math.min(Math.max(contentHeight, 80), 600);
      await getCurrentWindow().setSize(new LogicalSize(600, targetHeight));
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

  return (
    <div
      ref={containerRef}
      className="mx-auto flex max-h-150 w-full flex-col divide-y divide-gray-300 rounded-lg bg-gray-50 text-sm text-gray-900 shadow-2xl"
    >
      <div
        className="pointer-events-auto flex-none cursor-move p-2 select-none"
        onMouseDown={handleMouseDown}
      >
        <input
          ref={inputRef}
          type="text"
          className="pointer-events-auto w-full bg-gray-50 p-2 transition focus:outline-none"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div
        tabIndex={-1}
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
                tabIndex={-1}
                className={`line-clamp-2 shrink-0 cursor-pointer border-l-4 bg-gray-100 py-1 pl-2 text-start whitespace-pre-wrap transition-colors hover:bg-white focus:outline-none ${isActive ? 'border-l-red-400 bg-white ' : 'border-l-transparent'}`}
                onClick={() => {
                  setCursor(i);
                  void handleSelect(result.content);
                }}
              >
                {result.content}
              </button>
            );
          })
        ) : (
          <div className="flex h-60 w-full items-center justify-center">No matches found</div>
        )}
      </div>
    </div>
  );
}

export default App;
