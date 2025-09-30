import { ReactNode } from 'react';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

export type FormActionBarProps = {
  onCancel?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  disabled?: boolean;
  extras?: ReactNode;
};

export function FormActionBar({ onCancel, submitLabel = '送信する', submitting, disabled, extras }: FormActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {extras}
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          クリア
        </Button>
      ) : null}
      <Button type="submit" disabled={disabled || submitting}>
        <span className="flex items-center gap-2">
          {submitting ? <LoadingSpinner /> : null}
          <span>{submitLabel}</span>
        </span>
      </Button>
    </div>
  );
}
