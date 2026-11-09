import React, { useEffect, useRef, useState } from 'react';
import { Menu, ShoppingBag, ChevronDown, LogOut, UserRound, MapPin, FilePenLine, Plus, Pencil, X } from 'lucide-react';
import type { ActiveTab, FarmerAccount } from '../types/agriculture';
import { Brand } from './Brand';
import { publicAssetUrl } from '../utils/assetUrl';
interface HeaderProps {
  onOpenSidebar: () => void; activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void; cartCount: number;
  onOpenCart: () => void; currentFarmer: FarmerAccount; isLoggedIn: boolean; onLogout: () => void;
  onOpenQuickLogin: () => void; onOpenDeclareOrchard?: () => void; onOpenAddProduce?: () => void;
  onOpenEditProduce?: () => void; onSelectFarmer?: (farmer: FarmerAccount) => void;
}
const pageTitles: Record<ActiveTab, string> = { market: 'Sạp trái cây', overview: 'Trang trại của tôi', garden_map: 'Vị trí khu vườn', weather: 'Thời tiết', calendar: 'Lịch canh tác', orders: 'Quản lý đơn hàng', community: 'Cộng đồng nhà vườn', assistant: 'Trợ lý canh tác', admin: 'Quản trị & Duyệt hồ sơ' };
export function Header({ activeTab, setActiveTab, onOpenSidebar, cartCount, onOpenCart, currentFarmer, isLoggedIn, onLogout, onOpenQuickLogin, onOpenDeclareOrchard, onOpenAddProduce, onOpenEditProduce }: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!profileOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileRef.current?.querySelector<HTMLButtonElement>('.profile-toggle')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, tab: ActiveTab, section?: string) => {
    event.preventDefault(); setActiveTab(tab);
    if (section) requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }));
    else requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };
  return <>
    <header className="site-header"><div className="header-inner"><button onClick={onOpenSidebar} className="menu-toggle" aria-label="Mở menu điều hướng"><Menu size={22} /></button><a href={publicAssetUrl('')} className="brand-link" aria-label="Trái ngọt Bắc Ninh - Trang chủ" onClick={(event) => navigate(event, 'market')}><Brand /></a>
      <nav className="header-nav" aria-label="Điều hướng chính"><a className={activeTab === 'market' ? 'active' : ''} href={publicAssetUrl('#sap-nong-san')} onClick={(event) => navigate(event, 'market', 'sap-nong-san')}>Trái cây</a><a href={publicAssetUrl('#hanh-trinh')} onClick={(event) => navigate(event, 'market', 'hanh-trinh')}>Câu chuyện từ vườn</a><a className={activeTab === 'community' ? 'active' : ''} href="#cong-dong" onClick={(event) => navigate(event, 'community')}>Cộng đồng</a>{isLoggedIn && <a href="#vuon-cua-toi" onClick={(event) => navigate(event, 'overview')}>Vườn của tôi</a>}</nav>
      <div className="header-actions"><button className="cart-toggle" onClick={onOpenCart} aria-label="Giỏ hàng trái cây"><ShoppingBag size={21} /><span className="cart-count">{cartCount}</span></button>{!isLoggedIn ? <button className="header-login" aria-label="Đăng nhập nhà vườn" onClick={onOpenQuickLogin}><UserRound size={17} /><span>Đăng nhập nhà vườn</span></button> : <div className="profile-wrap" ref={profileRef}><button className="profile-toggle" onClick={() => setProfileOpen(open => !open)} aria-expanded={profileOpen} aria-label={`Tài khoản ${currentFarmer.name}`}><img src={currentFarmer.avatar || publicAssetUrl('farmer-avatar.svg')} alt="" width="36" height="36" /><span>{currentFarmer.name}</span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-popover"><div className="profile-summary"><strong>{currentFarmer.name}</strong><p><MapPin size={14} />{currentFarmer.location || 'Chưa khai báo vị trí vườn'}</p><small>{currentFarmer.areaHa} ha · {currentFarmer.treeCount} gốc cây</small></div><button onClick={() => { setProfileOpen(false); onOpenDeclareOrchard?.(); }}><FilePenLine size={17} />Thông tin & vị trí vườn</button><button onClick={() => { setProfileOpen(false); onOpenAddProduce?.(); }}><Plus size={17} />Đăng bán trái cây mới</button><button onClick={() => { setProfileOpen(false); onOpenEditProduce?.(); }}><Pencil size={17} />Sửa bài đăng & giá bán</button><button onClick={() => { setProfileOpen(false); onOpenQuickLogin(); }}><UserRound size={17} />Tài khoản & xác minh email</button><button onClick={() => { setProfileOpen(false); onLogout(); }} className="logout-button"><LogOut size={17} />Đăng xuất</button><button onClick={() => setProfileOpen(false)}><X size={16} />Đóng</button></div>}</div>}</div>
    </div></header>{activeTab !== 'market' && <div className="workspace-title"><p className="eyebrow">TRÁI NGỌT BẮC NINH</p><h1>{pageTitles[activeTab]}</h1></div>}</>;
}
