import { format } from 'date-fns';

export function formatDateInput(value: Date | string | number) {
  return format(typeof value === 'string' || typeof value === 'number' ? new Date(value) : value, 'yyyy-MM-dd');
}

export function formatYmd(date: Date) {
  return format(date, 'yyyyMMdd');
}
