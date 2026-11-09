export interface ConsultationExpert {
  id: string;
  name: string;
  title: string;
  organization: string;
  specialties: string;
  bio: string;
  phone: string;
  availability: string;
  avatar?: string;
  badge?: string;
  experienceYears?: number;
  coverCrops?: string[];
  qualifications?: string[];
  contactEmail?: string;
  zalo?: string;
  active: boolean;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  internalAccount: boolean;
  updatedAt: number;
  updatedBy: string;
}
export const expertStatusLabels = { pending: 'Chờ xác nhận', active: 'Đã xác nhận', suspended: 'Tạm dừng', revoked: 'Đã hủy quyền tư vấn' };
export type ConsultationStatus = 'waiting' | 'in_progress' | 'closed';
export type ConsultationRole = 'farmer' | 'expert' | 'admin';
export interface ConsultationDraft {
  expertId: string;
  question: string;
  crop: string;
}
export interface Consultation {
  id: string;
  farmerId: string;
  farmerName: string;
  subject: string;
  question: string;
  crop: string;
  expertId: string;
  expertName: string;
  status: ConsultationStatus;
  revision: number;
  messageCount: number;
  lastMessage: string;
  lastMessageId: string;
  lastSenderRole: ConsultationRole;
  createdAt: number;
  updatedAt: number;
}
export interface ConsultationMessage {
  id: string;
  senderId: string;
  senderRole: ConsultationRole;
  senderName: string;
  body: string;
  createdAt: number;
}
export const consultationStatusLabels: Record<ConsultationStatus, string> = {
  waiting: 'Chờ phản hồi', in_progress: 'Đang trao đổi', closed: 'Đã kết thúc',
};
