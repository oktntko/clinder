import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {};

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        'rounded-md border p-2 transition outline-none hover:ring-1 focus:ring-2',
        'border-slate-400 bg-white',
        'hover:bg-white hover:ring-slate-400',
        'focus:bg-white focus:ring-slate-400',
        'dark:border-zinc-600 dark:bg-zinc-800',
        'dark:hover:bg-zinc-700 dark:hover:ring-zinc-600',
        'dark:focus:bg-zinc-700 dark:focus:ring-zinc-600',
        className,
      )}
    />
  );
}

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode;
};

export function Checkbox({ className, children, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={props.id}
      className={cn(
        'inline-flex cursor-pointer flex-row items-center justify-center gap-2 px-2 py-0.5',
      )}
    >
      <input
        {...props}
        type="checkbox"
        className={cn(
          'peer size-4 shrink-0 cursor-pointer rounded-md transition outline-none hover:ring-2 focus:ring-3',
          'hover:ring-slate-400',
          'focus:ring-slate-400',
          'dark:hover:ring-zinc-600',
          'dark:focus:ring-zinc-600',
          className,
        )}
      />
      <span
        className={cn(
          'capitalize transition peer-hover:opacity-80',
          'peer-not-checked:text-slate-500 peer-not-checked:peer-hover:text-slate-900',
          'dark:peer-not-checked:text-zinc-500 dark:peer-not-checked:peer-hover:text-zinc-100',
        )}
      >
        {children}
      </span>
    </label>
  );
}

export type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode;
};

export function Radio({ className, children, ...props }: RadioProps) {
  return (
    <label
      htmlFor={props.id}
      className={cn(
        'inline-flex cursor-pointer flex-row items-center justify-center gap-2 px-2 py-0.5',
      )}
    >
      <input
        {...props}
        type="radio"
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded-full transition outline-none hover:ring-1 focus:ring-2',
          'border-2 border-slate-400 bg-white ring-slate-400',
          'bg-white checked:border-5 checked:border-blue-600 checked:ring-blue-400',
          className,
        )}
      />
      <span
        className={cn(
          'capitalize transition peer-hover:opacity-80',
          'peer-not-checked:text-slate-500 peer-not-checked:peer-hover:text-slate-900',
          'dark:peer-not-checked:text-zinc-500 dark:peer-not-checked:peer-hover:text-zinc-100',
        )}
      >
        {children}
      </span>
    </label>
  );
}
