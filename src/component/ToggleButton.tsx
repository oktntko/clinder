import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

import { Button } from './Button';

export type ToggleButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  isActive: boolean;
  set?: 'default' | 'positive' | 'warning';
};

export function ToggleButton({
  className,
  children,
  isActive,
  set = 'positive',
  ...props
}: ToggleButtonProps) {
  return (
    <Button
      {...props}
      set={isActive ? set : 'default'}
      className={cn(
        'rounded-full p-1',
        isActive
          ? ''
          : ['border-transparent bg-transparent', 'dark:border-transparent dark:bg-transparent'],
        className,
      )}
    >
      {children}
    </Button>
  );
}
