import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  set: 'default' | 'positive' | 'warning' | 'ghost' | 'none';
  variant?: 'icon' | 'text';
};

export function Button({
  className,
  children,
  set,
  variant = 'icon',
  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  },
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center justify-center capitalize transition',
        'border outline-none hover:ring-1 focus:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:ring-0 disabled:focus:ring-0',
        variant === 'text' ? 'font-semi-bold min-w-24 rounded-md p-2' : 'rounded-full p-1',
        ...(set === 'default'
          ? [
              'border-slate-400 bg-white',
              'hover:bg-white hover:ring-slate-400',
              'focus:bg-white focus:ring-slate-400',
              'dark:border-zinc-500 dark:bg-zinc-700',
              'dark:hover:bg-zinc-600 dark:hover:ring-zinc-500',
              'dark:focus:bg-zinc-600 dark:focus:ring-zinc-500',
            ]
          : set === 'ghost'
            ? [
                'border-transparent bg-transparent',
                'hover:bg-white hover:ring-slate-400',
                'focus:bg-white focus:ring-slate-400',
                'dark:transparent dark:border-transparent',
                'dark:hover:bg-zinc-600 dark:hover:ring-zinc-500',
                'dark:focus:bg-zinc-600 dark:focus:ring-zinc-500',
              ]
            : set === 'positive'
              ? [
                  'border-green-800 bg-green-300 text-green-800',
                  'hover:bg-green-300 hover:text-slate-900 hover:ring-green-800',
                  'focus:bg-green-300 focus:text-slate-900 focus:ring-green-800',
                  'dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100',
                  'dark:hover:bg-emerald-700 dark:hover:text-white dark:hover:ring-emerald-500',
                  'dark:focus:bg-emerald-700 dark:focus:text-white dark:focus:ring-emerald-500',
                ]
              : set === 'warning'
                ? [
                    'border-amber-800 bg-amber-300 text-amber-800',
                    'hover:bg-amber-300 hover:text-amber-900 hover:ring-amber-800',
                    'focus:bg-amber-300 focus:text-amber-900 focus:ring-amber-800',
                    'dark:border-amber-500 dark:bg-amber-300 dark:text-amber-800',
                    'dark:hover:bg-amber-300 dark:hover:text-amber-900 dark:hover:ring-amber-500',
                    'dark:focus:bg-amber-300 dark:focus:text-amber-900 dark:focus:ring-amber-500',
                  ]
                : []),
        className,
      )}
    >
      {children}
    </button>
  );
}
