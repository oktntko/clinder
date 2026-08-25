import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { FOCUSABLE_SELECTOR } from '~/App';
import invoke, { type Clip, type Searched } from '~/command';
import { Button } from '~/component/Button';
import { cn } from '~/lib/utils';
import { useDialog } from '~/plugin/useDialog';
import { matchShortcut, type useStore } from '~/plugin/useStore';

type ClipboardProps = ReturnType<typeof useStore> & {};

export function Clipboard({
  saveSearchContentType,
  saveSearchBookmark,
  saveSearchMode,
  saveWrapTextAutomatically,
  saveShowSubContents,
  ...props
}: ClipboardProps) {
  const $dialog = useDialog();

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
    return invoke.update_clip_bookmark({ ...updatedClip });
  }, []);

  const showPasteMenu = useCallback(
    async function (clip: Clip, anchor: HTMLDivElement) {
      anchor.scrollIntoView({
        block: 'nearest', // 画面外に出たときだけ最小限スクロール
        inline: 'nearest',
      });

      const buttonCount =
        (clip.plain_text ? 2 : 0) + (clip.image_hash ? 2 : 0) + (clip.files.length > 0 ? 2 : 0);
      const height = buttonCount * 36 + 18;
      return $dialog.showModal(PasteMenu, (resolve) => ({ clip, onSuccess: () => resolve('ok') }), {
        anchor,
        anchorChildHeight: height,
        showCloseButton: false,
      });
    },
    [$dialog],
  );

  const toggleSearchContentTypeText = useCallback(async () => {
    return saveSearchContentType((prev) =>
      prev.some((x) => x === 'text') ? prev.filter((x) => x !== 'text') : prev.concat(['text']),
    );
  }, [saveSearchContentType]);

  const toggleSearchContentTypeImage = useCallback(async () => {
    return saveSearchContentType((prev) =>
      prev.some((x) => x === 'image') ? prev.filter((x) => x !== 'image') : prev.concat(['image']),
    );
  }, [saveSearchContentType]);

  const toggleSearchContentTypeFiles = useCallback(async () => {
    return saveSearchContentType((prev) =>
      prev.some((x) => x === 'files') ? prev.filter((x) => x !== 'files') : prev.concat(['files']),
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

  const toggleWrapTextAutomatically = useCallback(async () => {
    return saveWrapTextAutomatically((prev) => !prev);
  }, [saveWrapTextAutomatically]);

  const toggleShowSubContents = useCallback(async () => {
    return saveShowSubContents((prev) => !prev);
  }, [saveShowSubContents]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) {
        // IME 変換中
        return;
      }

      const modalDialog = document.querySelector('dialog:modal') as HTMLDialogElement | null;

      if (matchShortcut(e, props.shortcutShowPasteMenu)) {
        e.preventDefault();
        if (modalDialog == null) {
          const selected = clipboard[cursor];
          if (selected != null && activeItemRef.current != null) {
            void showPasteMenu(selected.clip, activeItemRef.current);
          }
        } else {
          modalDialog.close();
        }
        return;
      }

      if (modalDialog) {
        return;
      }

      if (matchShortcut(e, props.shortcutSendAndPaste)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          if (selected.clip.content_type === 'text') {
            void invoke.paste_text(selected.clip);
          } else if (selected.clip.content_type === 'image') {
            void invoke.paste_image(selected.clip);
          } else {
            void invoke.paste_files(selected.clip);
          }
        }
        return;
      }

      if (matchShortcut(e, props.shortcutSendClipboard)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          if (selected.clip.content_type === 'text') {
            void invoke.send_text(selected.clip);
          } else if (selected.clip.content_type === 'image') {
            void invoke.send_image(selected.clip);
          } else {
            void invoke.send_files(selected.clip);
          }
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

      if (matchShortcut(e, props.shortcutToggleSearchContentTypeFiles)) {
        e.preventDefault();
        return toggleSearchContentTypeFiles();
      }

      if (matchShortcut(e, props.shortcutToggleSearchBookmark)) {
        e.preventDefault();
        return toggleSearchBookmark();
      }

      if (matchShortcut(e, props.shortcutToggleSearchMode)) {
        e.preventDefault();
        return toggleSearchMode();
      }

      if (matchShortcut(e, props.shortcutToggleWrapTextAutomatically)) {
        e.preventDefault();
        return toggleWrapTextAutomatically();
      }

      if (matchShortcut(e, props.shortcutToggleShowSubContents)) {
        e.preventDefault();
        return toggleShowSubContents();
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

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    cursor,
    clipboard,
    props.shortcutSendAndPaste,
    props.shortcutSendClipboard,
    props.shortcutDeleteClip,
    props.shortcutToggleClipBookmark,
    props.shortcutShowPasteMenu,
    props.shortcutToggleSearchContentTypeText,
    props.shortcutToggleSearchContentTypeImage,
    props.shortcutToggleSearchContentTypeFiles,
    props.shortcutToggleSearchBookmark,
    props.shortcutToggleSearchMode,
    props.shortcutToggleWrapTextAutomatically,
    props.shortcutToggleShowSubContents,
    deleteClip,
    toggleClipBookmark,
    showPasteMenu,
    toggleSearchContentTypeText,
    toggleSearchContentTypeImage,
    toggleSearchContentTypeFiles,
    toggleSearchBookmark,
    toggleSearchMode,
    toggleWrapTextAutomatically,
    toggleShowSubContents,
  ]);

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

  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        requestAnimationFrame(() => {
          const input = document.getElementById('query');
          input?.focus();
        });
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 flex-row items-center gap-2 px-2 py-3 transition',
          'border-b-2',
          'border-b-slate-400 has-[input:focus]:bg-white',
          'dark:border-b-zinc-600 dark:has-[input:focus]:bg-black',
        )}
      >
        <Button
          title="fuzzy search"
          type="button"
          set={props.searchMode === 'fuzzy' ? 'positive' : 'ghost'}
          onClick={(e) => {
            e.preventDefault();
            return toggleSearchMode();
          }}
        >
          <span className="icon-[codicon--search-fuzzy] size-4"></span>
        </Button>

        <input
          id="query"
          type="text"
          className="w-full transition outline-none"
          autoFocus={true}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />

        <div className="inline-flex flex-row items-center gap-1.5">
          <Button
            title="text"
            type="button"
            set={props.searchContentType.some((x) => x === 'text') ? 'positive' : 'ghost'}
            onClick={(e) => {
              e.preventDefault();
              return toggleSearchContentTypeText();
            }}
          >
            <span className="icon-[humbleicons--text] size-4"></span>
          </Button>
          <Button
            title="image"
            type="button"
            set={props.searchContentType.some((x) => x === 'image') ? 'positive' : 'ghost'}
            onClick={(e) => {
              e.preventDefault();
              return toggleSearchContentTypeImage();
            }}
          >
            <span className="icon-[humbleicons--image] size-4"></span>
          </Button>
          <Button
            title="files"
            type="button"
            set={props.searchContentType.some((x) => x === 'files') ? 'positive' : 'ghost'}
            onClick={(e) => {
              e.preventDefault();
              return toggleSearchContentTypeFiles();
            }}
          >
            <span className="icon-[humbleicons--folder] size-4"></span>
          </Button>

          <Button
            title="search_bookmark"
            type="button"
            set={
              props.searchBookmark.length === 1 && props.searchBookmark[0] === true
                ? 'positive'
                : 'ghost'
            }
            onClick={(e) => {
              e.preventDefault();
              return toggleSearchBookmark();
            }}
          >
            <span className="icon-[lucide--bookmark] size-4"></span>
          </Button>
        </div>
      </div>

      <div
        tabIndex={-1}
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col divide-y overflow-y-auto outline-none',
          'divide-slate-300',
          'dark:divide-zinc-600',
        )}
      >
        {clipboard.length > 0 ? (
          clipboard.map((item, i) => {
            const isActive = cursor === i;
            return (
              <div
                ref={isActive ? activeItemRef : null}
                key={item.clip.id}
                className={cn(
                  'group relative border-l-6 px-1 transition-colors',
                  'hover:bg-white',
                  'dark:hover:bg-zinc-700',
                  isActive
                    ? ['border-l-red-500', 'bg-white', 'dark:bg-zinc-700']
                    : 'border-l-transparent',
                )}
              >
                <button
                  type="button"
                  title={item.clip.plain_text}
                  tabIndex={-1}
                  className={cn(
                    'flex w-full shrink-0 cursor-pointer flex-col items-start justify-center py-1 text-start outline-none',
                  )}
                  onFocus={() => {
                    setCursor(i);
                  }}
                  onClick={() => {
                    setCursor(i);
                    if (item.clip.content_type === 'text') {
                      void invoke.paste_text(item.clip);
                    } else if (item.clip.content_type === 'image') {
                      void invoke.paste_image(item.clip);
                    } else {
                      void invoke.paste_files(item.clip);
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {item.clip.content_type === 'text' ? (
                    <>
                      <HighlightText {...{ ...props, item }} />
                      {item.clip.image_hash && props.showSubContents && (
                        <ShrinkImage {...{ ...props, item }} />
                      )}
                    </>
                  ) : item.clip.content_type === 'image' ? (
                    <>
                      <ShrinkImage {...{ ...props, item }} />
                      {item.clip.plain_text && props.showSubContents && (
                        <HighlightText {...{ ...props, item }} />
                      )}
                    </>
                  ) : (
                    /* files */
                    <FileList {...{ ...props, item }} />
                  )}
                </button>

                <Button
                  title="show paste menu"
                  tabIndex={-1}
                  type="button"
                  set="default"
                  className={cn(
                    'absolute top-3.5 right-3.5 z-10 -translate-y-1/2',
                    'transition-discrete delay-0',
                    'pointer-events-none opacity-0',
                    'group-hover:pointer-events-auto group-hover:opacity-100 group-hover:delay-500 hover:delay-0',
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    void showPasteMenu(item.clip, (e.target as HTMLButtonElement).closest('div')!);
                  }}
                >
                  <span className="icon-[boxicons--menu] size-4"></span>
                </Button>

                <div className="pointer-events-none absolute top-0 right-0">
                  <button
                    title="bookmark"
                    type="button"
                    tabIndex={-1}
                    className={cn(
                      'pointer-events-auto aspect-square size-5 transition-colors',
                      '[clip-path:polygon(0_0,100%_0,100%_100%)]',
                      item.clip.bookmark
                        ? [
                            'bg-green-400 hover:bg-green-500',
                            'dark:bg-emerald-600 dark:hover:bg-emerald-700',
                          ]
                        : [
                            'bg-slate-200 hover:bg-green-200',
                            'dark:bg-zinc-800 dark:hover:bg-emerald-800',
                          ],
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      return toggleClipBookmark(item.clip);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                  ></button>
                </div>
              </div>
            );
          })
        ) : (
          <div
            className={cn(
              'flex h-full w-full grow items-center justify-center py-1',
              'text-slate-500',
              'dark:text-zinc-400',
              props.wrapTextAutomatically ? 'wrap-anywhere whitespace-pre-wrap' : '',
            )}
          >
            No matches found
          </div>
        )}
      </div>
    </>
  );
}

type ClipContainerProps = Pick<
  ReturnType<typeof useStore>,
  'wrapTextAutomatically' | 'appLocalDataDir'
> & { item: Searched };

function HighlightText(props: ClipContainerProps) {
  if (!props.item.indices || props.item.indices.length === 0) {
    return (
      <div
        className={cn(
          props.wrapTextAutomatically ? 'wrap-anywhere whitespace-pre-wrap' : 'line-clamp-1',
        )}
      >
        {props.item.trimmed_begin ? '... ' : ''}
        {props.item.snippet}
      </div>
    );
  }

  // サロゲートペアや絵文字を考慮して文字単位の配列にする
  const chars = Array.from(props.item.snippet);
  const indexSet = new Set(props.item.indices);

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

  return (
    <div
      className={cn(
        props.wrapTextAutomatically ? 'wrap-anywhere whitespace-pre-wrap' : 'line-clamp-1',
      )}
    >
      {props.item.trimmed_begin ? '... ' : ''}
      {elements}
    </div>
  );
}

function ShrinkImage(props: ClipContainerProps) {
  const [imageSrc, setImageSrc] = useState('');
  useEffect(() => {
    void (async () => {
      const path = await join(
        props.appLocalDataDir,
        'clipboard_image',
        `${props.item.clip.image_hash}.png`,
      );
      setImageSrc(convertFileSrc(path));
    })();

    return () => {
      //
    };
  }, [props.item.clip.image_hash, props.appLocalDataDir]);

  return (
    imageSrc && (
      <img
        src={imageSrc}
        alt="clipboard image"
        className={cn(
          'h-auto max-h-32 w-auto max-w-140',
          'border border-dotted',
          'border-slate-400',
          'dark:border-zinc-400',
        )}
      />
    )
  );
}

function FileList(props: ClipContainerProps) {
  return (
    <>
      <div className="flex items-center gap-1">
        <span className="icon-[glyphs-poly--folder] size-5"></span>
        {props.item.clip.files.length} files
      </div>
      <HighlightText {...props} />
    </>
  );
}

function PasteMenu(props: { clip: Clip; onSuccess: () => void }) {
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

  const cleanupRef = useRef<(() => void) | null>(null);

  const refCallback = useCallback((menuRef: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (menuRef !== null) {
      function focusMove(e: KeyboardEvent) {
        switch (e.key) {
          case 'ArrowUp':
            if (menuRef && document.activeElement) {
              const focusable = Array.from(menuRef.querySelectorAll(FOCUSABLE_SELECTOR));
              const index = focusable.indexOf(document.activeElement);

              const nextIndex = (index - 1 + focusable.length) % focusable.length;
              const nextElement = focusable[nextIndex];
              if (nextElement instanceof HTMLElement) {
                nextElement.focus();
                e.preventDefault();
              }
            }
            return;
          case 'ArrowDown':
            if (menuRef && document.activeElement) {
              const focusable = Array.from(menuRef.querySelectorAll(FOCUSABLE_SELECTOR));
              const index = focusable.indexOf(document.activeElement);

              const nextIndex = (index + 1) % focusable.length;
              const nextElement = focusable[nextIndex];
              if (nextElement instanceof HTMLElement) {
                nextElement.focus();
                e.preventDefault();
              }
            }
            return;
        }
      }

      menuRef.addEventListener('keydown', focusMove);

      cleanupRef.current = () => {
        menuRef.removeEventListener('keydown', focusMove);
      };
    }
  }, []);

  return (
    <div
      ref={refCallback}
      className={cn(
        'bg-slate-100 text-slate-900',
        'dark:bg-zinc-900 dark:text-zinc-100',
        'shadow-black/20',
        'dark:shadow-white/20',
        'rounded-lg shadow-md',
        'text-sm',
      )}
    >
      <div className={cn('grid grid-cols-4 gap-x-1 rounded-md')}>
        {props.clip.plain_text && (
          <MenuButton
            type="button"
            autoFocus
            onClick={() => {
              void invoke.send_text(props.clip);
              props.onSuccess();
            }}
          >
            <span></span>
            <span>send</span>
            <span>text</span>
            <div className="flex items-center justify-center">
              <span className="icon-[humbleicons--text] size-4"></span>
            </div>
          </MenuButton>
        )}
        {props.clip.plain_text && (
          <MenuButton
            type="button"
            onClick={() => {
              void invoke.paste_text(props.clip);
              props.onSuccess();
            }}
          >
            <div className="flex items-center justify-center">
              <span className="icon-[material-symbols--chat-paste-go-outline-rounded] size-4"></span>
            </div>
            <span>paste</span>
            <span>text</span>
            <span></span>
          </MenuButton>
        )}

        {props.clip.image_hash && (
          <MenuButton
            type="button"
            autoFocus={!props.clip.plain_text}
            onClick={() => {
              void invoke.send_image(props.clip);
              props.onSuccess();
            }}
          >
            <span></span>
            <span>send</span>
            <span>image</span>
            <div className="flex items-center justify-center">
              <span className="icon-[humbleicons--image] size-4"></span>
            </div>
          </MenuButton>
        )}
        {props.clip.image_hash && (
          <MenuButton
            type="button"
            onClick={() => {
              void invoke.paste_image(props.clip);
              props.onSuccess();
            }}
          >
            <div className="flex items-center justify-center">
              <span className="icon-[material-symbols--chat-paste-go-outline-rounded] size-4"></span>
            </div>
            <span>paste</span>
            <span>image</span>
            <span></span>
          </MenuButton>
        )}

        {props.clip.files.length > 0 && (
          <MenuButton
            type="button"
            autoFocus={!props.clip.plain_text && !props.clip.image_hash}
            onClick={() => {
              void invoke.send_files(props.clip);
              props.onSuccess();
            }}
          >
            <span></span>
            <span>send</span>
            <span>files</span>
            <div className="flex items-center justify-center">
              <span className="icon-[humbleicons--folder] size-4"></span>
            </div>
          </MenuButton>
        )}
        {props.clip.files.length > 0 && (
          <MenuButton
            type="button"
            onClick={() => {
              void invoke.paste_files(props.clip);
              props.onSuccess();
            }}
          >
            <div className="flex items-center justify-center">
              <span className="icon-[material-symbols--chat-paste-go-outline-rounded] size-4"></span>
            </div>
            <span>paste</span>
            <span>files</span>
            <span></span>
          </MenuButton>
        )}

        <MenuButton
          type="button"
          onClick={() => {
            void invoke.delete_clip(props.clip);
            props.onSuccess();
          }}
        >
          <div className="flex items-center justify-center">
            <span className="icon-[cuida--trash-outline] size-4"></span>
          </div>
          <span>delete</span>
          <span>clip</span>
          <span></span>
        </MenuButton>
      </div>
    </div>
  );
}

type MenuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};
function MenuButton({
  className,
  children,
  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  },
  ...props
}: MenuButtonProps) {
  return (
    <button
      {...props}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center justify-center capitalize transition',
        'outline-none first:rounded-t-md last:rounded-b-md',
        'p-2',
        'focus:scale-[102%]',
        'bg-white text-slate-500',
        'dark:bg-zinc-900 dark:text-zinc-500',
        'hover:text-slate-900 focus:text-slate-900',
        'dark:hover:text-zinc-100 dark:focus:text-zinc-100',
        'hover:bg-slate-100 focus:bg-slate-100',
        'dark:hover:bg-black dark:focus:bg-black',
        'col-span-4 grid grid-cols-subgrid',
        className,
      )}
    >
      {children}
    </button>
  );
}
