import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '~/App';
import '~/main.css';
import ToastProvider from '~/plugin/ToastPlugin';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);

function resizeWindowToContent() {
  const container = document.getElementById('app') || document.body;
  const appWindow = getCurrentWindow();

  if (container) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize[0].blockSize;

        void appWindow.setSize(new LogicalSize(600, height));
      }
    });

    observer.observe(container);
  }
}

window.addEventListener('DOMContentLoaded', resizeWindowToContent, true);
