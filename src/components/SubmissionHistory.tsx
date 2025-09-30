import { SubmissionState } from '../types';
import { StatusBadge } from './StatusBadge';

export type SubmissionLog = {
  id: string;
  title: string;
  subtitle?: string;
  state: SubmissionState;
  timestamp: string;
};

type Props = {
  items: SubmissionLog[];
  emptyLabel: string;
};

export function SubmissionHistory({ items, emptyLabel }: Props) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
              {item.subtitle ? <p className="text-xs text-slate-500">{item.subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge state={item.state} />
              <span className="text-xs text-slate-400">{item.timestamp}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
