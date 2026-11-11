import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { publicAssetUrl } from '../utils/assetUrl';

// Vite bundles these URLs; Node can also render the public HTML without a JPG loader.
const lychee = new URL('../../ANH/TRAI_VAI.jpg', import.meta.url).href;
const canhOrange = new URL('../../ANH/CAM-CANH.jpg', import.meta.url).href;
const pomelo = new URL('../../ANH/BUOI_DIEN.jpg', import.meta.url).href;
const vinhOrange = new URL('../../ANH/CAM_VINH.jpg', import.meta.url).href;
const pomeloHarvest = new URL('../../ANH/THU_HOACH_BUOI.jpg', import.meta.url).href;

const slides = [
  { src: lychee, label: 'Vải thiều', alt: 'Chùm vải thiều chín đỏ trên cành' },
  { src: canhOrange, label: 'Cam đường Canh', alt: 'Cam đường Canh trong mùa thu hoạch' },
  { src: pomelo, label: 'Bưởi Diễn', alt: 'Bưởi Diễn từ nhà vườn' },
  { src: vinhOrange, label: 'Mùa cam Vinh', alt: 'Nhà vườn thu hoạch cam Vinh trên cây' },
  { src: pomeloHarvest, label: 'Mùa thu hoạch bưởi', alt: 'Nhà vườn hái những trái bưởi chín vàng' },
];

export function HeroSlideshow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(preference?.matches ?? false);
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion(); syncVisibility();
    preference?.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      preference?.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (paused || hovered || hidden || reducedMotion) return;
    const timer = window.setTimeout(() => setActive(index => (index + 1) % slides.length), 5000);
    return () => window.clearTimeout(timer);
  }, [active, paused, hovered, hidden, reducedMotion]);

  return (
    <figure className="hero-visual hero-slideshow" aria-roledescription="trình chiếu" aria-label="Ảnh trái cây từ nhà vườn" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="hero-slides">
        {slides.map((slide, index) => (
          <img key={slide.src} className={index === active ? 'hero-slide is-active' : 'hero-slide'} src={slide.src.startsWith('file:') ? (index === 0 ? publicAssetUrl('images/lychee-season.jpg') : undefined) : slide.src} width="1000" height="663" alt={index === active ? slide.alt : ''} aria-hidden={index !== active} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
        ))}
      </div>
      <figcaption className="hero-photo-label"><span>HƯƠNG VỊ TỪ NÚI ĐỒI</span><strong>Theo mùa thu hoạch<br />Gần hơn với người trồng.</strong></figcaption>
      <span className="photo-note">{slides[active].label} · {active + 1}/{slides.length}</span>
      <div className="hero-slide-controls" aria-label="Điều khiển ảnh trái cây">
        {slides.map((slide, index) => (
          <button key={slide.src} type="button" className="hero-slide-dot" aria-label={`Xem ảnh ${index + 1}: ${slide.label}`} aria-pressed={index === active} onFocus={() => setPaused(true)} onClick={() => { setActive(index); setPaused(true); }}><span /></button>
        ))}
        {!reducedMotion && <button type="button" className="hero-slide-play" aria-label={paused ? 'Tiếp tục chuyển ảnh' : 'Tạm dừng chuyển ảnh'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>}
      </div>
    </figure>
  );
}
