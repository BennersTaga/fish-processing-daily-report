import clsx from 'clsx';
import { SubmissionState } from '../types';

type Props = {
  state: SubmissionState;
};

const labels: Record<SubmissionState, string> = {
  idle: '未送信',
  submitting: '送信中',
  success: '送信済',
  error: 'エラー',
};

export function StatusBadge({ state }: Props) {
  return (
    <span
      className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', {
        'bg-slate-200 text-slate-700': state === 'idle',
        'bg-blue-100 text-blue-700': state === 'submitting',
        'bg-green-100 text-green-700': state === 'success',
        'bg-red-100 text-red-700': state === 'error',
      })}
    >
      {labels[state]}
    </span>
  );
}
