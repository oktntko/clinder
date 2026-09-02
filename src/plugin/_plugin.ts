export type ReactComponent = React.ComponentType<any>;

export type ColorSet = 'default' | 'positive' | 'info' | 'warning' | 'danger' | 'ghost' | 'none';

export function iconClass(set: ColorSet) {
  switch (set) {
    case 'default':
      return 'icon-[akar-icons--chat-dots]';
    case 'positive':
      return 'icon-[akar-icons--circle-check]';
    case 'info':
      return 'icon-[akar-icons--info]';
    case 'warning':
      return 'icon-[akar-icons--circle-alert]';
    case 'danger':
      return 'icon-[akar-icons--triangle-alert]';
    case 'ghost':
    case 'none':
    default:
      return '';
  }
}

export function iconColorClass(set: ColorSet) {
  switch (set) {
    case 'default':
      return 'bg-slate-900 dark:bg-zinc-100';
    case 'positive':
      return 'bg-green-700 dark:bg-emerald-300';
    case 'info':
      return 'bg-blue-600 dark:bg-indigo-400';
    case 'warning':
      return 'bg-amber-400 dark:bg-amber-300';
    case 'danger':
      return 'bg-red-600 dark:bg-red-500';
    case 'ghost':
    case 'none':
    default:
      return '';
  }
}

export function colorClass(
  set: ColorSet,
  {
    bg = true,
    text = true,
    border = true,
  }: { bg?: boolean; text?: boolean; border?: boolean } = {},
) {
  return [bg ? bgColor(set) : '', text ? textColor(set) : '', border ? borderColor(set) : ''].join(
    ' ',
  );
}

export function bgColor(set: ColorSet) {
  switch (set) {
    case 'default':
      return 'bg-white dark:bg-zinc-700';
    case 'positive':
      return 'bg-green-200 dark:bg-emerald-900';
    case 'info':
      return 'bg-blue-200 dark:bg-indigo-900';
    case 'warning':
      return 'bg-amber-200 dark:bg-amber-950';
    case 'danger':
      return 'bg-red-200 dark:bg-red-950';
    case 'ghost':
      return 'bg-transparent dark:bg-transparent';
    case 'none':
    default:
      return '';
  }
}

export function textColor(set: ColorSet) {
  switch (set) {
    case 'default':
      return 'text-slate-900 dark:text-zinc-100';
    case 'positive':
      return 'text-green-700 dark:text-emerald-300';
    case 'info':
      return 'text-blue-600 dark:text-indigo-200';
    case 'warning':
      return 'text-amber-800 dark:text-amber-300';
    case 'danger':
      return 'text-red-700 dark:text-red-300';
    case 'ghost':
    case 'none':
    default:
      return '';
  }
}

export function borderColor(set: ColorSet) {
  switch (set) {
    case 'default':
      return 'border-slate-400 dark:border-zinc-500';
    case 'positive':
      return 'border-green-800 dark:border-emerald-400 ';
    case 'info':
      return 'border-blue-800 dark:border-indigo-400';
    case 'warning':
      return 'border-amber-800 dark:border-amber-400 ';
    case 'danger':
      return 'border-red-800 dark:border-red-400';
    case 'ghost':
      return 'border-transparent dark:border-transparent';
    case 'none':
    default:
      return '';
  }
}
