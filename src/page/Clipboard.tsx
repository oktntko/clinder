import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { useStore } from '~/plugin/useStore';

import { Footer } from '~/component/Footer';
import invoke, { type SearchResult } from '~/invoke';

type ClipboardProps = ReturnType<typeof useStore> & {};

export function Clipboard(props: ClipboardProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);

  const search = useCallback(async () => {
    try {
      const _results = await invoke.search_history(query, props.searchMode);
      setResults(_results);
      if (_results.length === 0) {
        setCursor(0);
      } else {
        setCursor(Math.min(cursor, _results.length - 1));
      }
    } catch (err) {
      console.error('Failed to search history:', err);
    }
  }, [query, cursor, props.searchMode]);

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
      <div className="flex shrink-0 flex-row items-center gap-1 border-b border-b-gray-300 px-2 pt-px pb-2 select-none dark:border-b-zinc-700 dark:bg-zinc-900">
        <input
          type="text"
          className="w-full transition focus:outline-none dark:bg-transparent dark:text-zinc-100"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div
          title="search_mode"
          className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 bg-gray-100 p-1 transition-colors hover:bg-white focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
        >
          <button
            title="fuzzy search"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
              props.searchMode === 'fuzzy'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              void props.saveSearchMode('fuzzy');
            }}
          >
            <span className="icon-[codicon--search-fuzzy] size-4"></span>
          </button>
          <button
            title="exact search"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 transition-colors focus:outline-none ${
              props.searchMode === 'substring'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              void props.saveSearchMode('substring');
            }}
          >
            <span className="icon-[mdi--target] size-4"></span>
          </button>
        </div>
      </div>

      <div
        tabIndex={-1}
        className="flex min-h-0 w-full flex-1 flex-col divide-y divide-gray-300 overflow-y-auto focus:outline-none dark:divide-zinc-700"
      >
        {results.length > 0 ? (
          results.map((item, i) => {
            const isActive = cursor === i;
            return (
              <div
                key={i}
                className={`group relative border-l-4 px-1 transition-colors hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 ${
                  isActive
                    ? 'border-l-red-500 bg-gray-200 dark:bg-zinc-700'
                    : 'border-l-transparent'
                } `}
              >
                <button
                  ref={isActive ? activeItemRef : null}
                  type="button"
                  className={`relative w-full shrink-0 cursor-pointer truncate py-1 text-start focus:outline-none ${
                    item.trimmed_begin
                      ? "before:icon-[lucide--ellipsis] pl-5 before:absolute before:top-1/2 before:left-0 before:inline-block before:size-4 before:-translate-y-1/2 before:bg-gray-300 before:content-[''] dark:before:bg-zinc-600"
                      : ''
                  } ${
                    item.trimmed_end
                      ? "after:icon-[lucide--ellipsis] pr-5 after:absolute after:top-1/2 after:right-0 after:inline-block after:size-4 after:-translate-y-1/2 after:bg-gray-300 after:content-[''] dark:after:bg-zinc-600"
                      : ''
                  }`}
                  onFocus={() => {
                    setCursor(i);
                  }}
                  onClick={() => {
                    setCursor(i);
                    void invoke.select_and_paste(item.content);
                  }}
                >
                  <Highlight {...item} />
                </button>
                <div className="pointer-events-none absolute top-1/2 right-5 hidden size-5 -translate-y-1/2 rounded-full bg-gray-200 transition-all transition-discrete group-hover:block dark:bg-zinc-700">
                  <button
                    title="delete"
                    type="button"
                    tabIndex={-1}
                    className="pointer-events-auto inline-flex size-5 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteSearchResult(item.id);
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

  function Highlight({ snippet, indices }: SearchResult) {
    if (!indices || indices.length === 0) {
      return <>{snippet}</>;
    }

    // サロゲートペアや絵文字を考慮して文字単位の配列にする
    const chars = Array.from(snippet);
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
