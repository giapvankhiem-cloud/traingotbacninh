/**
 * Resolves a public asset for both local Vite and a GitHub Pages project site.
 * Do not use root-relative `/assets/...` URLs directly: they omit the
 * repository name on GitHub Pages and cause image requests to 404.
 */
export const publicAssetUrl = (path: string): string =>
  `${import.meta.env?.BASE_URL || '/'}${path.replace(/^\//, '')}`;

/** Built-in media stored in Firestore can be read by both Hosting and Pages. */
export function storedAssetUrl(path: string): string {
  if (!/^\/(?:assets\/|images\/|(?:farmer-avatar|produce-placeholder)\.svg$)/.test(path)) return path;
  const origin = import.meta.env?.VITE_PUBLIC_SITE_URL;
  return origin ? new URL(path.slice(1), origin).href : publicAssetUrl(path);
}
