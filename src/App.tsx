import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

import { Clipboard } from './page/Clipboard';
import { Setting } from './page/Setting';
import { useStore } from './plugin/useStore';

function App() {
  const store = useStore();

  useEffect(() => {
    // 'Alt' を prevent しているのは復帰時にOSのウィンドウメニューが開くことがあるため
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape': {
          e.preventDefault();
          void getCurrentWindow().hide();
          return;
        }
        case 'Tab': {
          if (e.ctrlKey) {
            switch (store.page) {
              case 'clipboard':
                e.preventDefault();
                return store.setPage('setting');
              case 'setting':
                e.preventDefault();
                return store.setPage('clipboard');
            }
          }

          const focusable = document.querySelectorAll(FOCUSABLE_SELECTOR);
          const firstElement: Element | undefined = focusable[0];
          const lastElement: Element | undefined = focusable[focusable.length - 1];

          if (e.target === firstElement && e.shiftKey) {
            if (lastElement instanceof HTMLElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else if (e.target === lastElement && !e.shiftKey) {
            if (firstElement instanceof HTMLElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }

          return;
        }
      }
    }

    function preventAltKey(e: KeyboardEvent) {
      if (e.altKey || e.key === 'Alt') {
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', preventAltKey, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', preventAltKey, true);

    return () => {
      window.removeEventListener('keydown', preventAltKey, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', preventAltKey, true);
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  async function handleMouseDown() {
    setIsDragging(true);
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error('Failed to start dragging:', err);
    } finally {
      setIsDragging(false);
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
          const focusable = document.querySelectorAll(FOCUSABLE_SELECTOR);
          const firstElement: Element | undefined = focusable[0];
          if (firstElement instanceof HTMLElement) {
            firstElement.focus();
          }
        });
      } else {
        if (!isDragging && !store.enablePin) {
          void appWindow.hide();
        }
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isDragging, store.enablePin]);

  return (
    <>
      <div
        className={`max-h-200 w-150 rounded-lg bg-white text-sm text-gray-900 shadow-md dark:bg-zinc-900 dark:text-zinc-100 ${store.theme === 'dark' ? 'dark' : ''}`}
      >
        {/* data-tauri-drag-region */}
        <div className="block h-2 cursor-move select-none" onMouseDown={handleMouseDown}></div>

        {store.page === 'clipboard' ? <Clipboard {...store} /> : <Setting {...store} />}
      </div>
    </>
  );
}

export default App;

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';
