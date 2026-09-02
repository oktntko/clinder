import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

import { command } from '~/command';
import { Footer } from '~/component/Footer';
import { cn } from '~/lib/utils';
import { Clipboard } from '~/page/Clipboard';
import { Information } from '~/page/Information';
import { Setting } from '~/page/Setting';
import { useStore } from '~/plugin/useStore';

function App() {
  const { page, setPage, enablePin, minHeight, maxHeight } = useStore();

  const [pressingAlt, setPressingAlt] = useState(false);

  useEffect(() => {
    // 'Alt' を prevent しているのは復帰時にOSのウィンドウメニューが開くことがあるため
    function hideWindow(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape': {
          const mediumZoomImageOpened = document.querySelector('.medium-zoom-image--opened');
          if (mediumZoomImageOpened) {
            return;
          }

          e.preventDefault();
          void command.hide_window();
          return;
        }
      }
    }

    function loopTabKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Tab': {
          const modalDialog = document.querySelector('dialog:modal');
          if (e.ctrlKey) {
            if (modalDialog) {
              return;
            }

            if (!e.shiftKey) {
              setPage((page) =>
                page === 'clipboard' ? 'setting' : page === 'setting' ? 'information' : 'clipboard',
              );
            } else {
              setPage((page) =>
                page === 'clipboard' ? 'information' : page === 'setting' ? 'clipboard' : 'setting',
              );
            }

            return;
          }

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

    function startDragging(e: KeyboardEvent) {
      if (e.key === 'Alt') {
        e.preventDefault();
        setPressingAlt(true);
      }
    }

    function stopDragging(e: KeyboardEvent) {
      if (e.key === 'Alt') {
        e.preventDefault();
        setPressingAlt(false);
      }
    }

    window.addEventListener('keydown', startDragging);
    window.addEventListener('keyup', stopDragging);
    window.addEventListener('keydown', loopTabKey, true);
    window.addEventListener('keydown', hideWindow);

    return () => {
      window.removeEventListener('keydown', startDragging);
      window.removeEventListener('keyup', stopDragging);
      window.removeEventListener('keydown', loopTabKey, true);
      window.removeEventListener('keydown', hideWindow);
    };
  }, [setPage]);

  const [isDragging, setIsDragging] = useState(false);
  async function startDragging(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button === 0 && e.altKey) {
      setIsDragging(true);
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error('Failed to start dragging:', err);
      } finally {
        setIsDragging(false);
      }
    }
  }

  // ウィンドウのフォーカス変化を監視
  // フォーカスが外れたら非表示にする
  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused && !isDragging) {
        setPressingAlt(false);
        if (!enablePin) {
          void command.hide_window();
        }
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [isDragging, enablePin]);

  return (
    <>
      <div
        className={cn(
          'w-150 rounded-lg shadow-md',
          'flex flex-col',
          'text-sm',
          'bg-slate-100 text-slate-900',
          'dark:bg-zinc-900 dark:text-zinc-100',
          pressingAlt ? 'cursor-move! [&_div_*]:cursor-move!' : '',
        )}
        style={{
          minHeight,
          maxHeight,
        }}
        onMouseDown={startDragging}
      >
        {page === 'clipboard' ? <Clipboard /> : page === 'setting' ? <Setting /> : <Information />}

        <Footer />
      </div>
    </>
  );
}

export default App;

export const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';
