import { getVersion } from '@tauri-apps/api/app';
import { appLocalDataDir as getAppLocalDataDir } from '@tauri-apps/api/path';
import { Store } from '@tauri-apps/plugin-store';
import { useCallback, useEffect, useState } from 'react';

import { command, type ContentType, type SearchMode } from '~/command';

export type Theme = 'light' | 'dark';
export type Page = 'clipboard' | 'setting' | 'information';

export type Shortcut = {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  code: string;
};

const STORE = {
  appearance: {
    PIN: 'pin',
    THEME: 'theme',
    FONT: 'font',
    MIN_HEIGHT: 'min_height',
    MAX_HEIGHT: 'max_height',
    WRAP_TEXT_AUTOMATICALLY: 'wrap_text_automatically',
    SHOW_SUB_CONTENTS: 'show_sub_contents',
  },
  behavior: {
    HISTORY_SIZE: 'history_size',
    MAX_ITEMS: 'max_items',
    TRIM_FINAL_NEWLINES: 'trim_final_newlines',
    ENABLE_OCR: 'enable_ocr',
  },
  global_shortcut: {
    TOGGLE_WINDOW: 'toggle_window',
  },
  app_shortcut: {
    SEND_CLIPBOARD: 'send_clipboard',
    SEND_AND_PASTE: 'send_and_paste',
    DELETE_CLIP: 'delete_clip',
    CLEAR_CLIPBOARD: 'clear_clipboard',
    TOGGLE_CLIP_BOOKMARK: 'toggle_clip_bookmark',
    SHOW_PASTE_MENU: 'show_paste_menu',
    TOGGLE_SEARCH_CONTENT_TYPE_TEXT: 'toggle_search_content_type_text',
    TOGGLE_SEARCH_CONTENT_TYPE_IMAGE: 'toggle_search_content_type_image',
    TOGGLE_SEARCH_CONTENT_TYPE_FILES: 'toggle_search_content_type_files',
    TOGGLE_SEARCH_BOOKMARK: 'toggle_search_bookmark',
    TOGGLE_SEARCH_MODE: 'toggle_search_mode',
    TOGGLE_WRAP_TEXT_AUTOMATICALLY: 'toggle_wrap_text_automatically',
    TOGGLE_SHOW_SUB_CONTENTS: 'toggle_show_sub_contents',
  },
  state: {
    SEARCH_CONTENT_TYPE: 'search_content_type',
    SEARCH_BOOKMARK: 'search_bookmark',
    SEARCH_MODE: 'search_mode',
  },
} as const;

export const defaultGlobalShortcutToggleWindow: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'KeyV',
};
export const defaultShortcutSendClipboard: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  code: 'Enter',
};
export const defaultShortcutSendAndPaste: Shortcut = {
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  code: 'Enter',
};
export const defaultShortcutDeleteClip: Shortcut = {
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  code: 'KeyD',
};
export const defaultShortcutClearClipboard: Shortcut = {
  ctrlKey: true,
  shiftKey: true,
  altKey: false,
  metaKey: false,
  code: 'KeyD',
};
export const defaultShortcutShowPasteMenu: Shortcut = {
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  code: 'KeyP',
};
export const defaultShortcutToggleClipBookmark: Shortcut = {
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  code: 'KeyB',
};
export const defaultShortcutToggleSearchContentTypeText: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'KeyT',
};
export const defaultShortcutToggleSearchContentTypeImage: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'KeyI',
};
export const defaultShortcutToggleSearchContentTypeFiles: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'KeyF',
};
export const defaultShortcutToggleSearchBookmark: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'KeyB',
};
export const defaultShortcutToggleSearchMode: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'KeyS',
};
export const defaultShortcutToggleWrapTextAutomatically: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'Comma',
};
export const defaultShortcutToggleShowSubContents: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: true,
  metaKey: false,
  code: 'Period',
};

export const defaultTheme = 'dark';
export const defaultFont = '';
export const defaultMinHeight = 100;
export const defaultMaxHeight = 800;
export const defaultWrapTextAutomatically = true;
export const defaultShowSubContents = true;

export const defaultHistorySize = 10000;
export const defaultMaxItems = 50;
export const defaultTrimFinalNewlines = true;
export const defaultEnableOCR = false;

export function useStore() {
  const [store, setStore] = useState<Store>();

  // appearance
  const [enablePin, setEnablePin] = useState(false);
  async function saveEnablePin(v: boolean) {
    setEnablePin(v);
    await store?.set(STORE.appearance.PIN, v);
    await store?.save();
  }

  const [theme, setTheme] = useState<Theme>(defaultTheme);
  async function saveTheme(v: Theme) {
    setTheme(v);
    applyTheme(v);
    await store?.set(STORE.appearance.THEME, v);
    await store?.save();
  }

  function applyTheme(v: Theme) {
    if (v === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  const [font, setFont] = useState<string>(defaultFont);
  async function saveAndApplyFont(v: string) {
    setFont(v);
    applyFont(v);
    await store?.set(STORE.appearance.FONT, v);
    await store?.save();
  }
  function applyFont(v: string) {
    if (v) {
      document.documentElement.style.setProperty('--user-font', `"${v}"`);
    } else {
      document.documentElement.style.removeProperty('--user-font');
    }
  }

  const [systemFontList, setSystemFontList] = useState<string[]>([]);

  const [minHeight, setMinHeight] = useState(defaultMinHeight);
  async function saveMinHeight(v: number) {
    setMinHeight(v);
    await store?.set(STORE.appearance.MIN_HEIGHT, v);
    await store?.save();
  }

  const [maxHeight, setMaxHeight] = useState(defaultMaxHeight);
  async function saveMaxHeight(v: number) {
    setMaxHeight(v);
    await store?.set(STORE.appearance.MAX_HEIGHT, v);
    await store?.save();
  }

  const [wrapTextAutomatically, setWrapTextAutomatically] = useState(defaultWrapTextAutomatically);
  async function saveWrapTextAutomatically(v: boolean) {
    setWrapTextAutomatically(v);
    await store?.set(STORE.appearance.WRAP_TEXT_AUTOMATICALLY, v);
    await store?.save();
  }

  const [showSubContents, setShowSubContents] = useState(defaultShowSubContents);
  async function saveShowSubContents(v: boolean) {
    setShowSubContents(v);
    await store?.set(STORE.appearance.SHOW_SUB_CONTENTS, v);
    await store?.save();
  }

  // behavior
  const [historySize, setHistorySize] = useState(defaultHistorySize);
  async function saveHistorySize(v: number) {
    setHistorySize(v);
    await store?.set(STORE.behavior.HISTORY_SIZE, v);
    await store?.save();
  }

  const [maxItems, setMaxItems] = useState(defaultMaxItems);
  async function saveMaxItems(v: number) {
    setMaxItems(v);
    await store?.set(STORE.behavior.MAX_ITEMS, v);
    await store?.save();
  }

  const [trimFinalNewlines, setTrimFinalNewlines] = useState(defaultTrimFinalNewlines);
  async function saveTrimFinalNewlines(v: boolean) {
    setTrimFinalNewlines(v);
    await store?.set(STORE.behavior.TRIM_FINAL_NEWLINES, v);
    await store?.save();
  }

  const [ocr, setOCR] = useState('');
  const [enableOCR, setEnableOCR] = useState(defaultEnableOCR);
  async function saveEnableOCR(v: boolean) {
    setEnableOCR(v);
    await store?.set(STORE.behavior.ENABLE_OCR, v);
    await store?.save();
  }

  // state
  const [page, setPage] = useState<Page>('clipboard');

  const [searchMode, setSearchMode] = useState<SearchMode>('fuzzy');
  const saveSearchMode = useCallback(
    async (v: SearchMode) => {
      setSearchMode(v);
      await store?.set(STORE.state.SEARCH_MODE, v);
      await store?.save();
    },
    [store],
  );

  const [searchContentType, setSearchContentType] = useState<ContentType[]>([]);
  const saveSearchContentType = useCallback(
    async (v: ContentType[]) => {
      setSearchContentType(v);
      await store?.set(STORE.state.SEARCH_CONTENT_TYPE, v);
      await store?.save();
    },
    [store],
  );

  const [searchBookmark, setSearchBookmark] = useState<boolean[]>([true, false]);
  const saveSearchBookmark = useCallback(
    async (v: boolean[]) => {
      setSearchBookmark(v);
      await store?.set(STORE.state.SEARCH_BOOKMARK, v);
      await store?.save();
    },
    [store],
  );

  // information
  const [version, setVersion] = useState<string>('');
  const [realAppLocalDataDir, setRealAppLocalDataDir] = useState('');
  const [realAppDataDir, setRealAppDataDir] = useState('');
  const [appLocalDataDir, setAppLocalDataDir] = useState('');

  // shortcut
  const [globalShortcutToggleWindow, setGlobalShortcutToggleWindow] = useState<Shortcut>(
    defaultGlobalShortcutToggleWindow,
  );

  const [shortcutSendClipboard, setShortcutSendClipboard] = useState<Shortcut>(
    defaultShortcutSendClipboard,
  );
  async function saveShortcutSendClipboard(v: Shortcut) {
    setShortcutSendClipboard(v);
    await store?.set(STORE.app_shortcut.SEND_CLIPBOARD, v);
    await store?.save();
  }
  const [shortcutSendAndPaste, setShortcutSendAndPaste] = useState<Shortcut>(
    defaultShortcutSendAndPaste,
  );
  async function saveShortcutSendAndPaste(v: Shortcut) {
    setShortcutSendAndPaste(v);
    await store?.set(STORE.app_shortcut.SEND_AND_PASTE, v);
    await store?.save();
  }

  const [shortcutDeleteClip, setShortcutDeleteClip] = useState<Shortcut>(defaultShortcutDeleteClip);
  async function saveShortcutDeleteClip(v: Shortcut) {
    setShortcutDeleteClip(v);
    await store?.set(STORE.app_shortcut.DELETE_CLIP, v);
    await store?.save();
  }

  const [shortcutClearClipboard, setShortcutClearClipboard] = useState<Shortcut>(
    defaultShortcutClearClipboard,
  );
  async function saveShortcutClearClipboard(v: Shortcut) {
    setShortcutClearClipboard(v);
    await store?.set(STORE.app_shortcut.CLEAR_CLIPBOARD, v);
    await store?.save();
  }

  const [shortcutShowPasteMenu, setShortcutShowPasteMenu] = useState<Shortcut>(
    defaultShortcutShowPasteMenu,
  );
  async function saveShortcutShowPasteMenu(v: Shortcut) {
    setShortcutShowPasteMenu(v);
    await store?.set(STORE.app_shortcut.SHOW_PASTE_MENU, v);
    await store?.save();
  }

  const [shortcutToggleClipBookmark, setShortcutToggleClipBookmark] = useState<Shortcut>(
    defaultShortcutToggleClipBookmark,
  );
  async function saveShortcutToggleClipBookmark(v: Shortcut) {
    setShortcutToggleClipBookmark(v);
    await store?.set(STORE.app_shortcut.TOGGLE_CLIP_BOOKMARK, v);
    await store?.save();
  }

  const [shortcutToggleSearchContentTypeText, setShortcutToggleSearchContentTypeText] =
    useState<Shortcut>(defaultShortcutToggleSearchContentTypeText);
  async function saveShortcutToggleSearchContentTypeText(v: Shortcut) {
    setShortcutToggleSearchContentTypeText(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_TEXT, v);
    await store?.save();
  }

  const [shortcutToggleSearchContentTypeImage, setShortcutToggleSearchContentTypeImage] =
    useState<Shortcut>(defaultShortcutToggleSearchContentTypeImage);
  async function saveShortcutToggleSearchContentTypeImage(v: Shortcut) {
    setShortcutToggleSearchContentTypeImage(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_IMAGE, v);
    await store?.save();
  }

  const [shortcutToggleSearchContentTypeFiles, setShortcutToggleSearchContentTypeFiles] =
    useState<Shortcut>(defaultShortcutToggleSearchContentTypeFiles);
  async function saveShortcutToggleSearchContentTypeFiles(v: Shortcut) {
    setShortcutToggleSearchContentTypeFiles(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_FILES, v);
    await store?.save();
  }

  const [shortcutToggleSearchBookmark, setShortcutToggleSearchBookmark] = useState<Shortcut>(
    defaultShortcutToggleSearchBookmark,
  );
  async function saveShortcutToggleSearchBookmark(v: Shortcut) {
    setShortcutToggleSearchBookmark(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_BOOKMARK, v);
    await store?.save();
  }

  const [shortcutToggleSearchMode, setShortcutToggleSearchMode] = useState<Shortcut>(
    defaultShortcutToggleSearchMode,
  );
  async function saveShortcutToggleSearchMode(v: Shortcut) {
    setShortcutToggleSearchMode(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_MODE, v);
    await store?.save();
  }

  const [shortcutToggleWrapTextAutomatically, setShortcutToggleWrapTextAutomatically] =
    useState<Shortcut>(defaultShortcutToggleWrapTextAutomatically);
  async function saveShortcutToggleWrapTextAutomatically(v: Shortcut) {
    setShortcutToggleWrapTextAutomatically(v);
    await store?.set(STORE.app_shortcut.TOGGLE_WRAP_TEXT_AUTOMATICALLY, v);
    await store?.save();
  }

  const [shortcutToggleShowSubContents, setShortcutToggleShowSubContents] = useState<Shortcut>(
    defaultShortcutToggleShowSubContents,
  );
  async function saveShortcutToggleShowSubContents(v: Shortcut) {
    setShortcutToggleShowSubContents(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SHOW_SUB_CONTENTS, v);
    await store?.save();
  }

  useEffect(() => {
    void (async () => {
      // %USERPROFILE%\AppData\Roaming\oktntko.clinder
      const store = await Store.load('settings.json');
      setStore(store);

      void store?.get<boolean>(STORE.appearance.PIN).then((v) => setEnablePin(v ?? false));
      void store
        ?.get<Theme>(STORE.appearance.THEME)
        .then((v) => v ?? defaultTheme)
        .then((v) => {
          setTheme(v);
          applyTheme(v);
        });
      void store
        ?.get<string>(STORE.appearance.FONT)
        .then((v) => v ?? defaultFont)
        .then((v) => {
          setFont(v);
          applyFont(v);
        });
      void command.list_system_font().then(setSystemFontList);
      void store
        ?.get<number>(STORE.appearance.MIN_HEIGHT)
        .then((v) => setMinHeight(v ?? defaultMinHeight));
      void store
        ?.get<number>(STORE.appearance.MAX_HEIGHT)
        .then((v) => setMaxHeight(v ?? defaultMaxHeight));
      void store
        ?.get<boolean>(STORE.appearance.WRAP_TEXT_AUTOMATICALLY)
        .then((v) => setWrapTextAutomatically(v ?? defaultWrapTextAutomatically));
      void store
        ?.get<boolean>(STORE.appearance.SHOW_SUB_CONTENTS)
        .then((v) => setShowSubContents(v ?? defaultShowSubContents));

      void store
        ?.get<number>(STORE.behavior.HISTORY_SIZE)
        .then((v) => setHistorySize(v ?? defaultHistorySize));
      void store
        ?.get<number>(STORE.behavior.MAX_ITEMS)
        .then((v) => setMaxItems(v ?? defaultMaxItems));
      void store
        ?.get<boolean>(STORE.behavior.TRIM_FINAL_NEWLINES)
        .then((v) => setTrimFinalNewlines(v ?? defaultTrimFinalNewlines));

      void command.get_ocr_language().then(setOCR);
      void store
        ?.get<boolean>(STORE.behavior.ENABLE_OCR)
        .then((v) => setEnableOCR(v ?? defaultEnableOCR));

      void store?.get<SearchMode>(STORE.state.SEARCH_MODE).then((v) => setSearchMode(v ?? 'fuzzy'));
      void store
        ?.get<ContentType[]>(STORE.state.SEARCH_CONTENT_TYPE)
        .then((v) => setSearchContentType(v ?? []));
      void store
        ?.get<boolean[]>(STORE.state.SEARCH_BOOKMARK)
        .then((v) => setSearchBookmark(v ?? [true, false]));

      void getVersion().then(setVersion);
      void command.get_real_app_local_data_dir().then(setRealAppLocalDataDir);
      void command.get_real_app_data_dir().then(setRealAppDataDir);
      void getAppLocalDataDir().then(setAppLocalDataDir);

      await store
        ?.get<Shortcut>(STORE.global_shortcut.TOGGLE_WINDOW)
        .then((v) => setGlobalShortcutToggleWindow(v ?? defaultGlobalShortcutToggleWindow));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.SEND_CLIPBOARD)
        .then((v) => setShortcutSendClipboard(v ?? defaultShortcutSendClipboard));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.SEND_AND_PASTE)
        .then((v) => setShortcutSendAndPaste(v ?? defaultShortcutSendAndPaste));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.DELETE_CLIP)
        .then((v) => setShortcutDeleteClip(v ?? defaultShortcutDeleteClip));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.CLEAR_CLIPBOARD)
        .then((v) => setShortcutClearClipboard(v ?? defaultShortcutClearClipboard));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.SHOW_PASTE_MENU)
        .then((v) => setShortcutShowPasteMenu(v ?? defaultShortcutShowPasteMenu));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_CLIP_BOOKMARK)
        .then((v) => setShortcutToggleClipBookmark(v ?? defaultShortcutToggleClipBookmark));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_TEXT)
        .then((v) =>
          setShortcutToggleSearchContentTypeText(v ?? defaultShortcutToggleSearchContentTypeText),
        );
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_IMAGE)
        .then((v) =>
          setShortcutToggleSearchContentTypeImage(v ?? defaultShortcutToggleSearchContentTypeImage),
        );
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_FILES)
        .then((v) =>
          setShortcutToggleSearchContentTypeFiles(v ?? defaultShortcutToggleSearchContentTypeFiles),
        );
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_BOOKMARK)
        .then((v) => setShortcutToggleSearchBookmark(v ?? defaultShortcutToggleSearchBookmark));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_MODE)
        .then((v) => setShortcutToggleSearchMode(v ?? defaultShortcutToggleSearchMode));
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_WRAP_TEXT_AUTOMATICALLY)
        .then((v) =>
          setShortcutToggleWrapTextAutomatically(v ?? defaultShortcutToggleWrapTextAutomatically),
        );
      void store
        ?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SHOW_SUB_CONTENTS)
        .then((v) => setShortcutToggleShowSubContents(v ?? defaultShortcutToggleShowSubContents));
    })();

    return () => undefined;
  }, []);

  return {
    enablePin,
    saveEnablePin,
    theme,
    saveTheme,
    font,
    saveAndApplyFont,
    systemFontList,

    minHeight,
    saveMinHeight,
    maxHeight,
    saveMaxHeight,
    wrapTextAutomatically,
    saveWrapTextAutomatically,
    showSubContents,
    saveShowSubContents,

    historySize,
    saveHistorySize,
    maxItems,
    saveMaxItems,
    trimFinalNewlines,
    saveTrimFinalNewlines,
    ocr,
    enableOCR,
    saveEnableOCR,

    page,
    setPage,
    searchMode,
    saveSearchMode,
    searchContentType,
    saveSearchContentType,
    searchBookmark,
    saveSearchBookmark,

    version,
    realAppLocalDataDir,
    realAppDataDir,
    appLocalDataDir,

    globalShortcutToggleWindow,
    setGlobalShortcutToggleWindow,
    shortcutSendClipboard,
    saveShortcutSendClipboard,
    shortcutSendAndPaste,
    saveShortcutSendAndPaste,
    shortcutDeleteClip,
    saveShortcutDeleteClip,
    shortcutClearClipboard,
    saveShortcutClearClipboard,
    shortcutShowPasteMenu,
    saveShortcutShowPasteMenu,
    shortcutToggleClipBookmark,
    saveShortcutToggleClipBookmark,
    shortcutToggleSearchContentTypeText,
    saveShortcutToggleSearchContentTypeText,
    shortcutToggleSearchContentTypeImage,
    saveShortcutToggleSearchContentTypeImage,
    shortcutToggleSearchContentTypeFiles,
    saveShortcutToggleSearchContentTypeFiles,
    shortcutToggleSearchBookmark,
    saveShortcutToggleSearchBookmark,
    shortcutToggleSearchMode,
    saveShortcutToggleSearchMode,
    shortcutToggleWrapTextAutomatically,
    saveShortcutToggleWrapTextAutomatically,
    shortcutToggleShowSubContents,
    saveShortcutToggleShowSubContents,
  };
}

export function matchShortcut(e: Shortcut, shortcut: Shortcut) {
  return (
    e.ctrlKey === shortcut.ctrlKey &&
    e.shiftKey === shortcut.shiftKey &&
    e.altKey === shortcut.altKey &&
    e.metaKey === shortcut.metaKey &&
    e.code === shortcut.code
  );
}
