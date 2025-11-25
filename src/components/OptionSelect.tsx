import { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

type OptionSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
};

export function OptionSelect({
  className,
  options,
  placeholder = '選択してください',
  required,
  value,
  ...rest
}: OptionSelectProps) {
  const isEmptyRequired = required && (!value || (typeof value === 'string' && value.trim() === ''));

  return (
    <select
      value={value}
      className={clsx(
        'w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
        isEmptyRequired ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-900',
        className,
      )}
      required={required}
      {...rest}
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
