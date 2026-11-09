import type { FarmOrder, OrderStatus } from '../types/agriculture';

export const ORDER_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ nhà vườn xác nhận', confirmed: 'Đã xác nhận', packing: 'Đang đóng gói',
  shipping: 'Đang giao hàng', completed: 'Hoàn tất', cancelled: 'Đã hủy',
};

export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['packing', 'cancelled'],
  packing: ['shipping', 'cancelled'], shipping: ['completed'], completed: [], cancelled: [],
};

export function canChangeOrderStatus(current: OrderStatus, next: OrderStatus) {
  return ORDER_NEXT[current]?.includes(next) ?? false;
}

export function isValidPhone(phone: string, maxLength = 20) {
  if (typeof phone !== 'string') return false;
  const value = phone.trim();
  return value.length <= maxLength && /^[+\d ()-]+$/.test(value) && value.replace(/\D/g, '').length >= 8;
}

export function validateBuyer(buyer: FarmOrder['buyer']) {
  if (!buyer.name.trim() || buyer.name.length > 100) throw new Error('Họ tên người nhận không hợp lệ.');
  if (!isValidPhone(buyer.phone)) throw new Error('Số điện thoại không hợp lệ.');
  if (buyer.address.trim().length < 8 || buyer.address.length > 500) throw new Error('Vui lòng nhập địa chỉ giao hàng đầy đủ.');
}
