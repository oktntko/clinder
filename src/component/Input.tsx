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
