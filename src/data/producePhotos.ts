import type { ProduceItem } from '../types/agriculture';
import { storedAssetUrl } from '../utils/assetUrl';

export const PRODUCE_PHOTO_SAMPLES: ReadonlyArray<{ category: ProduceItem['category']; label: string; src: string }> = [
  { category: 'lychee', label: 'Vải thiều Chũ', src: storedAssetUrl('/assets/aistudio/vai_thieu_chu_1791794876673_8ae22a2e.jpg') },
  { category: 'orange', label: 'Cam đường Canh', src: storedAssetUrl('/assets/aistudio/cam_duong_canh_1791794891255_d0cb0660.jpg') },
  { category: 'pomelo', label: 'Bưởi Diễn', src: storedAssetUrl('/assets/aistudio/buoi_dien_chu_1791794953100_e11caabd.jpg') },
  { category: 'apple', label: 'Táo xuân', src: storedAssetUrl('/assets/aistudio/tao_xuan_dailoan_1791794902514_30247698.jpg') },
  { category: 'guava', label: 'Ổi lê Chũ', src: storedAssetUrl('/assets/aistudio/oi_le_chu_1791794939350_2428c961.jpg') },
];
