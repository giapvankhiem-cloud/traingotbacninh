import React, { useState } from 'react';
import {
  MapPin,
  ExternalLink,
  Mountain,
  Droplet,
  Compass,
  Navigation,
  Copy,
  Check,
} from 'lucide-react';
import { FarmLocation } from '../types/agriculture';

interface GardenLocationMapProps {
  location: FarmLocation;
  farmerName: string;
  produceName: string;
}

export const GardenLocationMap: React.FC<GardenLocationMapProps> = ({
  location,
  farmerName,
  produceName,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  const embedUrl = `https://maps.google.com/maps?q=${location.lat},${location.lng}&t=${
    mapType === 'satellite' ? 'k' : 'm'
  }&z=15&output=embed`;

  const copyCoords = () => {
    navigator.clipboard.writeText(`${location.lat}, ${location.lng}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Location Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-emerald-100 text-accent">
            <MapPin className="w-4 h-4" />
          </span>
          <div>
            <h4 className="ui-label-title text-ink">
              Vị Trí Khu Vườn Trên Bản Đồ Google Maps
            </h4>
            <p className="text-xs text-muted">{location.address}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Map Layer Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setMapType('standard')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                mapType === 'standard'
                  ? 'bg-white text-accent shadow-2xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Bản đồ
            </button>
            <button
              onClick={() => setMapType('satellite')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                mapType === 'satellite'
                  ? 'bg-white text-accent shadow-2xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Vệ tinh
            </button>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors shadow-2xs"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Mở Google Maps</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>
        </div>
      </div>

      {/* Embedded Google Map Frame */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 shadow-inner bg-slate-100 h-64 sm:h-72">
        <iframe
          title={`Google Map - ${produceName}`}
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          className="w-full h-full"
        />

        {/* Live coordinate overlay badge */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="font-semibold text-ink">
            GPS: {Math.abs(location.lat).toFixed(4)}° {location.lat >= 0 ? 'N' : 'S'}, {Math.abs(location.lng).toFixed(4)}° {location.lng >= 0 ? 'E' : 'W'}
          </span>
          <button
            onClick={copyCoords}
            className="text-muted hover:text-accent p-0.5 rounded transition-colors"
            title="Sao chép toạ độ"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Bottom garden pin badge */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-black/75 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between sm:justify-start gap-2">
          <span>🏡 Vườn: <strong>{farmerName}</strong> ({location.commune})</span>
        </div>
      </div>

      {/* Geographic & Terroir Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="flex items-center gap-1.5 text-muted mb-0.5">
            <Mountain className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold text-xs">Độ cao & Thổ nhưỡng</span>
          </div>
          <p className="font-semibold text-ink">Độ cao: {location.altitudeM}m</p>
          <p className="text-xs text-body truncate">{location.soilType}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="flex items-center gap-1.5 text-muted mb-0.5">
            <Droplet className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-xs">Nguồn nước canh tác</span>
          </div>
          <p className="font-semibold text-ink truncate">{location.waterSource}</p>
          <p className="text-xs text-muted font-semibold">Thông tin do nhà vườn khai báo</p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="flex items-center gap-1.5 text-muted mb-0.5">
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold text-xs">Vùng chỉ dẫn địa lý</span>
          </div>
          <p className="font-semibold text-ink">{location.commune}</p>
          <p className="text-xs text-muted">Mã định danh vùng trồng quốc gia</p>
        </div>
      </div>
    </div>
  );
};
