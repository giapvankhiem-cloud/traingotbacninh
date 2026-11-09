export interface AdminContact {
  name?: string;
  role: string;
  phone: string;
}

// Only list phone numbers approved for public display.
export const adminContacts: readonly AdminContact[] = [
  { role: 'Quản trị viên', phone: '0975052302' },
  { name: 'Lương Thị Khánh Chi', role: 'Hỗ trợ đăng ký tài khoản', phone: '0344210019' },
  { name: 'Trần Quang Duy', role: 'Hỗ trợ kỹ thuật', phone: '0347858829' },
];
