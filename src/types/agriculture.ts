import type { StoredStory } from '../utils/story';
import type { GardenMedia } from '../utils/media';
export type ActiveTab =
  | 'overview'
  | 'garden_map'
  | 'weather'
  | 'calendar'
  | 'market'
  | 'orders'
  | 'community'
  | 'admin'
  | 'assistant';

export interface FarmerAccount {
  id: string;
  name: string;
  avatar: string;
  location: string; // Vị trí chính xác
  shortLocation: string;
  commune: string;
  role: string;
  cropFocus: string;
  areaHa: number;
  treeCount: number;
  phone: string;
  pucCode: string; // Mã số vùng trồng
  certification: string;
  farmName?: string;
  licenseNo?: string;
  gardenLocation?: FarmLocation;
  orchardPhoto?: string;
  bio?: string;
  introductionMedia?: GardenMedia[];
  introductionContent?: StoredStory;
  commitment?: string;
  certificates?: Certificate[];
  certificateIds?: string[];
  applicationRevision?: number;
}

export type ApplicationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
export interface FarmerApplication {
  id: string;
  email: string;
  profile: FarmerAccount;
  status: ApplicationStatus;
  revision: number;
  submittedAt: number;
  reviewedAt: number;
  reviewedBy: string;
  reviewNote: string;
}

export interface Certificate {
  id: string;
  type: 'VietGAP' | 'GlobalGAP' | 'OCOP' | 'Hữu cơ' | 'An toàn thực phẩm' | 'Khác';
  title: string;
  certificateNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  scope: string;
  verified: boolean;
  qrCodeUrl?: string;
  standardDetails: string;
  ocopStars?: 3 | 4 | 5;
  documentUrl?: string;
  documentImage?: string;
}

export interface FarmerProfile {
  name: string;
  avatar: string;
  coverImage?: string;
  role: string;
  phone: string;
  zalo: string;
  address: string;
  experienceYears: number;
  orchardAreaHa: number;
  treeCount: number;
  bio: string;
  introductionMedia?: GardenMedia[];
  introductionContent?: StoredStory;
  achievements: string[];
  commitment: string;
  certificates: Certificate[];
}

export interface WateringLog {
  id?: string;
  date: string;
  method: string;
  amountLiters: string;
  waterSource: string;
  note: string;
}

export interface FertilizingLog {
  id?: string;
  date: string;
  fertilizerName: string;
  dosage: string;
  stage: string;
  organicCertified: boolean;
  note: string;
}

export interface PestProtectionLog {
  id?: string;
  date: string;
  productUsed: string;
  targetPest: string;
  isBiological: boolean;
  isolationDaysBeforeHarvest: number;
  status: 'Đã hoàn thành cách ly' | 'Đang cách ly';
  safetyVerified: boolean;
}

export interface GeneralCultivationLog {
  id?: string;
  date: string;
  title: string;
  instructions: string;
  materials: string;
}

export interface FarmLocation {
  lat: number;
  lng: number;
  address: string;
  commune: string;
  altitudeM: number;
  soilType: string;
  waterSource: string;
  mapZoom?: number;
}

export interface ProduceItem {
  id: string;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
  name: string;
  category: 'lychee' | 'orange' | 'mandarin' | 'pomelo' | 'apple' | 'longan' | 'guava' | 'grape' | 'other';
  price: number;
  unit: string;
  origin: string;
  farmer: string;
  farmerPhone: string;
  rating: number;
  reviewCount: number;
  inStock: number;
  image: string;
  certifications: ('VietGAP' | 'GlobalGAP' | 'OCOP 4 sao' | 'OCOP 5 sao' | 'Hữu cơ')[];
  harvestSeason: string;
  sweetnessBrix?: number;
  description: string;
  featured?: boolean;
  vietgapCode: string;
  farmerProfile: FarmerProfile;
  location: FarmLocation;
  cultivationLog: {
    watering: WateringLog[];
    fertilizing: FertilizingLog[];
    pestProtection: PestProtectionLog[];
    general?: GeneralCultivationLog[];
  };
}

export interface FarmZone {
  id: string;
  name: string;
  crop: string;
  areaHa: number;
  treeCount: number;
  treeAge: number;
  soilMoisture: number;
  soilPh: number;
  healthStatus: 'Tuyệt vời' | 'Bình thường' | 'Cần chú ý';
  lastWatered: string;
  irrigationStatus: 'idle' | 'running';
  expectedYieldTons: number;
  coordinates: { x: number; y: number; z: number };
  color: string;
}

export interface CalendarTask {
  id: string;
  crop: string;
  title: string;
  date: string;
  // Người dùng có thể nhập giai đoạn canh tác tùy chỉnh trong nhật ký.
  stage: string;
  priority: 'Cao' | 'Trung bình' | 'Thấp';
  completed: boolean;
  assignedTo: string;
  instructions: string;
  materialsNeeded: string[];
  logType?: 'watering' | 'fertilizing' | 'pest' | 'general';
  logDetail?: string;
}

export interface WeatherDay {
  date: string;
  dayName: string;
  condition: string;
  icon: string;
  tempHigh: number;
  tempLow: number;
  humidity: number;
  rainfallMm: number;
  windSpeedKmH: number;
  agriAdvice: string;
}

export interface DiseaseRecord {
  id: string;
  name: string;
  plant: string;
  confidence: number;
  severity: 'Nhẹ' | 'Trung bình' | 'Nghiêm trọng';
  symptoms: string[];
  causes: string;
  treatment: {
    biological: string[];
    chemicalIfSevere: string[];
    prevention: string[];
  };
}

export interface CartItem {
  item: ProduceItem;
  quantity: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'packing' | 'shipping' | 'completed' | 'cancelled';

export interface BuyerDetails {
  name: string;
  phone: string;
  address: string;
}

export interface FarmOrder {
  id: string;
  checkoutId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  total: number;
  buyer: BuyerDetails;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  sellerNote: string;
}
