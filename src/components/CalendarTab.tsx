import { SeasonalNotices } from './SeasonalNotices';
import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  User,
  Package,
  Droplets,
  ShieldCheck,
  FileCheck,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { FarmerAccount, ProduceItem } from '../types/agriculture';
import { getSynchronizedTasksForFarmer, type CultivationLogInput, type CultivationLogType } from '../utils/cultivationSync';
import { LycheeLogo } from './LycheeLogo';
import { ownsProduct } from '../utils/farmerProduct';
import { useTaskStatus } from '../hooks/useTaskStatus';
import { PRODUCE_CATEGORIES } from '../data/produceCategories';

interface CalendarTabProps {
  currentFarmer: FarmerAccount;
  produceList: ProduceItem[];
  onAddCultivationLog: (
    logType: CultivationLogType,
    data: CultivationLogInput,
    productId?: string
  ) => Promise<void>;
  isLoggedIn?: boolean;
  onOpenQuickLogin?: () => void;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  currentFarmer,
  produceList,
  onAddCultivationLog,
  isLoggedIn = false,
  onOpenQuickLogin,
}) => {
  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [selectedLogType, setSelectedLogType] = useState<
    'all' | 'watering' | 'fertilizing' | 'pest' | 'general'
  >('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addLogCategory, setAddLogCategory] = useState<
    'watering' | 'fertilizing' | 'pest' | 'general'
  >('watering');

  // Local state for tasks that allows toggling completed status
  const { completed: completedTaskIds, toggle: toggleTask, error: taskError } = useTaskStatus(isLoggedIn ? currentFarmer.id : '');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const myProducts = produceList.filter((item) => ownsProduct(currentFarmer, item));

  // Inputs for Add Log Modal
  const [dateStr, setDateStr] = useState<string>(
    new Date().toLocaleDateString('vi-VN')
  );
  // Watering fields
  const [waterMethod, setWaterMethod] = useState<string>('Tưới nhỏ giọt công nghệ Israel quanh tán');
  const [waterAmount, setWaterAmount] = useState<string>('40 lít/gốc');
  const [waterSource, setWaterSource] = useState<string>('Hồ đập thủy nông qua lọc cát vi sinh');
  const [waterNote, setWaterNote] = useState<string>('Duy trì độ ẩm đất 65% cho bộ rễ phát triển khỏe');

  // Fertilizing fields
  const [fertilizerName, setFertilizerName] = useState<string>(
    'Phân bón hữu cơ vi sinh trùn quế Quế Lâm'
  );
  const [fertilizerDosage, setFertilizerDosage] = useState<string>('3.5 kg/gốc');
  const [fertilizerStage, setFertilizerStage] = useState<string>('Nuôi quả & bao trái');
  const [fertilizerNote, setFertilizerNote] = useState<string>(
    'Rải đều theo rãnh quanh mép tán, lấp đất mỏng giữ ẩm'
  );

  // Pest protection fields
  const [productUsed, setProductUsed] = useState<string>(
    'Chế phẩm sinh học thảo mộc Neem Oil + Vi sinh BT'
  );
  const [targetPest, setTargetPest] = useState<string>('Phòng trừ sâu róm non, nhện đỏ và bọ xít');
  const [isolationDays, setIsolationDays] = useState<number>(45);

  // General task fields
  const [generalTitle, setGeneralTitle] = useState<string>('');
  const [generalInstructions, setGeneralInstructions] = useState<string>('');
  const [generalMaterials, setGeneralMaterials] = useState<string>('Dụng cụ làm vườn');

  const farmerProduct = useMemo(
    () => myProducts.find((item) => item.id === selectedProductId) || myProducts[0],
    [currentFarmer, produceList, selectedProductId]
  );

  const allTasks = useMemo(
    () => getSynchronizedTasksForFarmer(currentFarmer, farmerProduct ? [farmerProduct] : []),
    [currentFarmer, farmerProduct]
  );

  const filteredTasks = useMemo(() => {
    return allTasks
      .map((t) => ({
        ...t,
        completed: completedTaskIds[t.id] !== undefined ? completedTaskIds[t.id] : t.completed,
      }))
      .filter((t) => {
        // Filter by crop
        if (selectedCrop !== 'all' && farmerProduct?.category !== selectedCrop) {
          return false;
        }
        // Filter by logType
        if (selectedLogType !== 'all') {
          if (t.logType !== selectedLogType) return false;
        }
        return true;
      });
  }, [allTasks, completedTaskIds, selectedCrop, selectedLogType, farmerProduct]);

  const crops = [{ id: 'all', label: 'Tất cả' }, ...PRODUCE_CATEGORIES, { id: 'other', label: 'Khác' }];

  const wateringCount = allTasks.filter((t) => t.logType === 'watering').length;
  const fertilizingCount = allTasks.filter((t) => t.logType === 'fertilizing').length;
  const pestCount = allTasks.filter((t) => t.logType === 'pest').length;
  const generalCount = allTasks.filter((t) => t.logType === 'general').length;

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const productId = selectedProductId || myProducts[0]?.id;
    if (!isLoggedIn || !productId) { setSaveError('Đăng nhập và đăng bán trái cây trước khi ghi nhật ký.'); return; }
    setSaving(true); setSaveError('');
    try {

    if (addLogCategory === 'watering') {
      await onAddCultivationLog('watering', {
        date: dateStr,
        method: waterMethod,
        amountLiters: waterAmount,
        waterSource,
        note: waterNote,
      }, productId);
    } else if (addLogCategory === 'fertilizing') {
      await onAddCultivationLog('fertilizing', {
        date: dateStr,
        fertilizerName,
        dosage: fertilizerDosage,
        stage: fertilizerStage,
        organicCertified: true,
        note: fertilizerNote,
      }, productId);
    } else if (addLogCategory === 'pest') {
      await onAddCultivationLog('pest', {
        date: dateStr,
        productUsed,
        targetPest,
        isolationDaysBeforeHarvest: isolationDays,
      }, productId);
    } else {
      await onAddCultivationLog('general', {
        date: dateStr,
        title: generalTitle || 'Chăm sóc vườn',
        instructions: generalInstructions,
        materials: generalMaterials,
      }, productId);
    }

    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    } catch {
      // ignore
    }

    setShowAddModal(false);
    } catch (error) { setSaveError((error as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      <SeasonalNotices cropFocus={currentFarmer.cropFocus} categories={myProducts.map(p=>p.category)}/>
      {(saveError || taskError) && <p role="alert" className="bg-rose-50 text-rose-800 rounded-xl p-3">{saveError || taskError}</p>}
      {isLoggedIn && <label className="block bg-white p-4 rounded-xl">Trái cây ghi nhật ký<select aria-label="Chọn trái cây ghi nhật ký" className="block border rounded-xl p-2 mt-2 w-full" value={selectedProductId || myProducts[0]?.id || ''} onChange={(event) => setSelectedProductId(event.target.value)}>{myProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{saving && <span>Đang lưu nhật ký…</span>}</label>}
      {/* Synchronization Header Banner */}
      <div className="ui-banner rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-emerald-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-xs font-semibold border border-emerald-400/30">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Mã vùng trồng PUC: {currentFarmer.pucCode || 'Chưa khai báo'}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-100 text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Đồng bộ nhật ký truy xuất trái cây</span>
              </span>
            </div>

            <h2 className="ui-section-title text-white">
              Nhật ký &amp; lịch canh tác của {currentFarmer.name}
            </h2>

            <p className="text-xs sm:text-sm text-inverse-muted leading-relaxed">
              Mọi hoạt động tưới nước, bón phân, cách ly thuốc BVTV ghi chép tại đây được <strong>tự động đồng bộ sang trang chi tiết trái cây</strong> để khách mua quét mã QR kiểm tra nhật ký minh bạch.
            </p>

            <div className="flex items-center gap-2 text-xs text-inverse-muted font-semibold">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{currentFarmer.location}</span>
            </div>
          </div>

          {/* Quick Stats & Action Button */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="bg-emerald-950/70 border border-emerald-700/50 px-4 py-2.5 rounded-2xl text-center shrink-0">
              <span className="text-xs text-emerald-300 font-semibold block">Nhật ký đã ghi</span>
              <p className="text-lg font-semibold text-white">
                {allTasks.length} Bản Ghi
              </p>
            </div>

            <button
              onClick={() => isLoggedIn ? setShowAddModal(true) : onOpenQuickLogin?.()}
              className="button-light shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Ghi nhật ký canh tác mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Synchronized Log Category Switcher */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedLogType('all')}
            aria-pressed={selectedLogType === 'all'}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedLogType === 'all'
                ? 'bg-action text-white shadow-xs'
                : 'text-accent hover:bg-emerald-50'
            }`}
          >
            📋 Tất cả ({allTasks.length})
          </button>

          <button
            onClick={() => setSelectedLogType('watering')}
            aria-pressed={selectedLogType === 'watering'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedLogType === 'watering'
                ? 'bg-action text-white shadow-xs'
                : 'text-accent hover:bg-emerald-50'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>💧 Tưới nước ({wateringCount})</span>
          </button>

          <button
            onClick={() => setSelectedLogType('fertilizing')}
            aria-pressed={selectedLogType === 'fertilizing'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedLogType === 'fertilizing'
                ? 'bg-action text-white shadow-xs'
                : 'text-accent hover:bg-emerald-50'
            }`}
          >
            <LycheeLogo className="text-sm" />
            <span>🌱 Bón phân ({fertilizingCount})</span>
          </button>

          <button
            onClick={() => setSelectedLogType('pest')}
            aria-pressed={selectedLogType === 'pest'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedLogType === 'pest'
                ? 'bg-action text-white shadow-xs'
                : 'text-accent hover:bg-emerald-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>🛡️ Phun BVTV sinh học ({pestCount})</span>
          </button>

          <button
            onClick={() => setSelectedLogType('general')}
            aria-pressed={selectedLogType === 'general'}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedLogType === 'general'
                ? 'bg-action text-white shadow-xs'
                : 'text-accent hover:bg-emerald-50'
            }`}
          >
            ✂️ Công việc mùa vụ ({generalCount})
          </button>
        </div>

        {/* Filter by Crop */}
        <div className="flex items-center gap-1 text-xs">
          <span className="font-semibold text-muted">Cây trồng:</span>
          <select
            aria-label="Lọc nhật ký theo loại cây"
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-ink focus:outline-emerald-600"
          >
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task & Cultivation Log List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/90 shadow-2xs space-y-2">
            <CalendarIcon className="w-10 h-10 mx-auto text-slate-300" />
            <h4 className="ui-label-title text-body">Chưa có nhật ký nào trong mục này</h4>
            <p className="text-xs text-muted">
              Bấm &ldquo;Ghi Nhật Ký Canh Tác Mới&rdquo; để thêm đợt tưới nước, bón phân hoặc công việc chăm sóc.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isWatering = task.logType === 'watering';
            const isFert = task.logType === 'fertilizing';
            const isPest = task.logType === 'pest';

            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-2xs hover:shadow-xs ${
                  task.completed
                    ? 'border-emerald-200/90 bg-emerald-50/15'
                    : 'border-slate-200/90 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTask(task.id, task.completed)}
                      className="mt-1 text-muted hover:text-accent transition-colors cursor-pointer shrink-0"
                      title={task.completed ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 hover:text-emerald-500" />
                      )}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Badge row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {isWatering && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 flex items-center gap-1">
                            <Droplets className="w-3 h-3 text-blue-600" />
                            <span>Nhật ký tưới nước</span>
                          </span>
                        )}
                        {isFert && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-100 text-accent flex items-center gap-1">
                            <LycheeLogo className="text-xs" />
                            <span>Nhật ký bón phân</span>
                          </span>
                        )}
                        {isPest && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>Phòng Trừ Sinh Học &amp; Cách Ly PHI</span>
                          </span>
                        )}
                        {!isWatering && !isFert && !isPest && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-body">
                            Công Việc Canh Tác Mùa Vụ
                          </span>
                        )}

                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-ink">
                          {task.crop}
                        </span>

                        <span className="text-xs font-semibold text-muted flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {task.date}
                        </span>

                        {task.completed && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            ✓ Đã lưu nhật ký
                          </span>
                        )}
                      </div>

                      <h3
                        className={`ui-card-title text-sm sm:text-base font-semibold text-ink leading-snug ${
                          task.completed ? 'text-ink' : 'text-ink'
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Instructions / Log Note */}
                      <p className="text-xs text-body leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        {task.instructions}
                      </p>

                      {/* Materials / Details */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-xs font-semibold text-muted flex items-center gap-1 mr-1">
                          <Package className="w-3.5 h-3.5" /> Thông số / Vật tư:
                        </span>
                        {task.materialsNeeded.map((mat, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/60"
                          >
                            {mat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Assigned To Farmer */}
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60">
                      <User className="w-3.5 h-3.5 text-accent" />
                      <span>{task.assignedTo || currentFarmer.name}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task / Cultivation Log Modal */}
      {showAddModal && (
        <div className="ui-dialog fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between ui-banner">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="ui-section-title text-white">
                    Ghi nhật ký canh tác
                  </h3>
                  <p className="text-xs text-inverse-muted">
                    Tự động đồng bộ sang hồ sơ truy xuất của trái cây đã chọn
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Category Picker */}
              <div>
                <label className="text-xs font-semibold text-body block mb-1.5">
                  Chọn phân loại nhật ký cần ghi:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAddLogCategory('watering')}
                    aria-pressed={addLogCategory === 'watering'}
                    className={`p-2.5 rounded-xl font-semibold border flex items-center gap-2 cursor-pointer ${
                      addLogCategory === 'watering'
                        ? 'bg-emerald-50 border-action text-accent ring-1 ring-emerald-400'
                        : 'border-slate-200 text-body hover:bg-slate-50'
                    }`}
                  >
                    <Droplets className="w-4 h-4 shrink-0" />
                    <span>💧 Tưới nước</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddLogCategory('fertilizing')}
                    aria-pressed={addLogCategory === 'fertilizing'}
                    className={`p-2.5 rounded-xl font-semibold border flex items-center gap-2 cursor-pointer ${
                      addLogCategory === 'fertilizing'
                        ? 'bg-emerald-50 border-action text-accent ring-1 ring-emerald-400'
                        : 'border-slate-200 text-body hover:bg-slate-50'
                    }`}
                  >
                    <LycheeLogo className="text-base shrink-0" />
                    <span>🌱 Bón phân</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddLogCategory('pest')}
                    aria-pressed={addLogCategory === 'pest'}
                    className={`p-2.5 rounded-xl font-semibold border flex items-center gap-2 cursor-pointer ${
                      addLogCategory === 'pest'
                        ? 'bg-emerald-50 border-action text-accent ring-1 ring-emerald-400'
                        : 'border-slate-200 text-body hover:bg-slate-50'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>🛡️ Phun BVTV sinh học</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddLogCategory('general')}
                    aria-pressed={addLogCategory === 'general'}
                    className={`p-2.5 rounded-xl font-semibold border flex items-center gap-2 cursor-pointer ${
                      addLogCategory === 'general'
                        ? 'bg-emerald-50 border-action text-accent ring-1 ring-emerald-400'
                        : 'border-slate-200 text-body hover:bg-slate-50'
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4 shrink-0" />
                    <span>✂️ Công việc mùa vụ</span>
                  </button>
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="text-xs font-semibold text-body block mb-1">
                  Ngày thực hiện / Ngày ghi nhận
                </label>
                <input
                  type="text"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-emerald-600"
                  placeholder="VD: 20/10/2026"
                />
              </div>

              {/* Dynamic Form based on Category */}
              {addLogCategory === 'watering' && (
                <div className="space-y-3 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 text-xs">
                  <div>
                    <label className="font-semibold text-accent block mb-1">Phương pháp tưới</label>
                    <input
                      type="text"
                      value={waterMethod}
                      onChange={(e) => setWaterMethod(e.target.value)}
                      className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                      placeholder="VD: Tưới nhỏ giọt quanh tán, tưới phun sương..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-accent block mb-1">Lượng nước / cây</label>
                      <input
                        type="text"
                        value={waterAmount}
                        onChange={(e) => setWaterAmount(e.target.value)}
                        className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                        placeholder="VD: 40 lít/gốc"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-accent block mb-1">Nguồn nước</label>
                      <input
                        type="text"
                        value={waterSource}
                        onChange={(e) => setWaterSource(e.target.value)}
                        className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                        placeholder="VD: Nước giếng sâu, nước hồ Cấm Sơn"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-accent block mb-1">Ghi chú độ ẩm &amp; kỹ thuật</label>
                    <input
                      type="text"
                      value={waterNote}
                      onChange={(e) => setWaterNote(e.target.value)}
                      className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                    />
                  </div>
                </div>
              )}

              {addLogCategory === 'fertilizing' && (
                <div className="space-y-3 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 text-xs">
                  <div>
                    <label className="font-semibold text-accent block mb-1">Tên phân bón</label>
                    <input
                      type="text"
                      value={fertilizerName}
                      onChange={(e) => setFertilizerName(e.target.value)}
                      className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                      placeholder="VD: Phân hữu cơ trùn quế Quế Lâm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-accent block mb-1">Liều lượng bón</label>
                      <input
                        type="text"
                        value={fertilizerDosage}
                        onChange={(e) => setFertilizerDosage(e.target.value)}
                        className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                        placeholder="VD: 3.5 kg/gốc"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-accent block mb-1">Giai đoạn sinh trưởng</label>
                      <input
                        type="text"
                        value={fertilizerStage}
                        onChange={(e) => setFertilizerStage(e.target.value)}
                        className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-accent block mb-1">Kỹ thuật bón &amp; Lưu ý</label>
                    <input
                      type="text"
                      value={fertilizerNote}
                      onChange={(e) => setFertilizerNote(e.target.value)}
                      className="w-full p-2 rounded-xl border border-emerald-300 bg-white font-medium"
                    />
                  </div>
                </div>
              )}

              {addLogCategory === 'pest' && (
                <div className="space-y-3 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/60 text-xs">
                  <div>
                    <label className="font-semibold text-amber-900 block mb-1">Tên chế phẩm sinh học</label>
                    <input
                      type="text"
                      value={productUsed}
                      onChange={(e) => setProductUsed(e.target.value)}
                      className="w-full p-2 rounded-xl border border-amber-300 bg-white font-medium"
                      placeholder="VD: Dầu khoáng SK Enspray + Tỏi ớt thảo mộc"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-amber-900 block mb-1">Đối tượng phòng trừ</label>
                      <input
                        type="text"
                        value={targetPest}
                        onChange={(e) => setTargetPest(e.target.value)}
                        className="w-full p-2 rounded-xl border border-amber-300 bg-white font-medium"
                        placeholder="VD: Nhện đỏ, bọ xít non, rệp sáp"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-amber-900 block mb-1">Thời gian cách ly (ngày)</label>
                      <input
                        type="number"
                        min="7"
                        value={isolationDays}
                        onChange={(e) => setIsolationDays(Number(e.target.value))}
                        className="w-full p-2 rounded-xl border border-amber-300 bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {addLogCategory === 'general' && (
                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <label className="font-semibold text-ink block mb-1">Tên công việc</label>
                    <input
                      type="text"
                      value={generalTitle}
                      onChange={(e) => setGeneralTitle(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-300 bg-white font-medium"
                      placeholder="VD: Khoanh cành hãm lộc đông, bao trái đợt 2..."
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Hướng dẫn thực hiện</label>
                    <textarea
                      rows={2}
                      value={generalInstructions}
                      onChange={(e) => setGeneralInstructions(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-300 bg-white font-sans text-xs"
                      placeholder="Chi tiết quy trình canh tác..."
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink block mb-1">Vật tư cần chuẩn bị</label>
                    <input
                      type="text"
                      value={generalMaterials}
                      onChange={(e) => setGeneralMaterials(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-300 bg-white font-medium"
                      placeholder="Kéo cắt tỉa, bao túi, bẫy dính..."
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-body hover:bg-slate-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="ui-button-primary px-5 py-2.5 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  Lưu và đồng bộ nhật ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
