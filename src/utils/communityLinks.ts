import { publicAssetUrl } from './assetUrl';

const postHashPrefix = '#bai-viet/';

export function readCommunityPostId(hash: string): string {
  if (!hash.startsWith(postHashPrefix)) return '';
  try {
    const id = decodeURIComponent(hash.slice(postHashPrefix.length));
    if (!id || id === '.' || id === '..' || id.includes('/') || id.includes('\0')
      || /^__.*__$/s.test(id) || new TextEncoder().encode(id).length > 1500) return '';
    return id;
  } catch {
    return '';
  }
}

export function communityPostUrl(postId: string): string {
  return new URL(publicAssetUrl(postHashPrefix + encodeURIComponent(postId)), window.location.origin).href;
}
