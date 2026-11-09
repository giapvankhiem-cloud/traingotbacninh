import type { ProduceItem, WateringLog, FertilizingLog, PestProtectionLog, GeneralCultivationLog } from '../types/agriculture';

export type CultivationLogType = 'watering' | 'fertilizing' | 'pest' | 'general';
export type CultivationLogInput = WateringLog | FertilizingLog | Pick<PestProtectionLog, 'date' | 'productUsed' | 'targetPest' | 'isolationDaysBeforeHarvest'> | GeneralCultivationLog;

export function appendCultivationLog(item: ProduceItem, type: CultivationLogType, data: CultivationLogInput): ProduceItem {
  const logs = item.cultivationLog;
  const date = typeof data.date === 'string' ? data.date.trim() : '';
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
  if (!parts) throw new Error('Vui lòng nhập ngày ghi nhật ký hợp lệ theo dạng ngày/tháng/năm.');
  const [, day, month, year] = parts.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('Ngày ghi nhật ký không tồn tại. Vui lòng kiểm tra ngày, tháng và năm.');
  }
  const current = type === 'pest' ? logs.pestProtection : logs[type] || [];
  if (current.length >= 500) throw new Error('Mỗi loại nhật ký được lưu tối đa 500 bản ghi cho một trái cây.');
  data = { ...data, date, id: crypto.randomUUID() };
  if (type === 'watering') return { ...item, cultivationLog: { ...logs, watering: [data as WateringLog, ...logs.watering] } };
  if (type === 'fertilizing') return { ...item, cultivationLog: { ...logs, fertilizing: [data as FertilizingLog, ...logs.fertilizing] } };
  if (type === 'general') return { ...item, cultivationLog: { ...logs, general: [data as GeneralCultivationLog, ...(logs.general || [])] } };
  const pest = data as Pick<PestProtectionLog, 'date' | 'productUsed' | 'targetPest' | 'isolationDaysBeforeHarvest'>;
  if (!Number.isInteger(pest.isolationDaysBeforeHarvest) || pest.isolationDaysBeforeHarvest < 0) throw new Error('Thời gian cách ly không hợp lệ.');
  return { ...item, cultivationLog: { ...logs, pestProtection: [{ ...pest, isBiological: false, status: 'Đang cách ly', safetyVerified: false }, ...logs.pestProtection] } };
}
