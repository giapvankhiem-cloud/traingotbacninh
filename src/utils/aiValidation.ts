export const MAX_PROMPT_LENGTH = 3000;
export const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MAX_IMAGE_BYTES = 9 * 1024 * 1024;
const ALLOWED_SEVERITIES = new Set(['Nhẹ', 'Trung bình', 'Nghiêm trọng']);

export interface ValidDiagnosis {
  name: string;
  plant: string;
  confidence: number;
  severity: 'Nhẹ' | 'Trung bình' | 'Nghiêm trọng';
  causes: string;
  symptoms: string[];
  treatment: {
    biological: string[];
    chemicalIfSevere: string[];
    prevention: string[];
  };
  expertAdvice: string;
  isolationDays: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanTextList(value: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function cropKey(value: string): string | null {
  const normalized = value.toLocaleLowerCase('vi-VN');
  if (normalized.includes('vải')) return 'lychee';
  if (normalized.includes('quýt')) return 'mandarin';
  if (normalized.includes('nhãn')) return 'longan';
  if (normalized.includes('nho')) return 'grape';
  if (normalized.includes('cam')) return 'orange';
  if (normalized.includes('bưởi')) return 'pomelo';
  if (normalized.includes('táo')) return 'apple';
  if (normalized.includes('ổi')) return 'guava';
  if (normalized.includes('cây ăn quả') || normalized.includes('cây khác')) return 'other';
  return null;
}

export function parseImageBase64(imageBase64: unknown, mimeType: unknown): string | null {
  if (imageBase64 === undefined || imageBase64 === null || imageBase64 === '') return null;
  if (typeof imageBase64 !== 'string' || typeof mimeType !== 'string' || !SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return null;
  }

  const matched = imageBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  const declaredMimeType = matched?.[1]?.toLowerCase();
  const base64 = (matched?.[2] ?? imageBase64).replace(/\s/g, '');
  if (declaredMimeType && declaredMimeType !== mimeType) return null;
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return null;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteLength = (base64.length / 4) * 3 - padding;
  if (byteLength <= 0 || byteLength > MAX_IMAGE_BYTES) return null;
  try {
    const prefix = atob(base64.slice(0, 16));
    const bytes = Array.from(prefix, (char) => char.charCodeAt(0));
    const matches = mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mimeType === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
      : prefix.startsWith('RIFF') && prefix.slice(8,12) === 'WEBP';
    return matches ? base64 : null;
  } catch { return null; }
}

export function validateDiagnosisResult(value: unknown, requestedPlant: string): ValidDiagnosis | null {
  if (!isRecord(value) || cropKey(requestedPlant) === null) return null;
  const plant = cleanText(value.plant, 100);
  const confidence = typeof value.confidence === 'number' ? value.confidence : NaN;
  const severity = cleanText(value.severity, 30);
  const symptoms = cleanTextList(value.symptoms, 6, 300);
  const treatment = isRecord(value.treatment) ? value.treatment : null;

  if (
    !cleanText(value.name, 200) ||
    cropKey(plant) !== cropKey(requestedPlant) ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 100 ||
    !ALLOWED_SEVERITIES.has(severity) ||
    symptoms.length === 0 ||
    !treatment
  ) {
    return null;
  }

  const biological = cleanTextList(treatment.biological, 6, 350);
  const chemicalIfSevere = cleanTextList(treatment.chemicalIfSevere, 6, 350);
  const prevention = cleanTextList(treatment.prevention, 6, 350);
  if (biological.length === 0 || prevention.length === 0) return null;

  return {
    name: cleanText(value.name, 200),
    plant,
    confidence: Math.round(confidence),
    severity: severity as ValidDiagnosis['severity'],
    causes: cleanText(value.causes, 1000, 'Chưa xác định rõ nguyên nhân.'),
    symptoms,
    treatment: { biological, chemicalIfSevere, prevention },
    expertAdvice: cleanText(value.expertAdvice, 700),
    isolationDays: Math.max(0, Math.min(365, Number(value.isolationDays) || 0)),
  };
}

export function safeFarmerContext(value: unknown) {
  const farmer = isRecord(value) ? value : {};
  const areaHa = typeof farmer.areaHa === 'number' && Number.isFinite(farmer.areaHa)
    ? Math.max(0.1, Math.min(10_000, farmer.areaHa))
    : 0;
  return {
    name: cleanText(farmer.name, 80, 'Bác nông dân'),
    location: cleanText(farmer.location, 160, ''),
    areaHa,
    cropFocus: cleanText(farmer.cropFocus, 160, ''),
  };
}
