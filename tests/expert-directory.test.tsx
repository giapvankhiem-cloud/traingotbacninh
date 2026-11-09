import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { ConsultationExpert } from '../src/types/consultations';

let server: ViteDevServer;
let dom: JSDOM;
let ExpertDirectory: any;
let render: any, screen: any, fireEvent: any, cleanup: any, within: any;

const expert = (id: string, name: string, patch: Partial<ConsultationExpert>): ConsultationExpert => ({
  id, name, title: 'Kỹ sư trồng trọt', organization: 'Đơn vị tư vấn kiểm thử',
  specialties: 'Cây ăn quả', bio: '', phone: '', availability: '', active: true,
  status: 'active', internalAccount: false, updatedAt: 1, updatedBy: 'fixture', ...patch,
});
const experts = [
  expert('citrus', 'Nguyễn Văn Dũng', {
    specialties: 'Cây có múi, Cam đường Canh, VietGAP',
    bio: 'Tư vấn chăm sóc cây có múi theo tình trạng thực tế của vườn.',
    availability: 'Thứ 2 đến thứ 6',
  }),
  expert('lychee', 'Lê Thị Hoa', {
    title: 'Cán bộ khuyến nông', specialties: 'Vải thiều, Nhãn, Phân bón hữu cơ',
    bio: 'Tư vấn lịch chăm sóc vải và nhãn.', availability: 'Buổi sáng',
    phone: '0901234567', zalo: '0901234567', contactEmail: 'hoa-public@example.test',
    avatar: 'https://example.test/hoa.jpg', badge: 'Khuyến nông địa phương', experienceYears: 15,
    coverCrops: ['Vải thiều', 'Nhãn Hương Chi'], qualifications: ['Kỹ sư trồng trọt', 'Chứng chỉ khuyến nông'],
  }),
  expert('protection', 'Trần Minh Quang', {
    title: 'Kỹ sư bảo vệ thực vật', specialties: 'Bảo vệ thực vật, Dịch hại tổng hợp',
    bio: 'Tư vấn quản lý dịch hại trên cây ăn quả.',
  }),
];

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:4173' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: (fn: any) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
  ({ render, screen, fireEvent, cleanup, within } = await import('@testing-library/react'));
  server = await createServer({
    configFile: false,
    envDir: '.tools/no-env',
    cacheDir: '.tools/vite-expert-directory',
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ ExpertDirectory } = await server.ssrLoadModule('/src/components/ExpertDirectory.tsx'));
});
afterEach(() => cleanup());
after(async () => { await server?.close(); dom?.window.close(); });

const nameVisible = (name: string) => Boolean(screen.queryByRole('heading', { name, exact: true }));

test('directory combines accent-insensitive search with topic filters and resets both', () => {
  render(<ExpertDirectory experts={experts} loading={false} onChat={() => {}} />);
  const search = screen.getByRole('searchbox', { name: 'Tìm chuyên gia' });
  fireEvent.change(search, { target: { value: 'nguyen van dung' } });
  assert.equal(nameVisible(experts[0].name), true);
  assert.equal(nameVisible(experts[1].name), false);
  fireEvent.click(screen.getByRole('button', { name: 'Cây có múi', exact: true }));
  assert.equal(nameVisible(experts[0].name), true);
  fireEvent.change(search, { target: { value: 'hoa' } });
  assert.equal(experts.some(p => nameVisible(p.name)), false);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc', exact: true }));
  assert.equal(search.value, '');
  for (const p of experts) assert.equal(nameVisible(p.name), true);
  fireEvent.click(screen.getByRole('button', { name: 'Vải & nhãn', exact: true }));
  assert.equal(nameVisible(experts[1].name), true);
  assert.equal(nameVisible(experts[0].name), false);
  fireEvent.change(search, { target: { value: 'nhan huong chi' } });
  assert.equal(nameVisible(experts[1].name), true);
});

test('full profile displays published expert information and chat preserves the chosen expert', () => {
  const contacted: string[] = [];
  render(<ExpertDirectory experts={experts} loading={false} onChat={(p: ConsultationExpert) => contacted.push(p.id)} />);
  const card = screen.getByRole('heading', { name: experts[1].name, exact: true }).closest('article');
  assert.ok(card);
  fireEvent.click(within(card).getByRole('button', { name: 'Xem hồ sơ', exact: true }));
  const profile = screen.getByRole('region', { name: `Hồ sơ chuyên gia ${experts[1].name}`, exact: true });
  for (const value of [experts[1].bio, experts[1].title, experts[1].organization, experts[1].availability, experts[1].badge, ...experts[1].qualifications!, 'Nhãn Hương Chi']) assert.ok(within(profile).getByText(value!, { exact: false }));
  assert.equal(within(profile).getByRole('img',{name:experts[1].name,exact:true}).getAttribute('src'),experts[1].avatar);
  assert.ok(within(profile).getByText(/15/));
  const contacts=within(profile).getAllByRole('link');
  assert.equal(contacts.some((link: HTMLAnchorElement)=>link.getAttribute('href')==='tel:0901234567'),true);
  assert.equal(contacts.some((link: HTMLAnchorElement)=>link.getAttribute('href')==='mailto:hoa-public@example.test'),true);
  assert.equal(Boolean(screen.queryByRole('searchbox',{name:'Tìm chuyên gia'})),false);
  fireEvent.click(within(profile).getByRole('button', { name: 'Chat ngay', exact: true }));
  assert.deepEqual(contacted, [experts[1].id]);
  assert.equal(Boolean(screen.queryByRole('region',{name:`Hồ sơ chuyên gia ${experts[1].name}`,exact:true})), false);
  const otherCard = screen.getByRole('heading', { name: experts[0].name, exact: true }).closest('article');
  fireEvent.click(within(otherCard).getByRole('button', { name: 'Chat ngay', exact: true }));
  assert.deepEqual(contacted, [experts[1].id, experts[0].id]);
});

test('full profile returns to the directory and disables chat to the signed-in expert themself', () => {
  let contacted = false;
  render(<ExpertDirectory experts={experts} loading={false} currentUserId={experts[0].id} onChat={() => { contacted = true; }} />);
  const card = screen.getByRole('heading', { name: experts[0].name, exact: true }).closest('article');
  const chat = within(card).getByRole('button', { name: 'Hồ sơ của bạn', exact: true });
  assert.equal(chat.disabled, true);
  fireEvent.click(chat);
  assert.equal(contacted, false);
  fireEvent.click(within(card).getByRole('button', { name: 'Xem hồ sơ', exact: true }));
  const profile = screen.getByRole('region', { name: `Hồ sơ chuyên gia ${experts[0].name}`, exact: true });
  assert.equal(within(profile).getByRole('button', { name: 'Hồ sơ của bạn', exact: true }).disabled, true);
  fireEvent.click(within(profile).getByRole('button',{name:'Danh sách chuyên gia',exact:true}));
  assert.equal(Boolean(screen.queryByRole('region',{name:`Hồ sơ chuyên gia ${experts[0].name}`,exact:true})),false);
  assert.ok(screen.getByRole('searchbox',{name:'Tìm chuyên gia'}));
  assert.ok(screen.getByRole('heading',{name:experts[0].name,exact:true}));
});

test('profile shows an explicit introduction experience count for older expert records', () => {
  const person = experts[0];
  const bio = 'Giới thiệu chuyên gia\n18 năm kinh nghiệm tư vấn trồng trọt.';
  const props = { loading: false, onChat: () => {} };
  const view = render(<ExpertDirectory {...props} experts={[{ ...person, bio }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xem hồ sơ', exact: true }));

  const metrics = within(screen.getByLabelText('Thông tin chuyên gia'));
  assert.ok(metrics.getByText('18', { exact: true }));
  assert.ok(metrics.getByText('Năm kinh nghiệm theo giới thiệu'));

  view.rerender(<ExpertDirectory {...props} experts={[{ ...person, bio, experienceYears: 0 }]} />);
  assert.ok(metrics.getByText('0', { exact: true }));
  assert.equal(metrics.queryByText('18', { exact: true }), null);
  assert.ok(metrics.getByText('Năm kinh nghiệm', { exact: true }));

  for (const invalidBio of ['71 năm kinh nghiệm tư vấn.', 'Đã tư vấn 18 năm kinh nghiệm.', '18 năm kinh nghiệm tư vấn.\n20 năm kinh nghiệm nghiên cứu.']) {
    view.rerender(<ExpertDirectory {...props} experts={[{ ...person, bio: invalidBio }]} />);
    assert.equal(metrics.queryByText('Năm kinh nghiệm theo giới thiệu'), null);
    assert.ok(metrics.getByText('Năm kinh nghiệm', { exact: true }));
  }
});

test('full profile updates when public details change and disappears after expert withdrawal', () => {
  const view=render(<ExpertDirectory experts={experts} loading={false} onChat={()=>{}} />);
  const card=screen.getByRole('heading',{name:experts[1].name,exact:true}).closest('article');
  fireEvent.click(within(card).getByRole('button',{name:'Xem hồ sơ',exact:true}));
  const updated=experts.map(p=>p.id===experts[1].id?{...p,bio:'Giới thiệu mới đã được quản trị cập nhật.'}:p);
  view.rerender(<ExpertDirectory experts={updated} loading={false} onChat={()=>{}} />);
  assert.ok(screen.getByText('Giới thiệu mới đã được quản trị cập nhật.'));
  view.rerender(<ExpertDirectory experts={updated.filter(p=>p.id!==experts[1].id)} loading={false} onChat={()=>{}} />);
  assert.equal(Boolean(screen.queryByRole('region',{name:`Hồ sơ chuyên gia ${experts[1].name}`,exact:true})),false);
  assert.ok(screen.getByRole('searchbox',{name:'Tìm chuyên gia'}));
});

test('directory does not invent template experts, online presence, ratings or consultation totals', () => {
  const { container } = render(<ExpertDirectory experts={[]} loading={false} onChat={() => {}} />);
  assert.equal(screen.queryAllByRole('button', { name: 'Chat ngay', exact: true }).length, 0);
  assert.doesNotMatch(container.textContent || '', /4\.6\s*K|4\.9|847|1[.,]243|đang trực tuyến|đang online|miễn phí 100%/i);
  for (const p of experts) assert.equal(nameVisible(p.name), false);
});
