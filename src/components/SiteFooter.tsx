import { ArrowUpRight } from 'lucide-react';
import { Brand } from './Brand';
import { publicAssetUrl } from '../utils/assetUrl';
export function SiteFooter({ onJoin }: { onJoin?: () => void }) {
  return (
    <footer id="site-footer" className="site-footer">
      <picture aria-hidden="true">
        <source media="(max-width: 760px)" srcSet={publicAssetUrl('images/footer-regional-fruits-mobile.jpg')} />
        <img className="footer-background" src={publicAssetUrl('images/footer-regional-fruits.jpg')} width="2172" height="724" alt="" loading="lazy" decoding="async" />
      </picture>
      <div className="footer-content">
        <div className="footer-top">
          <div>
            <p className="eyebrow">DÀNH CHO NHÀ VƯỜN</p>
            <h2>Giới thiệu khu vườn.<br /><em>Kết nối người mua.</em></h2>
          </div>
          <div>
            <p>Chia sẻ hành trình canh tác, giới thiệu trái cây và kết nối với người mua.</p>
            <button onClick={onJoin} className="button-light">Tham gia nhà vườn<ArrowUpRight size={19} /></button>
          </div>
        </div>
        <div className="footer-bottom">
          <a href={publicAssetUrl('')} aria-label="Trái ngọt Bắc Ninh - Trang chủ"><Brand light /></a>
          <p>Kết nối trực tiếp nhà vườn và người tiêu dùng.<br />Thông tin minh bạch, lựa chọn có hiểu biết.</p>
          <nav aria-label="Liên kết cuối trang">
            <a href={publicAssetUrl('#sap-nong-san')}>Sạp trái cây</a>
            <a href={publicAssetUrl('#hanh-trinh')}>Truy xuất nguồn gốc</a>
            <a href={publicAssetUrl('sitemap.xml')}>Sơ đồ website</a>
          </nav>
        </div>
        <div className="footer-legal">
          <span>© {new Date().getFullYear()} Trái ngọt Bắc Ninh</span>
          <span>Trân trọng mùa màng. Trân trọng người trồng.</span>
        </div>
      </div>
    </footer>
  );
}
