import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

import { Clipboard } from '~/page/Clipboard';
import { Information } from '~/page/Information';
import { Setting } from '~/page/Setting';
import { useStore } from '~/plugin/useStore';

function App() {
  const store = useStore();

  useEffect(() => {
    // 'Alt' を prevent しているのは復帰時にOSのウィンドウメニューが開くことがあるため
    function hideWindow(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape': {
          e.preventDefault();
          void getCurrentWindow().hide();
          return;
        }
      }
    }

    function loopTabKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Tab': {
          const modalDialog = document.querySelector('dialog:modal');
          const focusable = (modalDialog || document).querySelectorAll(FOCUSABLE_SELECTOR);
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
    window.addEventListener('keyup', preventAltKey, true);
    window.addEventListener('keydown', loopTabKey, true);
    window.addEventListener('keydown', hideWindow);

    return () => {
      window.removeEventListener('keydown', preventAltKey, true);
      window.removeEventListener('keyup', preventAltKey, true);
      window.removeEventListener('keydown', loopTabKey, true);
      window.removeEventListener('keydown', hideWindow);
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
      <div className="max-h-200 w-150 rounded-lg bg-white text-sm text-gray-900 shadow-md dark:bg-zinc-900 dark:text-zinc-100">
        {/* data-tauri-drag-region */}
        <div className="block h-2 cursor-move select-none" onMouseDown={handleMouseDown}></div>

        {store.page === 'clipboard' ? (
          <Clipboard {...store} />
        ) : store.page === 'setting' ? (
          <Setting {...store} />
        ) : (
          <Information {...store} />
        )}
      </div>
    </>
  );
}

export default App;

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';
