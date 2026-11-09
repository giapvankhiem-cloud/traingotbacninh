import type { ProduceItem, FarmerAccount, CalendarTask, WateringLog, FertilizingLog, PestProtectionLog, GeneralCultivationLog } from '../types/agriculture';
import { getFarmerProduce } from './farmerProduct';
import { appendCultivationLog, type CultivationLogInput, type CultivationLogType } from './cultivationLogs';
export { getFarmerProduce } from './farmerProduct';
export type { CultivationLogInput, CultivationLogType } from './cultivationLogs';

function stableId(log: object) {
  let hash = 0;
  for (const char of JSON.stringify(log)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}
export function getSynchronizedTasksForFarmer(farmer: FarmerAccount, produceList: ProduceItem[], customTasks: CalendarTask[] = []): CalendarTask[] {
  const product = getFarmerProduce(farmer, produceList);
  if (!product) return customTasks;
  const tasks = [...customTasks];
  const add = (type: CultivationLogType, log: WateringLog | FertilizingLog | PestProtectionLog | GeneralCultivationLog, title: string, instructions: string, materials: string[], detail: string) => {
    tasks.push({ id: `log-${product.id}-${type}-${log.id || stableId(log)}`, crop: product.name, title, date: log.date,
      stage: 'Nhật ký đã ghi', priority: 'Trung bình', completed: true, assignedTo: farmer.name,
      instructions, materialsNeeded: materials, logType: type, logDetail: detail });
  };
  product.cultivationLog.watering.forEach((log) => add('watering', log, `Tưới nước: ${log.method}`, `${log.waterSource}. ${log.note}`, [log.waterSource], log.amountLiters));
  product.cultivationLog.fertilizing.forEach((log) => add('fertilizing', log, `Bón phân: ${log.fertilizerName}`, `${log.stage}. ${log.note}`, [log.fertilizerName], log.dosage));
  product.cultivationLog.pestProtection.forEach((log) => add('pest', log, `Bảo vệ thực vật: ${log.productUsed}`, `Đối tượng: ${log.targetPest}. Cách ly ${log.isolationDaysBeforeHarvest} ngày. ${log.status}.`, [log.productUsed], log.status));
  product.cultivationLog.general?.forEach((log) => add('general', log, log.title, log.instructions, log.materials.split(',').map((item) => item.trim()).filter(Boolean), log.materials));
  return tasks;
}
/** Compatibility helper; refuses to append to an unrelated product. */
export function addCultivationLogToProduce(produceList: ProduceItem[], farmer: FarmerAccount, type: CultivationLogType, data: CultivationLogInput): ProduceItem[] {
  const target = getFarmerProduce(farmer, produceList);
  return target ? produceList.map((item) => item.id === target.id ? appendCultivationLog(item, type, data) : item) : produceList;
}
