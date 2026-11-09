export function Brand({ light = false }: { light?: boolean }) {
  return <span className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M11 26C8 13 19 8 31 9c1 12-3 22-16 21" fill="currentColor" opacity=".85"/><path d="M10 33 27 15M16 26l-1-8m7 2 6 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg></span><span className="brand-words"><strong>Trái ngọt</strong><small>BẮC NINH</small></span></span>;
}
