import { ReactNode } from 'react';
import { ExclamationTriangleIcon, InformationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

type Variant = 'info' | 'success' | 'error' | 'warning';

const variantStyles: Record<Variant, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
};

const variantIcon: Record<Variant, JSX.Element> = {
  info: <InformationCircleIcon className="h-5 w-5" />,
  success: <CheckCircleIcon className="h-5 w-5" />,
  error: <ExclamationTriangleIcon className="h-5 w-5" />,
  warning: <ExclamationTriangleIcon className="h-5 w-5" />,
};

type Props = {
  title?: string;
  description?: ReactNode;
  variant?: Variant;
  action?: ReactNode;
};

export function Alert({ title, description, variant = 'info', action }: Props) {
  return (
    <div className={clsx('flex items-start gap-3 rounded-md border px-4 py-3', variantStyles[variant])}>
      <div className="mt-0.5 text-current">{variantIcon[variant]}</div>
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {description ? <div className="mt-1 text-sm leading-relaxed">{description}</div> : null}
      </div>
      {action ? <div className="ml-4 shrink-0">{action}</div> : null}
    </div>
  );
}
