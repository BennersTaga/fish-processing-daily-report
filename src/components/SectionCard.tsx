import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionCard({ title, description, actions, className, children }: Props) {
  return (
    <section className={clsx('rounded-xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
