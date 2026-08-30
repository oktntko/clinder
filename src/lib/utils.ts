import { clsx, type ClassValue } from 'clsx';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function usePortalTarget(id: string) {
  const [element, setElement] = useState<HTMLElement>();

  useEffect(() => {
    const el = document.getElementById(id);
    if (el) {
      setElement(el);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (el) {
        setElement(el);
        observer.disconnect();
      }
    });

    // body 全体の子要素の追加・削除を監視
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [id]);

  return element;
}

export function sleep(timeoutMilliSecond: number) {
  return new Promise((resolve) => setTimeout(resolve, timeoutMilliSecond));
}
