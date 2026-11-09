import type { ProduceItem } from '../types/agriculture';

export const PRODUCE_CATEGORIES: ReadonlyArray<{ id: Exclude<ProduceItem['category'], 'other'>; label: string }> = [
  { id: 'lychee', label: 'Vải' },
  { id: 'orange', label: 'Cam' },
  { id: 'mandarin', label: 'Quýt' },
  { id: 'pomelo', label: 'Bưởi' },
  { id: 'apple', label: 'Táo' },
  { id: 'longan', label: 'Nhãn' },
  { id: 'guava', label: 'Ổi' },
  { id: 'grape', label: 'Nho' },
];

