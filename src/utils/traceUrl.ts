export function buildTraceUrl(productId: string, siteUrl: string) {
  const url = new URL(siteUrl);
  url.hash = `trace/${encodeURIComponent(productId)}`;
  return url.toString();
}
