import { invoke } from '@tauri-apps/api/core';
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setCursor((prev) => (prev > 0 ? prev - 1 : 0));
          return;
        case 'ArrowDown':
          e.preventDefault();
          setCursor((prev) => (results.length > 0 ? Math.min(prev + 1, results.length - 1) : 0));
          return;
        case 'Enter':
          e.preventDefault();
          const selected = results[cursor];
          if (selected != null) {
            // TODO: implements
            console.log('Selected:', selected.content);
          }
          return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cursor, results]);

  // アクティブな要素を参照するための Ref
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  // cursor が変化したら、アクティブな要素を可視領域にスクロールさせる
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest', // 画面外に出たときだけ最小限スクロール
        inline: 'nearest',
      });
    }
  }, [cursor]);

  return (
    <div className="pointer-events-none container mx-auto flex h-dvh flex-col divide-y divide-gray-300 overflow-y-auto rounded-lg bg-gray-50 text-sm text-gray-900">
      <input
        type="text"
        className="pointer-events-auto w-full flex-none bg-gray-50 p-2 transition focus:outline-none"
        autoFocus={true}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="pointer-events-auto flex w-full flex-1 flex-col divide-y divide-gray-300 overflow-y-auto">
        {results.length > 0 ? (
          results.map((result, i) => {
            const isActive = cursor === i;
            return (
              <div
                key={i}
                ref={isActive ? activeItemRef : null}
                className={`line-clamp-2 shrink-0 border-l-4 bg-gray-50 py-1 pl-2 transition-colors ${isActive ? 'border-l-red-400 bg-white' : 'border-l-gray-400'}`}
                onClick={() => setCursor(i)}
              >
                {result.content}
              </div>
            );
          })
        ) : (
          <div>No matches found</div>
        )}
      </div>
    </div>
  );
}

export default App;
