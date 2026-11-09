export interface GardenMedia { type: 'image' | 'video'; url: string; caption: string }
export const MAX_MEDIA = 6;
export function youtubeId(value: string): string | null {
  try { const u = new URL(value); const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : ['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname) ? (u.pathname === '/watch' ? u.searchParams.get('v') : u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]) : null; return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null; } catch { return null; }
}
export function normalizeVideoUrl(value: string): string {
  const u = new URL(value.trim());
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Liên kết video cần dùng HTTPS.');
  const id = youtubeId(u.href); return id ? 'https://www.youtube.com/watch?v=' + id : u.href;
}
export function validVideoUrl(value: string): boolean {
  try { const u = new URL(value); return value.length <= 1200 && u.protocol === 'https:' && !u.username && !u.password && !/\s/.test(value) && (!!youtubeId(value) || /^https:\/\/[^/@?# :]+(:[0-9]+)?\/[^ ]+\.([mM][pP]4|[wW][eE][bB][mM])([?#][^ ]*)?$/.test(value)); } catch { return false; }
}
export function validMediaItem(item: unknown): item is GardenMedia {
  if (!item || typeof item !== 'object') return false;
  const m = item as GardenMedia;
  return Object.keys(m).every(k => ['type','url','caption'].includes(k)) && typeof m.caption === 'string' && m.caption.length <= 160 && typeof m.url === 'string' && (m.type === 'image' ? m.url.length <= 65000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(m.url) : m.type === 'video' && validVideoUrl(m.url));
}
export function validateMedia(items: unknown): asserts items is GardenMedia[] {
  if (!Array.isArray(items) || items.length > MAX_MEDIA || !items.every(validMediaItem)) throw new Error('Tối đa 6 ảnh/video. Ảnh hoặc liên kết video chưa hợp lệ.');
}
