import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
};

export function FormField({ label, children, required, hint, className }: Props) {
  return (
    <label className={clsx('flex flex-col gap-1 text-sm', className)}>
      <span className="font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-xs font-normal text-red-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
