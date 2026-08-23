import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode;
};

export function Radio({ className, children, ...props }: InputProps) {
  return (
    <label
      htmlFor={props.id}
      className={cn('inline-flex flex-row items-center justify-center gap-2 px-2 py-0.5')}
    >
      <input
        {...props}
        type="radio"
        className={cn(
          'peer size-4 shrink-0 rounded-full transition outline-none hover:ring-2 focus:ring-3',
          'hover:ring-gray-400',
          'focus:ring-gray-400',
          'dark:hover:ring-zinc-600',
          'dark:focus:ring-zinc-600',
          className,
        )}
      />
      <span
        className={cn(
          'capitalize transition peer-hover:opacity-80',
          'peer-not-checked:text-gray-500 peer-not-checked:peer-hover:text-gray-900',
          'dark:peer-not-checked:text-zinc-500 dark:peer-not-checked:peer-hover:text-zinc-100',
        )}
      >
        {children}
      </span>
    </label>
  );
}
