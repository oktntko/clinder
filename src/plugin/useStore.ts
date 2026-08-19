import { getVersion } from '@tauri-apps/api/app';
import { Store } from '@tauri-apps/plugin-store';
import { useCallback, useEffect, useState, type SetStateAction } from 'react';

import invoke, { type ContentType, type SearchMode } from '~/command';

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
  setting: {
    HISTORY_SIZE: 'history_size',
  },
  appearance: {
    PIN: 'pin',
    THEME: 'theme',
    FONT: 'font',
    MIN_HEIGHT: 'min_height',
    MAX_HEIGHT: 'max_height',
  },
  global_shortcut: {
    TOGGLE_WINDOW: 'toggle_window',
  },
  app_shortcut: {
    SEND_AND_PASTE: 'send_and_paste',
    SEND_CLIPBOARD: 'send_clipboard',
    DELETE_CLIP: 'delete_clip',
    TOGGLE_CLIP_BOOKMARK: 'toggle_clip_bookmark',
    TOGGLE_SEARCH_CONTENT_TYPE_TEXT: 'toggle_search_content_type_text',
    TOGGLE_SEARCH_CONTENT_TYPE_IMAGE: 'toggle_search_content_type_image',
    TOGGLE_SEARCH_BOOKMARK: 'toggle_search_bookmark',
    TOGGLE_SEARCH_MODE: 'toggle_search_mode',
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
export const defaultShortcutSendAndPaste: Shortcut = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  code: 'Enter',
};
export const defaultShortcutSendClipboard: Shortcut = {
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
  code: 'KeyF',
};

export function useStore() {
  const [store, setStore] = useState<Store>();

  // window setting
  const [enablePin, setEnablePin] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [page, setPage] = useState<Page>('clipboard');
  const [font, setFont] = useState<string>('');
  const [systemFontList, setSystemFontList] = useState<string[]>([]);
  const [minHeight, setMinHeight] = useState(100);
  const [maxHeight, setMaxHeight] = useState(800);

  // search input
  const [searchMode, setSearchMode] = useState<SearchMode>('fuzzy');
  const [searchContentType, setSearchContentType] = useState<ContentType[]>([]);
  const [searchBookmark, setSearchBookmark] = useState<boolean[]>([true, false]);

  const [historySize, setHistorySize] = useState<number>(0);

  // information
  const [version, setVersion] = useState<string>('');
  const [appLocalDataDir, setAppLocalDataDir] = useState<string>('');
  const [appDataDir, setAppDataDir] = useState('');

  // shortcut
  const [globalShortcutToggleWindow, setGlobalShortcutToggleWindow] = useState<Shortcut>(
    defaultGlobalShortcutToggleWindow,
  );
  const [shortcutSendAndPaste, setShortcutSendAndPaste] = useState<Shortcut>(
    defaultShortcutSendAndPaste,
  );
  const [shortcutSendClipboard, setShortcutSendClipboard] = useState<Shortcut>(
    defaultShortcutSendClipboard,
  );
  const [shortcutDeleteClip, setShortcutDeleteClip] = useState<Shortcut>(defaultShortcutDeleteClip);
  const [shortcutToggleClipBookmark, setShortcutToggleClipBookmark] = useState<Shortcut>(
    defaultShortcutToggleClipBookmark,
  );
  const [shortcutToggleSearchContentTypeText, setShortcutToggleSearchContentTypeText] =
    useState<Shortcut>(defaultShortcutToggleSearchContentTypeText);
  const [shortcutToggleSearchContentTypeImage, setShortcutToggleSearchContentTypeImage] =
    useState<Shortcut>(defaultShortcutToggleSearchContentTypeImage);
  const [shortcutToggleSearchBookmark, setShortcutToggleSearchBookmark] = useState<Shortcut>(
    defaultShortcutToggleSearchBookmark,
  );
  const [shortcutToggleSearchMode, setShortcutToggleSearchMode] = useState<Shortcut>(
    defaultShortcutToggleSearchMode,
  );

  useEffect(() => {
    void (async () => {
      // %USERPROFILE%\AppData\Roaming\oktntko.clinder
      const store = await Store.load('settings.json');
      setStore(store);

      async function getEnablePin(store: Store) {
        const v = await store?.get<boolean>(STORE.appearance.PIN);
        return v ?? false;
      }

      async function getTheme(store: Store) {
        const v = await store?.get<Theme>(STORE.appearance.THEME);
        return v ?? 'dark';
      }

      async function getSearchMode(store: Store) {
        const v = await store?.get<SearchMode>(STORE.state.SEARCH_MODE);
        return v ?? 'fuzzy';
      }

      async function getSearchContentType(store: Store) {
        const v = await store?.get<ContentType[]>(STORE.state.SEARCH_CONTENT_TYPE);
        return v ?? [];
      }

      async function getSearchBookmark(store: Store) {
        const v = await store?.get<boolean[]>(STORE.state.SEARCH_BOOKMARK);
        return v ?? [true, false];
      }

      async function getFont(store: Store) {
        const v = await store?.get<string>(STORE.appearance.FONT);
        return v ?? '';
      }

      async function getMinHeight(store: Store) {
        const v = await store?.get<number>(STORE.appearance.MIN_HEIGHT);
        return v ?? 100;
      }
      async function getMaxHeight(store: Store) {
        const v = await store?.get<number>(STORE.appearance.MAX_HEIGHT);
        return v ?? 800;
      }

      async function getHistorySize(store: Store) {
        const v = await store?.get<number>(STORE.setting.HISTORY_SIZE);
        return v ?? 0;
      }

      async function getGlobalShortcutToggleWindow(store: Store) {
        const v = await store?.get<Shortcut>(STORE.global_shortcut.TOGGLE_WINDOW);
        return v ?? defaultGlobalShortcutToggleWindow;
      }
      async function getShortcutSendAndPaste(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.SEND_AND_PASTE);
        return v ?? defaultShortcutSendAndPaste;
      }
      async function getShortcutSendClipboard(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.SEND_CLIPBOARD);
        return v ?? defaultShortcutSendClipboard;
      }
      async function getShortcutDeleteClip(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.DELETE_CLIP);
        return v ?? defaultShortcutDeleteClip;
      }
      async function getShortcutToggleClipBookmark(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.TOGGLE_CLIP_BOOKMARK);
        return v ?? defaultShortcutToggleClipBookmark;
      }
      async function getShortcutToggleSearchContentTypeText(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_TEXT);
        return v ?? defaultShortcutToggleSearchContentTypeText;
      }
      async function getShortcutToggleSearchContentTypeImage(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_IMAGE);
        return v ?? defaultShortcutToggleSearchContentTypeImage;
      }
      async function getShortcutToggleSearchBookmark(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_BOOKMARK);
        return v ?? defaultShortcutToggleSearchBookmark;
      }
      async function getShortcutToggleSearchMode(store: Store) {
        const v = await store?.get<Shortcut>(STORE.app_shortcut.TOGGLE_SEARCH_MODE);
        return v ?? defaultShortcutToggleSearchMode;
      }

      void getEnablePin(store).then(setEnablePin);
      void getTheme(store).then((v) => {
        setTheme(v);
        applyTheme(v);
      });
      void getSearchMode(store).then(setSearchMode);
      void getSearchContentType(store).then(setSearchContentType);
      void getSearchBookmark(store).then(setSearchBookmark);
      void getFont(store).then((v) => {
        setFont(v);
        applyFont(v);
      });
      void getMinHeight(store).then(setMinHeight);
      void getMaxHeight(store).then(setMaxHeight);
      void getHistorySize(store).then(setHistorySize);

      void invoke.list_system_font().then(setSystemFontList);

      void getVersion().then(setVersion);
      void invoke.get_app_local_data_dir().then(setAppLocalDataDir);
      void invoke.get_app_data_dir().then(setAppDataDir);

      void getGlobalShortcutToggleWindow(store).then(setGlobalShortcutToggleWindow);
      void getShortcutSendAndPaste(store).then(setShortcutSendAndPaste);
      void getShortcutSendClipboard(store).then(setShortcutSendClipboard);
      void getShortcutDeleteClip(store).then(setShortcutDeleteClip);
      void getShortcutToggleClipBookmark(store).then(setShortcutToggleClipBookmark);
      void getShortcutToggleSearchContentTypeText(store).then(
        setShortcutToggleSearchContentTypeText,
      );
      void getShortcutToggleSearchContentTypeImage(store).then(
        setShortcutToggleSearchContentTypeImage,
      );
      void getShortcutToggleSearchBookmark(store).then(setShortcutToggleSearchBookmark);
      void getShortcutToggleSearchMode(store).then(setShortcutToggleSearchMode);
    })();

    return () => undefined;
  }, []);

  async function saveEnablePin(v: SetStateAction<boolean>) {
    setEnablePin(v);
    await store?.set(STORE.appearance.PIN, v);
    await store?.save();
  }

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

  const saveSearchMode = useCallback(
    async (v: SetStateAction<SearchMode>) => {
      setSearchMode(v);
      await store?.set(STORE.state.SEARCH_MODE, v);
      await store?.save();
    },
    [store],
  );

  const saveSearchContentType = useCallback(
    async (v: SetStateAction<ContentType[]>) => {
      setSearchContentType(v);
      await store?.set(STORE.state.SEARCH_CONTENT_TYPE, v);
      await store?.save();
    },
    [store],
  );

  const saveSearchBookmark = useCallback(
    async (v: SetStateAction<boolean[]>) => {
      setSearchBookmark(v);
      await store?.set(STORE.state.SEARCH_CONTENT_TYPE, v);
      await store?.save();
    },
    [store],
  );

  function applyFont(v: string) {
    if (v) {
      document.documentElement.style.setProperty('--user-font', `"${v}"`);
    } else {
      document.documentElement.style.removeProperty('--user-font');
    }
  }

  async function saveAndApplyFont(v: string) {
    setFont(v);
    applyFont(v);
    await store?.set(STORE.appearance.FONT, v);
    await store?.save();
  }

  async function saveMinHeight(v: SetStateAction<number>) {
    setMinHeight(v);
    await store?.set(STORE.appearance.MIN_HEIGHT, v);
    await store?.save();
  }
  async function saveMaxHeight(v: SetStateAction<number>) {
    setMaxHeight(v);
    await store?.set(STORE.appearance.MAX_HEIGHT, v);
    await store?.save();
  }

  async function saveHistorySize(v: SetStateAction<number>) {
    setHistorySize(v);
    await store?.set(STORE.setting.HISTORY_SIZE, v);
    await store?.save();
  }

  async function saveShortcutSendAndPaste(v: SetStateAction<Shortcut>) {
    setShortcutSendAndPaste(v);
    await store?.set(STORE.app_shortcut.SEND_AND_PASTE, v);
    await store?.save();
  }
  async function saveShortcutSendClipboard(v: SetStateAction<Shortcut>) {
    setShortcutSendClipboard(v);
    await store?.set(STORE.app_shortcut.SEND_CLIPBOARD, v);
    await store?.save();
  }
  async function saveShortcutDeleteClip(v: SetStateAction<Shortcut>) {
    setShortcutDeleteClip(v);
    await store?.set(STORE.app_shortcut.DELETE_CLIP, v);
    await store?.save();
  }
  async function saveShortcutToggleClipBookmark(v: SetStateAction<Shortcut>) {
    setShortcutToggleClipBookmark(v);
    await store?.set(STORE.app_shortcut.TOGGLE_CLIP_BOOKMARK, v);
    await store?.save();
  }
  async function saveShortcutToggleSearchContentTypeText(v: SetStateAction<Shortcut>) {
    setShortcutToggleSearchContentTypeText(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_TEXT, v);
    await store?.save();
  }
  async function saveShortcutToggleSearchContentTypeImage(v: SetStateAction<Shortcut>) {
    setShortcutToggleSearchContentTypeImage(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_CONTENT_TYPE_IMAGE, v);
    await store?.save();
  }
  async function saveShortcutToggleSearchBookmark(v: SetStateAction<Shortcut>) {
    setShortcutToggleSearchBookmark(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_BOOKMARK, v);
    await store?.save();
  }
  async function saveShortcutToggleSearchMode(v: SetStateAction<Shortcut>) {
    setShortcutToggleSearchMode(v);
    await store?.set(STORE.app_shortcut.TOGGLE_SEARCH_MODE, v);
    await store?.save();
  }

  return {
    enablePin,
    saveEnablePin,
    theme,
    saveTheme,
    page,
    setPage,
    minHeight,
    saveMinHeight,
    maxHeight,
    saveMaxHeight,

    globalShortcutToggleWindow,
    setGlobalShortcutToggleWindow,
    searchMode,
    saveSearchMode,
    searchContentType,
    saveSearchContentType,
    searchBookmark,
    saveSearchBookmark,
    font,
    saveAndApplyFont,
    historySize,
    saveHistorySize,
    systemFontList,
    version,
    appLocalDataDir,
    appDataDir,
    shortcutSendAndPaste,
    saveShortcutSendAndPaste,
    shortcutSendClipboard,
    saveShortcutSendClipboard,
    shortcutDeleteClip,
    saveShortcutDeleteClip,
    shortcutToggleClipBookmark,
    saveShortcutToggleClipBookmark,
    shortcutToggleSearchContentTypeText,
    saveShortcutToggleSearchContentTypeText,
    shortcutToggleSearchContentTypeImage,
    saveShortcutToggleSearchContentTypeImage,
    shortcutToggleSearchBookmark,
    saveShortcutToggleSearchBookmark,
    shortcutToggleSearchMode,
    saveShortcutToggleSearchMode,
  };
}
