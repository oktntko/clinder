import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';

import invoke, { type Clip, type Searched } from '~/command';
import { R } from '~/lib/remeda';
import { matchShortcut, type useStore } from '~/plugin/useStore';

type ClipboardProps = ReturnType<typeof useStore> & {};

export function Clipboard({
  saveSearchContentType,
  saveSearchBookmark,
  saveSearchMode,
  ...props
}: ClipboardProps) {
  const [query, setQuery] = useState('');
  const [clipboard, setClipboard] = useState<Searched[]>([]);
  const [cursor, setCursor] = useState(0);

  const search = useCallback(async () => {
    try {
      const _clipboard = await invoke.search_clipboard({
        query,
        search_mode: props.searchMode,
        content_type: props.searchContentType,
        bookmark: props.searchBookmark,
      });
      setClipboard(_clipboard);
    } catch (err) {
      console.error('Failed to search history:', err);
    }
  }, [query, props.searchMode, props.searchContentType, props.searchBookmark]);

  useEffect(() => {
    setCursor((prev) => {
      if (clipboard.length === 0) return 0;
      return Math.min(prev, clipboard.length - 1);
    });
  }, [clipboard]);

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

  const deleteClip = useCallback(async function (clip: Clip) {
    setClipboard((clipboard) => clipboard.filter((item) => item.clip.id !== clip.id));
    void invoke.delete_clip(clip);
  }, []);

  const toggleClipBookmark = useCallback(async function (clip: Clip) {
    const updatedClip = { ...clip, bookmark: !clip.bookmark };
    setClipboard((clipboard) =>
      clipboard.map((item) => (item.clip.id === clip.id ? { ...item, clip: updatedClip } : item)),
    );
    return invoke.update_clip({ ...updatedClip });
  }, []);

  const toggleSearchContentTypeText = useCallback(async () => {
    return saveSearchContentType((prev) =>
      prev.some((x) => x === 'text')
        ? prev.filter((x) => x !== 'text')
        : R.unique(prev.concat(['text'])),
    );
  }, [saveSearchContentType]);

  const toggleSearchContentTypeImage = useCallback(async () => {
    return saveSearchContentType((prev) =>
      prev.some((x) => x === 'image')
        ? prev.filter((x) => x !== 'image')
        : R.unique(prev.concat(['image'])),
    );
  }, [saveSearchContentType]);

  const toggleSearchBookmark = useCallback(async () => {
    return saveSearchBookmark((prev) =>
      prev.length === 1 && prev[0] === true ? [true, false] : [true],
    );
  }, [saveSearchBookmark]);

  const toggleSearchMode = useCallback(async () => {
    return saveSearchMode((prev) => (prev === 'fuzzy' ? 'substring' : 'fuzzy'));
  }, [saveSearchMode]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) {
        // IME 変換中
        return;
      }

      if (matchShortcut(e, props.shortcutSendAndPaste)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          void invoke.send_and_paste(selected.clip);
        }
        return;
      }

      if (matchShortcut(e, props.shortcutSendClipboard)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          void invoke.send_clipboard(selected.clip);
        }
        return;
      }

      if (matchShortcut(e, props.shortcutDeleteClip)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          void deleteClip(selected.clip);
        }
        return;
      }

      if (matchShortcut(e, props.shortcutToggleClipBookmark)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          void toggleClipBookmark(selected.clip);
        }
        return;
      }

      if (matchShortcut(e, props.shortcutToggleSearchContentTypeText)) {
        e.preventDefault();
        return toggleSearchContentTypeText();
      }

      if (matchShortcut(e, props.shortcutToggleSearchContentTypeImage)) {
        e.preventDefault();
        return toggleSearchContentTypeImage();
      }

      if (matchShortcut(e, props.shortcutToggleSearchBookmark)) {
        e.preventDefault();
        return toggleSearchBookmark();
      }

      if (matchShortcut(e, props.shortcutToggleSearchMode)) {
        e.preventDefault();
        return toggleSearchMode();
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setCursor((prev) => Math.max(prev - 1, 0));
          return;
        case 'ArrowDown':
          e.preventDefault();
          setCursor((prev) => Math.min(prev + 1, Math.max(clipboard.length - 1, 0)));
          return;
        case 'PageUp':
          e.preventDefault();
          setCursor((prev) => Math.max(prev - 10, 0));
          return;
        case 'PageDown':
          e.preventDefault();
          setCursor((prev) => Math.min(prev + 10, Math.max(clipboard.length - 1, 0)));
          return;
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    cursor,
    clipboard,
    props.shortcutSendAndPaste,
    props.shortcutSendClipboard,
    props.shortcutDeleteClip,
    props.shortcutToggleClipBookmark,
    props.shortcutToggleSearchContentTypeText,
    props.shortcutToggleSearchContentTypeImage,
    props.shortcutToggleSearchBookmark,
    props.shortcutToggleSearchMode,
    deleteClip,
    toggleClipBookmark,
    toggleSearchContentTypeText,
    toggleSearchContentTypeImage,
    toggleSearchBookmark,
    toggleSearchMode,
  ]);

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

  return (
    <>
      <div className="flex shrink-0 flex-row items-center gap-1 border-b border-b-gray-300 p-2 select-none dark:border-b-zinc-700 dark:bg-zinc-900">
        <input
          type="text"
          className="w-full transition focus:outline-none dark:bg-transparent dark:text-zinc-100"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="inline-flex flex-row items-center gap-2">
          <button
            title="text"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none ${
              props.searchContentType.some((x) => x === 'text')
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              return toggleSearchContentTypeText();
            }}
          >
            <span className="icon-[humbleicons--text] size-4"></span>
          </button>
          <button
            title="image"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none ${
              props.searchContentType.some((x) => x === 'image')
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              return toggleSearchContentTypeImage();
            }}
          >
            <span className="icon-[humbleicons--image] size-4"></span>
          </button>

          <button
            title="search_bookmark"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none ${
              props.searchBookmark.length === 1 && props.searchBookmark[0] === true
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              return toggleSearchBookmark();
            }}
          >
            <span className="icon-[material-symbols--bookmark-outline-rounded] size-4"></span>
          </button>

          <button
            title="fuzzy search"
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-2 transition-colors focus:outline-none ${
              props.searchMode === 'fuzzy'
                ? 'bg-green-200 hover:bg-green-300 focus:bg-green-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-800/80 dark:focus:bg-emerald-800/80'
                : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              return toggleSearchMode();
            }}
          >
            <span className="icon-[codicon--search-fuzzy] size-4"></span>
          </button>
        </div>
      </div>

      <div
        tabIndex={-1}
        className="flex min-h-0 w-full flex-1 flex-col divide-y divide-gray-300 overflow-y-auto focus:outline-none dark:divide-zinc-700"
      >
        {clipboard.length > 0 ? (
          clipboard.map((item, i) => {
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
                  title={item.clip.content}
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
                    return invoke.send_and_paste(item.clip);
                  }}
                >
                  {item.clip.content_type === 'text' ? (
                    <HighlightText {...item} />
                  ) : (
                    <ShrinkImage {...item} />
                  )}
                </button>

                <div className="pointer-events-none absolute top-0 right-0">
                  <button
                    title="bookmark"
                    type="button"
                    tabIndex={-1}
                    className={`pointer-events-auto aspect-square size-5 transition-colors [clip-path:polygon(0_0,100%_0,100%_100%)] ${
                      item.clip.bookmark
                        ? 'bg-green-400 hover:bg-green-500 dark:bg-emerald-700 dark:hover:bg-emerald-800'
                        : 'bg-gray-100/90 hover:bg-gray-300 dark:bg-zinc-800/50 dark:hover:bg-zinc-600'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      return toggleClipBookmark(item.clip);
                    }}
                  ></button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex w-full grow items-center justify-center py-1 text-gray-500 dark:text-zinc-400">
            No matches found
          </div>
        )}
      </div>

      {/* TODO: */}
      {/* <button
        title="clear all"
        type="button"
        className="inline-flex items-center justify-center rounded-full bg-gray-200 p-2 transition-colors hover:bg-gray-300 focus:bg-gray-300 focus:outline-none dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:bg-zinc-600"
        onClick={(e) => {
          e.stopPropagation();
          void clearClipboard();
        }}
      >
        <span className="icon-[tabler--trash] size-4"></span>
      </button> */}
    </>
  );
}

function HighlightText({ snippet, indices }: Searched) {
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

function ShrinkImage({ clip: { content } }: Searched) {
  const imageUrl = convertFileSrc(content);

  return <img src={imageUrl} alt="clipboard image" className="h-auto max-h-32 w-auto max-w-150" />;
}
