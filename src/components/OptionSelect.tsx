import { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
  placeholder?: string;
};

export function OptionSelect({ className, options, placeholder = '選択してください', ...props }: Props) {
  return (
    <select
      className={clsx(
        'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
        className,
      )}
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
