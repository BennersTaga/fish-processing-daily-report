import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ className, variant = 'primary', ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        {
          primary: 'border-primary-dark bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary',
          secondary: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400',
          ghost: 'border-transparent text-primary hover:bg-primary/10 focus-visible:ring-primary/50',
        }[variant],
        className,
      )}
      {...props}
    />
  );
}
