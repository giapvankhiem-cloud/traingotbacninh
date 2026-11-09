import React, { useState, useRef, useEffect } from 'react';
import {
  Stethoscope,
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
  BookmarkPlus,
  Printer,
  Info,
  Bug,
  Leaf,
  Clock,
  Check,
} from 'lucide-react';
import { diagnosePlant } from '../services/aiClient';
import { cropKey } from '../utils/aiValidation';
import { COMMON_DISEASES } from '../data/mockData';
import { DiseaseRecord } from '../types/agriculture';
import { FruitLogo, FruitLogoKind } from './FruitLogo';

interface DiagnosisTabProps {
  onAskAssistant?: (question: string) => void;
}

export const DiagnosisTab: React.FC<DiagnosisTabProps> = ({ onAskAssistant }) => {
  const [selectedDisease, setSelectedDisease] = useState<DiseaseRecord | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [resultSource, setResultSource] = useState('');
  const [advisory, setAdvisory] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [plantType, setPlantType] = useState<string>('Vải thiều');
  const [affectedPart, setAffectedPart] = useState<string>('Lá & Chùm hoa');
  const [symptomText, setSymptomText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  const diagnosisFruit: FruitLogoKind = plantType.toLowerCase().includes('cam')
    ? 'orange'
    : plantType.toLowerCase().includes('bưởi')
      ? 'pomelo'
      : plantType.toLowerCase().includes('táo')
        ? 'apple'
        : plantType.toLowerCase().includes('ổi')
          ? 'guava'
          : 'lychee';

  const inputVersion = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRequest = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up media stream on component unmount
  useEffect(() => {
    return () => {
      pending.current?.abort(); cameraRequest.current++; inputVersion.current++;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  // Resize camera and upload images before encoding. Vision models do not need
  // the original multi-megapixel file, and this sharply reduces request time
  // and mobile-memory use while preserving enough leaf-detail for diagnosis.
  const imageToBase64 = (file: Blob, maxEdge = 1600): Promise<string> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        URL.revokeObjectURL(objectUrl);
        if (!context) {
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // JPEG is supported by the API for every accepted input type and is
        // substantially smaller than a PNG photo from a phone camera.
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Không thể đọc ảnh.'));
      };
      image.src = objectUrl;
    });
  };

  // Handle uploaded image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      showToast('Vui lòng chọn ảnh JPG, PNG hoặc WebP có dung lượng không quá 10MB.');
      e.target.value = '';
      return;
    }

    invalidateResult(); const version = inputVersion.current;
    try {
      const base64Data = await imageToBase64(file);
      if (version !== inputVersion.current) return;
      setUploadedPreview(base64Data);
      runDiagnosis(base64Data, 'image/jpeg');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi đọc tệp ảnh. Vui lòng thử lại.');
    }
  };

  useEffect(() => { if (cameraActive && videoRef.current && mediaStreamRef.current) videoRef.current.srcObject = mediaStreamRef.current; }, [cameraActive]);

  // Live Camera handlers
  const startCamera = async () => {
    const request = ++cameraRequest.current;
    try {
      setCameraActive(true);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (request !== cameraRequest.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      if (request !== cameraRequest.current) return;
      console.error('Camera access error:', err);
      showToast('Không thể mở máy ảnh. Vui lòng dùng tính năng tải ảnh.');
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) { showToast("Máy ảnh chưa sẵn sàng. Vui lòng đợi rồi chụp lại."); return; }
    const sourceWidth = videoRef.current.videoWidth;
    const sourceHeight = videoRef.current.videoHeight || 480;
    const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setUploadedPreview(dataUrl);
      stopCamera();
      runDiagnosis(dataUrl, 'image/jpeg');
    }
  };

  const stopCamera = () => {
    cameraRequest.current++;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const invalidateResult = () => { inputVersion.current++; pending.current?.abort(); pending.current = null; setIsAnalyzing(false); setSelectedDisease(null); setError(''); setResultSource(''); };
  const runDiagnosis = async (imgBase64?: string, mimeType?: string, targetPlant?: string, targetPart?: string, targetSymptoms?: string) => {
    const activePlant = targetPlant || plantType;
    const activeSymptoms = targetSymptoms ?? symptomText;
    const image = imgBase64 || uploadedPreview;
    if (!image && activeSymptoms.trim().length < 10) { setError('Hãy tải ảnh hoặc mô tả triệu chứng ít nhất 10 ký tự.'); return; }
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setIsAnalyzing(true); setError(''); setSelectedDisease(null);
    try {
      const result = await diagnosePlant({ imageBase64: image, mimeType: mimeType || 'image/jpeg', plantType: activePlant, affectedPart: targetPart || affectedPart, symptomsDescription: activeSymptoms }, controller.signal);
      if (controller.signal.aborted) return;
      setSelectedDisease({ ...result.diagnosis, id: crypto.randomUUID() });
      setResultSource('AI · ' + result.model + (result.inputMode === 'image' ? ' · Có phân tích ảnh' : ' · Chỉ dựa trên mô tả'));
      setAdvisory(result.advisory);
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (pending.current === controller) { pending.current = null; setIsAnalyzing(false); } }
  };
  const handleSelectSample = (disease: DiseaseRecord) => {
    invalidateResult(); setUploadedPreview(null); setSelectedDisease(disease);
    const names: Record<string,string> = { lychee:'Vải thiều',orange:'Cam đường Canh',pomelo:'Bưởi Diễn',apple:'Táo xuân',guava:'Ổi lê' };
    setPlantType(names[cropKey(disease.plant) || ''] || 'Cây ăn quả khác');
    setResultSource('Mẫu tham khảo · Chưa phân tích ảnh của bạn'); setAdvisory('Đây là mẫu minh họa để đọc tham khảo, không phải kết quả chẩn đoán của vườn.');
  };
  const downloadResult = () => {
    if (!selectedDisease) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ source: resultSource, advisory, diagnosis: selectedDisease }, null, 2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'ket-qua-chan-doan.json'; link.click(); URL.revokeObjectURL(url);
  };

  const quickSymptoms = [
    'Đốm tròn nâu đen lá non',
    'Vàng lá gân còn xanh',
    'Chùm hoa khô thối rụng',
    'Bạc trắng mặt lá như rắc cám',
    'Sâu đùn phân ở cuống quả',
    'Mốc trắng chùm hoa sau mưa',
  ];

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto font-sans">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-action text-white px-4 py-3 rounded-2xl shadow-xl border border-accent flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="ui-banner rounded-3xl p-5 sm:p-6 border flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-accent">
              <Stethoscope className="w-5 h-5" />
            </span>
            <h2 className="ui-section-title">
              Chẩn đoán sâu bệnh bằng AI
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-inverse-muted">
            Tải ảnh hoặc mô tả triệu chứng để AI phân tích khả năng sâu bệnh. Ảnh được gửi tới dịch vụ Gemini khi bạn phân tích. Cần kiểm tra thực địa để xác nhận.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200 text-xs font-semibold text-accent">
          <FruitLogo fruit={diagnosisFruit} className="text-base" />
          <span>Phân tích bằng Gemini</span>
        </div>
      </div>

      {/* Main Diagnosis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form, Photo Upload & Samples (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card: Upload & Camera Controls */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-card space-y-4">
            <h3 className="ui-card-title text-ink flex items-center gap-2">
              <Camera className="w-4 h-4 text-accent" />
              <span>Ảnh Mẫu Thực Địa Cần Chẩn Đoán</span>
            </h3>

            <input id="diagnosis-upload" aria-label="Ảnh cây trồng"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
            {/* Camera Viewfinder if open */}
            {cameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-300">
                <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover" />
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    onClick={capturePhoto}
                    className="ui-button-primary px-4 py-2 cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Chụp Ngay</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-900 text-white font-medium text-xs cursor-pointer"
                  >
                    Đóng máy ảnh
                  </button>
                </div>
              </div>
            ) : uploadedPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-300 bg-slate-50 group">
                <img
                  src={uploadedPreview}
                  alt="Ảnh mẫu bệnh thực địa"
                  className="w-full h-52 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white text-ink text-xs font-semibold shadow-md cursor-pointer hover:bg-slate-100"
                  >
                    Đổi ảnh khác
                  </button>
                  <button
                    onClick={() => { invalidateResult(); setUploadedPreview(null); }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-md cursor-pointer hover:bg-rose-700"
                  >
                    Xóa ảnh
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-emerald-800/90 text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                  Ảnh đã tải lên
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <label htmlFor="diagnosis-upload" className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-emerald-50/40 hover:bg-emerald-50 transition-all">

                  <div className="w-10 h-10 rounded-xl bg-white shadow-2xs text-accent flex items-center justify-center mb-1.5">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-ink">Tải ảnh từ máy</span>
                  <span className="text-xs text-muted">JPG, PNG dưới 10MB</span>
                </label>

                <button
                  onClick={startCamera}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-white shadow-2xs text-body flex items-center justify-center mb-1.5">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-ink">Chụp bằng máy ảnh</span>
                  <span className="text-xs text-muted">Chụp trực tiếp tại vườn</span>
                </button>
              </div>
            )}

            {/* Tree Type & Affected Part Selectors */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-body block mb-1">Loại cây trồng:</label>
                <select
                  aria-label="Loại cây trồng"
                  value={plantType}
                  onChange={(e) => {
                    const newPlant = e.target.value;
                    invalidateResult(); setPlantType(newPlant);
                    if (uploadedPreview) {
                      runDiagnosis(uploadedPreview, 'image/jpeg', newPlant, affectedPart, symptomText);
                    }
                  }}
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-emerald-600 focus:border-emerald-600"
                >
                  <option value="Vải thiều">Vải thiều Chũ</option>
                  <option value="Cam đường Canh">Cam đường Canh</option>
                  <option value="Bưởi Diễn">Bưởi Diễn</option>
                  <option value="Táo xuân">Táo xuân Đài Loan</option>
                  <option value="Ổi lê">Ổi lê Phượng Sơn</option>
                  <option value="Quýt">Quýt</option>
                  <option value="Nhãn">Nhãn</option>
                  <option value="Nho">Nho</option>
                  <option value="Cây ăn quả khác">Cây khác</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-body block mb-1">Bộ phận bị hại:</label>
                <select
                  aria-label="Bộ phận bị ảnh hưởng"
                  value={affectedPart}
                  onChange={(e) => { invalidateResult(); setAffectedPart(e.target.value); }}
                  className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-emerald-600 focus:border-emerald-600"
                >
                  <option value="Lá & Chùm hoa">Lá & Chùm hoa</option>
                  <option value="Quả non / Vỏ quả">Quả non / Vỏ quả</option>
                  <option value="Cành & Thân cây">Cành & Thân cây</option>
                  <option value="Gốc & Rễ cây">Gốc & Rễ cây</option>
                  <option value="Toàn bộ cây">Toàn bộ cây</option>
                </select>
              </div>
            </div>

            {/* Symptom description textarea */}
            <div>
              <label className="text-xs font-semibold text-body block mb-1">
                Mô tả triệu chứng nhìn thấy (tùy chọn):
              </label>
              <textarea
                aria-label="Mô tả triệu chứng"
                maxLength={3000}
                value={symptomText}
                onChange={(e) => { invalidateResult(); setSymptomText(e.target.value); }}
                placeholder="Ví dụ: Lá non có đốm tròn thâm nâu, cuống quả non bị khô héo rụng nhiều sau đợt mưa phùn..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-emerald-600"
              />

              {/* Quick symptom tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickSymptoms.map((qs, i) => (
                  <button
                    key={i}
                    onClick={() => { invalidateResult(); setSymptomText(qs); }}
                    className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-100 hover:text-accent text-body border border-slate-200 transition-colors cursor-pointer"
                  >
                    + {qs}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              aria-label="Tiến Hành Chẩn Đoán AI Ngay"
              onClick={() => runDiagnosis()}
              disabled={isAnalyzing}
              className="ui-button-primary w-full py-3 px-4 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI Đang Phân Tích Mẫu Bệnh...</span>
                </>
              ) : (
                <>
                  <FruitLogo fruit={diagnosisFruit} className="text-base" />
                  <span>Tiến Hành Chẩn Đoán AI Ngay</span>
                </>
              )}
            </button>
            <p className="flex gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 border border-amber-200">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Kết quả chỉ để tham khảo. Không tự ý dùng thuốc; hãy đối chiếu nhãn, danh mục hiện hành và cán bộ chuyên môn trước khi xử lý.
            </p>
          </div>

          {/* Preset Sample Diseases */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-card space-y-2.5">
            <h4 className="ui-label-title text-muted mb-1 flex items-center justify-between">
              <span>Hoặc thử mẫu bệnh cây ăn quả điển hình:</span>
              <span className="text-xs text-accent font-semibold">{COMMON_DISEASES.length} mẫu</span>
            </h4>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {COMMON_DISEASES.map((dis) => (
                <button
                  key={dis.id}
                  onClick={() => handleSelectSample(dis)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    selectedDisease?.id === dis.id
                      ? 'bg-emerald-50 border-emerald-500 text-accent font-semibold shadow-2xs'
                      : 'bg-slate-50/80 border-slate-200 text-body hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-accent">{dis.plant}</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-body">
                      Mẫu tham khảo
                    </span>
                  </div>
                  <p className="line-clamp-1 text-ink font-semibold">{dis.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Diagnosis Detailed Results Card (7 cols) */}
        <div className="lg:col-span-7">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 mb-4 text-rose-800">{error}</p>}
          {isAnalyzing ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200/90 shadow-card flex flex-col items-center justify-center text-center space-y-4 min-h-[500px]">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-accent flex items-center justify-center animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div>
                <h3 className="ui-card-title text-ink mb-1">
                  Đang phân tích thông tin cây trồng…
                </h3>
                <p className="text-xs text-muted max-w-md">
                  Đang gửi thông tin đến AI. Kết quả sẽ ghi rõ phân tích dựa trên ảnh hay mô tả.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-accent font-semibold bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                <FruitLogo fruit={diagnosisFruit} className="text-sm" />
                <span>Đang tạo phác đồ sinh học ưu tiên</span>
              </div>
            </div>
          ) : selectedDisease ? (
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-card space-y-5">
              <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">{resultSource}</p>
              {advisory && <p className="text-sm text-body">{advisory}</p>}
              {/* Header Result */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-accent">
                      Cây: {selectedDisease.plant}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        selectedDisease.severity === 'Nghiêm trọng'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Mức độ: {selectedDisease.severity}
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      Mã bệnh: {selectedDisease.id}
                    </span>
                  </div>
                  <h3 className="ui-card-title text-ink">
                    {selectedDisease.name}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-muted block font-semibold tracking-normal">
                    Mức tự đánh giá của mô hình
                  </span>
                  <span className="text-2xl font-semibold text-accent">
                    {resultSource.startsWith('AI') ? selectedDisease.confidence + '%' : '—'}
                  </span>
                </div>
              </div>

              {/* Causes & Mechanics */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-1.5 text-ink font-semibold mb-1">
                  <Bug className="w-4 h-4 text-amber-600" />
                  <span>Nguyên Nhân & Cơ Chế Phát Sinh:</span>
                </div>
                <p className="text-body leading-relaxed font-medium">
                  {selectedDisease.causes}
                </p>
              </div>

              {/* Identification Symptoms */}
              <div>
                <h4 className="ui-label-title text-muted mb-2 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-accent" />
                  <span>Triệu chứng nhận biết thực địa tại vườn:</span>
                </h4>
                <div className="space-y-1.5">
                  {selectedDisease.symptoms.map((sym, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-ink p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{sym}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* VietGAP Biological Protocol */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <h4 className="ui-label-title text-accent">
                    Gợi ý kiểm tra và xử lý ban đầu:
                  </h4>
                </div>
                <div className="space-y-2">
                  {selectedDisease.treatment.biological.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-accent leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-semibold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="font-semibold">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chemical if severe & Prevention */}
              <div className="pt-2 border-t border-slate-100 space-y-3 text-xs">
                {selectedDisease.treatment.chemicalIfSevere.length > 0 && (
                  <div>
                    <strong className="text-rose-700 block mb-1 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Lưu ý cần cán bộ chuyên môn xác nhận:</span>
                    </strong>
                    <p className="text-body bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 leading-relaxed font-medium">
                      {selectedDisease.treatment.chemicalIfSevere.join(' ')}
                    </p>
                  </div>
                )}

                <div>
                  <strong className="text-ink block mb-1.5 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-body" />
                    <span>Biện pháp canh tác phòng ngừa lâu dài cho vườn đồi:</span>
                  </strong>
                  <ul className="list-disc list-inside space-y-1 text-body pl-1">
                    {selectedDisease.treatment.prevention.map((prev, idx) => (
                      <li key={idx} className="font-medium">{prev}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons for Farmer */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (onAskAssistant) {
                        onAskAssistant(
                          `AI gợi ý khả năng ${selectedDisease.name} trên ${selectedDisease.plant}. Triệu chứng: ${selectedDisease.symptoms.join("; ")}. Cần kiểm tra thêm gì để xác nhận và chăm sóc ban đầu?`
                        );
                      }
                      showToast('Đang chuyển câu hỏi sang Trợ lý Kỹ thuật AI...');
                    }}
                    className="ui-button-primary inline-flex items-center gap-1.5 px-3.5 py-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Hỏi Thêm Trợ Lý AI Về Bệnh Này</span>
                  </button>

                  <button
                    onClick={downloadResult}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-ink text-xs font-semibold transition-all cursor-pointer border border-slate-200"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-accent" />
                    <span>Tải kết quả chẩn đoán</span>
                  </button>
                </div>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-body text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                  title="In phác đồ điều trị"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Phác Đồ</span>
                </button>
              </div>
            </div>
          ) : <div className="rounded-3xl bg-white border p-6">Chưa có kết quả. Hãy tải ảnh hoặc nhập triệu chứng để phân tích.</div>}
        </div>
      </div>
    </div>
  );
};
