import { Store } from '@tauri-apps/plugin-store';
import { useEffect, useState } from 'react';

import invoke from '~/command';

export type Theme = 'light' | 'dark';
export type Page = 'clipboard' | 'setting';
export type SelectAction = 'send-and-paste' | 'send-only';

export function useStore() {
  const [store, setStore] = useState<Store>();

  const [enablePin, setEnablePin] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [page, setPage] = useState<Page>('clipboard');
  const [windowToggleShortcut, setWindowToggleShortcut] = useState<string>('Alt+V');
  const [selectAction, setSelectAction] = useState<SelectAction>('send-and-paste');
  const [searchMode, setSearchMode] = useState<'fuzzy' | 'substring'>('fuzzy');
  const [font, setFont] = useState<string>('');
  const [systemFontList, setSystemFontList] = useState<string[]>([]);

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
        const v = await store?.get<Theme>('theme');
        return v ?? 'dark';
      }

      async function getWindowToggleShortcut(store: Store) {
        const v = await store?.get<string>('window_toggle_shortcut');
        return v ?? 'Alt+V';
      }

      async function getSelectAction(store: Store) {
        const v = await store?.get<SelectAction>('select_action');
        return v ?? 'send-and-paste';
      }

      async function getSearchMode(store: Store) {
        const v = await store?.get<'fuzzy' | 'substring'>('search_mode');
        return v ?? 'fuzzy';
      }

      async function getFont(store: Store) {
        const v = await store?.get<string>('font');
        return v ?? '';
      }

      void getEnablePin(store).then(setEnablePin);
      void getTheme(store).then(setTheme);
      void getWindowToggleShortcut(store).then(setWindowToggleShortcut);
      void getSelectAction(store).then(setSelectAction);
      void getSearchMode(store).then(setSearchMode);
      void getFont(store).then((v) => {
        setFont(v);
        applyFont(v);
      });
      void invoke.list_system_font().then(setSystemFontList);
    })();

    return () => undefined;
  }, []);

  async function saveEnablePin(v: boolean) {
    setEnablePin(v);
    await store?.set('pin', v);
    await store?.save();
  }

  async function saveTheme(v: Theme) {
    setTheme(v);
    await store?.set('theme', v);
    await store?.save();
  }

  async function saveSelectAction(v: SelectAction) {
    setSelectAction(v);
    await store?.set('clipboard_send_mode', v);
    await store?.save();
  }

  async function saveSearchMode(v: 'fuzzy' | 'substring') {
    setSearchMode(v);
    await store?.set('search_mode', v);
    await store?.save();
  }

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
    await store?.set('font', v);
    await store?.save();
  }

  return {
    enablePin,
    saveEnablePin,
    theme,
    saveTheme,
    page,
    setPage,
    windowToggleShortcut,
    selectAction,
    saveSelectAction,
    searchMode,
    saveSearchMode,
    font,
    saveAndApplyFont,
    systemFontList,
  };
}
