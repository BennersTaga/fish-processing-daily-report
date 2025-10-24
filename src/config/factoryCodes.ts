// 工場名 → 略号（必要に応じて編集）
export const FACTORY_CODE: Record<string, string> = {
  '羽野': 'HN',
  '大道': 'OD',
  '原田': 'HD',
};
export function factoryAbbr(name?: string): string {
  const ab = (name && FACTORY_CODE[name]) || 'XX';
  return ab.toUpperCase();
}
