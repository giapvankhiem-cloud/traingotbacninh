import type { ConsultationExpert } from '../types/consultations';
import { isValidPhone } from './orders';

export type ExpertProfileDetails = Pick<ConsultationExpert, 'avatar' | 'badge' | 'experienceYears' | 'coverCrops' | 'qualifications' | 'contactEmail' | 'zalo'>;

function optionalText(value: unknown, max: number, label: string) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`${label} chưa hợp lệ.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label}: tối đa ${max} ký tự.`);
  return result;
}
function list(value: unknown, max: number, label: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) throw new Error(`${label}: tối đa 12 mục.`);
  return [...new Set(value.map(item => {
    const result = optionalText(item, max, label);
    if (!result) throw new Error(`${label}: mỗi mục cần có nội dung.`);
    if (result.includes('\u001f')) throw new Error(`${label}: nội dung có ký tự phân cách không hợp lệ.`);
    return result;
  }))];
}

/** Only explicitly supplied public profile fields are returned; login email is never copied. */
export function normalizeExpertProfileDetails(value: Partial<ConsultationExpert>): ExpertProfileDetails {
  const result: ExpertProfileDetails = {};
  const avatar = optionalText(value.avatar, 1200, 'Ảnh đại diện');
  if (avatar) {
    if (!/^https:\/\/[^/@?# :\s]+(:[0-9]+)?([/?#][^\s]*)?$/.test(avatar)) throw new Error('Ảnh đại diện cần là liên kết HTTPS hợp lệ.');
    result.avatar = avatar;
  }
  const badge = optionalText(value.badge, 80, 'Nhóm chuyên gia');
  if (badge) result.badge = badge;
  if (value.experienceYears !== undefined) {
    if (!Number.isInteger(value.experienceYears) || value.experienceYears < 0 || value.experienceYears > 70) throw new Error('Số năm kinh nghiệm cần là số nguyên từ 0 đến 70.');
    result.experienceYears = value.experienceYears;
  }
  const coverCrops = list(value.coverCrops, 100, 'Cây trồng phụ trách');
  if (coverCrops.length) result.coverCrops = coverCrops;
  const qualifications = list(value.qualifications, 200, 'Bằng cấp & chứng chỉ');
  if (qualifications.length) result.qualifications = qualifications;
  const contactEmail = optionalText(value.contactEmail, 254, 'Email liên hệ công khai');
  if (contactEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error('Email liên hệ công khai chưa hợp lệ.');
    result.contactEmail = contactEmail;
  }
  const zalo = optionalText(value.zalo, 30, 'Số Zalo công khai');
  if (zalo) {
    if (!isValidPhone(zalo, 30)) throw new Error('Số Zalo công khai chưa hợp lệ.');
    result.zalo = zalo;
  }
  return result;
}
