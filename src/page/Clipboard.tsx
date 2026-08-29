import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { join } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import mediumZoom from 'medium-zoom';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { Position } from '~/plugin/dialogContext';

import { FOCUSABLE_SELECTOR } from '~/App';
import invoke, { type Clip, type Searched } from '~/command';
import { Button } from '~/component/Button';
import { cn, usePortalTarget } from '~/lib/utils';
import { useDialog } from '~/plugin/useDialog';
import { matchShortcut, type Theme, type useStore } from '~/plugin/useStore';

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

  const clearClipBoard = useCallback(
    async function () {
      await $dialog.confirm.warn('Are you sure you want to clear all clipboard history?');

      await invoke.clear_clipboard();
      setClipboard([]);
    },
    [$dialog],
  );

  const toggleClipBookmark = useCallback(async function (clip: Clip) {
    const updatedClip = { ...clip, bookmark: !clip.bookmark };
    setClipboard((clipboard) =>
      clipboard.map((item) => (item.clip.id === clip.id ? { ...item, clip: updatedClip } : item)),
    );
    return invoke.update_clip_bookmark({ ...updatedClip });
  }, []);

  const showPasteMenu = useCallback(
    async function (clip: Clip, position: Position) {
      const buttonCount =
        (clip.plain_text ? 2 : 0) + // plain_text
        (clip.image_hash ? 2 : 0) + // image_hash
        (clip.files.length > 0 ? 2 : 0) + // files
        (clip.image_hash && (clip.content_type === 'image' || props.showSubContents) ? 1 : 0) + // zoom
        1; // delete

      const height = buttonCount * 28 + 4;
      const width = 144;

      return $dialog.showModal(
        PasteMenu,
        (resolve) => ({
          clip,
          showSubContents: props.showSubContents,
          theme: props.theme,
          onSuccess: () => resolve('ok'),
          onDelete: (clip) => {
            void deleteClip(clip);
            resolve('ok');
          },
        }),
        {
          showCloseButton: false,
          fixed: {
            height,
            width,
            position,
          },
        },
      );
    },
    [$dialog, deleteClip, props.showSubContents, props.theme],
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
            activeItemRef.current.scrollIntoView({
              block: 'nearest', // 画面外に出たときだけ最小限スクロール
              inline: 'nearest',
            });

            const position = activeItemRef.current.getBoundingClientRect();
            void showPasteMenu(selected.clip, {
              top: position.top,
              bottom: position.bottom,
              right: position.right,
              left: window.innerWidth, // 内容が隠れないように常に右側に表示するため
            });
          }
        } else {
          modalDialog.close();
        }
        return;
      }

      if (modalDialog) {
        return;
      }

      const mediumZoomImageOpened = document.querySelector('.medium-zoom-image--opened');
      if (mediumZoomImageOpened) {
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

      if (matchShortcut(e, props.shortcutDeleteClip)) {
        e.preventDefault();
        const selected = clipboard[cursor];
        if (selected != null) {
          void deleteClip(selected.clip);
        }
        return;
      }

      if (matchShortcut(e, props.shortcutClearClipboard)) {
        e.preventDefault();
        void clearClipBoard();
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
    props.shortcutClearClipboard,
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
    clearClipBoard,
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

  const portalFooterLeft = usePortalTarget('portal-footer-left');
  const portalFooterMiddle = usePortalTarget('portal-footer-middle');

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
                onContextMenu={(e) => {
                  e.preventDefault();

                  setCursor(i);
                  const position = {
                    top: e.clientY,
                    left: e.clientX,
                    bottom: e.clientY,
                    right: e.clientX,
                  };
                  void showPasteMenu(item.clip, position);
                }}
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

                    setCursor(i);
                    const position = e.currentTarget.getBoundingClientRect();
                    void showPasteMenu(item.clip, position);
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

      {portalFooterLeft &&
        createPortal(
          <>
            <Button
              title="wrap text"
              type="button"
              set={props.wrapTextAutomatically ? 'positive' : 'ghost'}
              onClick={(e) => {
                e.preventDefault();
                void saveWrapTextAutomatically((prev) => !prev);
              }}
            >
              <span className="icon-[pajamas--soft-wrap] size-4"></span>
            </Button>

            <Button
              title="show sub contents"
              type="button"
              set={props.showSubContents ? 'positive' : 'ghost'}
              onClick={(e) => {
                e.preventDefault();
                void saveShowSubContents((prev) => !prev);
              }}
            >
              <span className="icon-[fluent--content-view-32-regular] size-4"></span>
            </Button>
          </>,
          portalFooterLeft,
        )}

      {portalFooterMiddle &&
        createPortal(
          <>
            <Button
              title="clear"
              type="button"
              set="ghost"
              onClick={async (e) => {
                e.preventDefault();

                void clearClipBoard();
              }}
            >
              <span className="icon-[codicon--clear-all] size-4"></span>
            </Button>
          </>,
          portalFooterMiddle,
        )}
    </>
  );
}

type ClipContainerProps = Pick<
  ReturnType<typeof useStore>,
  'wrapTextAutomatically' | 'appLocalDataDir' | 'showSubContents'
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
        id={`image-${props.item.clip.id}`}
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

function PasteMenu(props: {
  clip: Clip;
  showSubContents: boolean;
  theme: Theme;
  onSuccess: () => void;
  onDelete: (clip: Clip) => void;
}) {
  useEffect(() => {
    function closeDialog(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation(); // App.tsx の hideWindow に突き抜けないようにする
      }
    }
    function preventContextMenu(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
    }

    window.addEventListener('keydown', closeDialog, true);
    window.addEventListener('contextmenu', preventContextMenu, true);

    return () => {
      window.removeEventListener('keydown', closeDialog, true);
      window.removeEventListener('contextmenu', preventContextMenu, true);
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
        'border-slate-300 bg-white text-slate-900',
        'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
        'rounded-lg px-0.75 py-px shadow-md',
        'border text-sm',
      )}
    >
      <div className={cn('flex flex-col gap-x-1 rounded-md')}>
        {props.clip.plain_text && (
          <MenuButton
            type="button"
            autoFocus
            className="after:icon-[humbleicons--text]"
            onClick={() => {
              void invoke.send_text(props.clip);
              props.onSuccess();
            }}
          >
            send text
          </MenuButton>
        )}
        {props.clip.plain_text && (
          <MenuButton
            type="button"
            className="before:icon-[material-symbols--chat-paste-go-outline-rounded]"
            onClick={() => {
              void invoke.paste_text(props.clip);
              props.onSuccess();
            }}
          >
            paste text
          </MenuButton>
        )}

        {props.clip.image_hash && (
          <MenuButton
            type="button"
            autoFocus={!props.clip.plain_text}
            className="after:icon-[humbleicons--image]"
            onClick={() => {
              void invoke.send_image(props.clip);
              props.onSuccess();
            }}
          >
            send image
          </MenuButton>
        )}
        {props.clip.image_hash && (
          <MenuButton
            type="button"
            className="before:icon-[material-symbols--chat-paste-go-outline-rounded]"
            onClick={() => {
              void invoke.paste_image(props.clip);
              props.onSuccess();
            }}
          >
            paste image
          </MenuButton>
        )}

        {props.clip.files.length > 0 && (
          <MenuButton
            type="button"
            autoFocus={!props.clip.plain_text && !props.clip.image_hash}
            className="after:icon-[humbleicons--folder]"
            onClick={() => {
              void invoke.send_files(props.clip);
              props.onSuccess();
            }}
          >
            send files
          </MenuButton>
        )}
        {props.clip.files.length > 0 && (
          <MenuButton
            type="button"
            className="before:icon-[material-symbols--chat-paste-go-outline-rounded]"
            onClick={() => {
              void invoke.paste_files(props.clip);
              props.onSuccess();
            }}
          >
            paste files
          </MenuButton>
        )}

        {props.clip.image_hash &&
          (props.clip.content_type === 'image' || props.showSubContents) && (
            <MenuButton
              type="button"
              className="before:icon-[akar-icons--zoom-in]"
              onClick={async () => {
                const zoom = mediumZoom(`#image-${props.clip.id}`, {
                  background: props.theme === 'dark' ? '#000' : '#fff',
                });

                void zoom.open();

                props.onSuccess();
              }}
            >
              zoom image
            </MenuButton>
          )}

        <MenuButton
          type="button"
          className="before:icon-[cuida--trash-outline]"
          onClick={() => {
            props.onDelete(props.clip);
          }}
        >
          delete clip
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
        'flex w-36 items-center justify-center capitalize transition',
        'outline-none first:rounded-t-md last:rounded-b-md',
        'p-1',
        'hover:scale-105 focus:scale-105',
        'bg-white text-slate-500',
        'dark:bg-zinc-900 dark:text-zinc-500',
        'hover:text-slate-900 focus:text-slate-900',
        'dark:hover:text-zinc-100 dark:focus:text-zinc-100',
        'hover:bg-slate-100 focus:bg-slate-100',
        'dark:hover:bg-black dark:focus:bg-black',
        'relative',
        "before:content-[''] after:content-['']",
        'before:absolute before:top-1/2 before:left-2 before:size-4 before:-translate-y-1/2',
        'after:absolute after:top-1/2 after:right-2 after:size-4 after:-translate-y-1/2',
        className,
      )}
    >
      {children}
    </button>
  );
}
