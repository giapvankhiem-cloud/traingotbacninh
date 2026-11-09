import React from 'react';
import {
  Home,
  MapPin,
  CloudSun,
  CalendarDays,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { ActiveTab } from '../types/agriculture';
import { Brand } from './Brand';
import { FruitLogo } from './FruitLogo';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpen: boolean;
  onClose: () => void;
  cartCount: number;
  isAdmin?: boolean;
  permanent?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  cartCount,
  isAdmin = false,
  permanent = false,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string; emoji: string }[] = [
    { id: 'overview', label: 'Tổng quan', icon: <Home className="w-5 h-5" />, emoji: '🏡' },
    { id: 'garden_map', label: 'Vị trí khu vườn', icon: <MapPin className="w-5 h-5" />, emoji: '🗺️' },
    { id: 'weather', label: 'Thời tiết', icon: <CloudSun className="w-5 h-5" />, emoji: '☀️' },
    { id: 'calendar', label: 'Lịch canh tác', icon: <CalendarDays className="w-5 h-5" />, emoji: '📅' },
    { id: 'orders', label: 'Quản lý đơn hàng', icon: <ShoppingBag className="w-5 h-5" />, emoji: '📦' },
    {
      id: 'market',
      label: 'Sạp trái cây',
      icon: <ShoppingBag className="w-5 h-5" />,
      emoji: '🍊',
      badge: cartCount > 0 ? `${cartCount}` : undefined,
    },
    { id: 'community', label: 'Cộng đồng', icon: <Users className="w-5 h-5" />, emoji: '👨‍🌾' },
    {
      id: 'assistant',
      label: 'Trợ lý & Chuyên gia',
      icon: <FruitLogo fruit="orange" className="text-xl" />,
      emoji: '🍊',
      badge: 'AI',
    },
  ];
  if (isAdmin) navItems.push({ id: 'admin', label: 'Quản trị & Duyệt hồ sơ', icon: <Users className="w-5 h-5" />, emoji: '🛡️' });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className={`fixed inset-0 bg-emerald-950/35 z-40 backdrop-blur-xs transition-opacity ${permanent ? 'lg:hidden' : ''}`}
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 flex flex-col justify-between transition-transform duration-300 ease-in-out ${permanent ? 'lg:translate-x-0 lg:visible' : ''} ${
          isOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'
        } shadow-xl border-r font-sans site-sidebar ${permanent ? 'sidebar-permanent' : ''}`}
      >
        {/* Top Header & Navigation */}
        <div className="flex flex-col flex-1 overflow-y-auto px-4 pt-5 pb-3">

          {/* Logo Brand Header */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b">
            <Brand />

            <button
              onClick={onClose}
              aria-label="Đóng menu điều hướng"
              className={`${permanent ? 'lg:hidden' : ''} sidebar-close rounded-lg cursor-pointer`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`sidebar-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 text-left cursor-pointer group ${
                    isActive
                      ? 'sidebar-nav-active font-semibold'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="sidebar-nav-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
                    >
                      {item.icon}
                    </span>
                    <span className="leading-tight">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className="sidebar-badge text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

      </aside>
    </>
  );
};
