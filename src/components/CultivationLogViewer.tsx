import { useState } from 'react';
import type { ProduceItem } from '../types/agriculture';
interface Props { logs: ProduceItem['cultivationLog']; vietgapCode: string }
export function CultivationLogViewer({ logs, vietgapCode }: Props) {
  const [tab, setTab] = useState('all');
  const tabs = [['all', 'Tất cả'], ['watering', `Tưới nước (${logs.watering.length})`], ['fertilizing', `Bón phân (${logs.fertilizing.length})`], ['pest', `Bảo vệ thực vật (${logs.pestProtection.length})`], ['general', `Công việc khác (${logs.general?.length || 0})`]];
  const count = logs.watering.length + logs.fertilizing.length + logs.pestProtection.length + (logs.general?.length || 0);
  const card = 'rounded-2xl border bg-white p-4 space-y-2 text-sm';
  return <section className="space-y-4">
    <header><h2 className="ui-section-title">Nhật ký canh tác</h2><p className="text-sm text-body">Mã vùng trồng: {vietgapCode || 'Chưa khai báo'} · {count} bản ghi</p></header>
    <nav aria-label="Loại nhật ký" className="flex flex-wrap gap-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={`px-3 py-2 rounded-xl text-sm ${tab === id ? 'bg-action text-white' : 'bg-slate-100'}`}>{label}</button>)}</nav>
    {count === 0 && <p className={card}>Nhà vườn chưa ghi nhật ký cho trái cây này.</p>}
    {(tab === 'all' || tab === 'watering') && logs.watering.map((log, index) => <article key={log.id || 'water-' + index} className={card}><h3 className="ui-card-title text-blue-800">Tưới nước · {log.date}</h3><p>Phương pháp: {log.method}</p><p>Lượng tưới: {log.amountLiters} · Nguồn nước: {log.waterSource}</p>{log.note && <p>Ghi chú: {log.note}</p>}</article>)}
    {(tab === 'all' || tab === 'fertilizing') && logs.fertilizing.map((log, index) => <article key={log.id || 'fert-' + index} className={card}><h3 className="ui-card-title text-accent">Bón phân · {log.date}</h3><p>Phân bón: {log.fertilizerName} · Liều lượng: {log.dosage}</p><p>Giai đoạn: {log.stage}</p>{log.organicCertified && <p>Nhà vườn khai báo sử dụng phân hữu cơ.</p>}{log.note && <p>Ghi chú: {log.note}</p>}</article>)}
    {(tab === 'all' || tab === 'pest') && logs.pestProtection.map((log, index) => <article key={log.id || 'pest-' + index} className={card}><h3 className="ui-card-title text-amber-800">Bảo vệ thực vật · {log.date}</h3><p>Sản phẩm sử dụng: {log.productUsed}</p><p>Đối tượng: {log.targetPest}</p><p>Thời gian cách ly khai báo: {log.isolationDaysBeforeHarvest} ngày · {log.status}</p><p className="text-body">Tình trạng kiểm định: {log.safetyVerified ? 'Nhà vườn khai báo đã kiểm định; cần đối chiếu hồ sơ.' : 'Chưa có xác nhận kiểm định.'}</p></article>)}
    {(tab === 'all' || tab === 'general') && logs.general?.map((log, index) => <article key={log.id || 'general-' + index} className={card}><h3 className="ui-card-title">{log.title} · {log.date}</h3><p>{log.instructions}</p>{log.materials && <p>Vật tư: {log.materials}</p>}</article>)}
    <p className="text-xs text-muted">Các bản ghi do nhà vườn cung cấp, cập nhật theo thời gian thực. Nhật ký không thay thế chứng nhận kiểm nghiệm chất lượng sản phẩm.</p>
  </section>;
}
