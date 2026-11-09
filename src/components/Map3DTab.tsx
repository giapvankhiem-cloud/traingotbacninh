import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Droplets,
  RotateCw,
  Compass,
  Thermometer,
} from 'lucide-react';
import { FARM_ZONES } from '../data/mockData';
import { FarmZone } from '../types/agriculture';

export const Map3DTab: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedZone, setSelectedZone] = useState<FarmZone>(FARM_ZONES[0]);
  const [isIrrigationActive, setIsIrrigationActive] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'orbit' | 'flyover' | 'top'>('orbit');
  const viewModeRef = useRef<'orbit' | 'flyover' | 'top'>('orbit');

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const zonesMeshRef = useRef<{ [key: string]: THREE.Group }>({});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xdcfce7); // Soft light pasture fog color
    scene.fog = new THREE.FogExp2(0xdcfce7, 0.035);

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(12, 11, 15);
    camera.lookAt(0, 1, 0);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    scene.add(dirLight);

    // Secondary soft fill
    const hemisphereLight = new THREE.HemisphereLight(0x86efac, 0x475569, 0.6);
    scene.add(hemisphereLight);

    // 5. Rolling Hill Terrain
    const terrainGeo = new THREE.PlaneGeometry(32, 32, 48, 48);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      // Luc Ngan rolling bowl hills (đồi bát úp)
      const hill1 = Math.sin(x * 0.25) * Math.cos(z * 0.25) * 1.5;
      const hill2 = Math.sin(x * 0.5 + 1.2) * 0.4;
      const distFromCenter = Math.sqrt(x * x + z * z);
      const bowlEdge = Math.max(0, (distFromCenter - 10) * -0.1);
      posAttr.setY(i, hill1 + hill2 + bowlEdge);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x228B22, // Forest green soil grass
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Terraced contour rings or pathways
    const pathGeo = new THREE.RingGeometry(3, 3.4, 32);
    pathGeo.rotateX(-Math.PI / 2);
    const pathMat = new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.position.y = 0.05;
    scene.add(pathMesh);

    // 6. Tree generator helper
    const createTree = (type: string, fruitColorHex: number) => {
      const group = new THREE.Group();

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.45;
      trunk.castShadow = true;
      group.add(trunk);

      // Canopy
      const foliageGeo = new THREE.DodecahedronGeometry(0.75, 1);
      const foliageMat = new THREE.MeshStandardMaterial({
        color: type === 'lychee' ? 0x15803d : type === 'pomelo' ? 0x166534 : 0x14532d,
        roughness: 0.6,
        flatShading: true,
      });
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 1.25;
      foliage.castShadow = true;
      group.add(foliage);

      // Fruits (little spheres)
      const fruitGeo = new THREE.SphereGeometry(0.1, 6, 6);
      const fruitMat = new THREE.MeshStandardMaterial({
        color: fruitColorHex,
        roughness: 0.3,
        emissive: fruitColorHex,
        emissiveIntensity: 0.2,
      });

      const fruitOffsets = [
        [0.45, 1.1, 0.4],
        [-0.4, 1.3, 0.35],
        [0.2, 1.45, -0.45],
        [-0.35, 1.0, -0.4],
        [0.4, 1.3, -0.2],
        [0, 1.6, 0.2],
      ];

      fruitOffsets.forEach(([fx, fy, fz]) => {
        const fruit = new THREE.Mesh(fruitGeo, fruitMat);
        fruit.position.set(fx, fy, fz);
        group.add(fruit);
      });

      return group;
    };

    // 7. Place Farm Zones and Orchards
    FARM_ZONES.forEach((zone) => {
      const zoneGroup = new THREE.Group();
      zoneGroup.position.set(zone.coordinates.x, zone.coordinates.y, zone.coordinates.z);

      let fruitColor = 0xdc2626; // Lychee default red
      let cropType = 'lychee';
      if (zone.crop.includes('Cam')) {
        fruitColor = 0xf97316; // Orange
        cropType = 'orange';
      } else if (zone.crop.includes('Bưởi')) {
        fruitColor = 0xeab308; // Yellow
        cropType = 'pomelo';
      } else if (zone.crop.includes('Ổi') || zone.crop.includes('Táo')) {
        fruitColor = 0x84cc16; // Lime green
        cropType = 'guava';
      }

      // Cluster of trees for this plot
      const treeOffsets = [
        [0, 0],
        [-0.8, -0.7],
        [0.9, -0.6],
        [-0.7, 0.8],
        [0.8, 0.7],
        [0, 1.1],
        [-1.3, 0.1],
        [1.3, 0.2],
      ];

      treeOffsets.forEach(([ox, oz]) => {
        const tree = createTree(cropType, fruitColor);
        tree.position.set(ox, 0, oz);
        // randomized scale
        const scale = 0.85 + Math.random() * 0.3;
        tree.scale.set(scale, scale, scale);
        tree.rotation.y = Math.random() * Math.PI;
        zoneGroup.add(tree);
      });

      // Ground Marker base
      const markerBaseGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.08, 16);
      const markerBaseMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(zone.color),
        transparent: true,
        opacity: 0.35,
      });
      const markerBase = new THREE.Mesh(markerBaseGeo, markerBaseMat);
      markerBase.position.y = 0.04;
      zoneGroup.add(markerBase);

      // Sprinkler post in center
      const sprinklerPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
      const sprinklerPoleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
      const sprinklerPole = new THREE.Mesh(sprinklerPoleGeo, sprinklerPoleMat);
      sprinklerPole.position.y = 0.9;
      zoneGroup.add(sprinklerPole);

      scene.add(zoneGroup);
      zonesMeshRef.current[zone.id] = zoneGroup;
    });

    // 8. Water Sprinkler Mist Particles
    const particleCount = 450;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 8;
      particlePositions[i * 3 + 1] = Math.random() * 2 + 0.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;

      particleVelocities.push({
        x: (Math.random() - 0.5) * 0.06,
        y: Math.random() * 0.04 + 0.02,
        z: (Math.random() - 0.5) * 0.06,
      });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.15,
      transparent: true,
      opacity: 0.75,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    particles.visible = false;
    scene.add(particles);
    particlesRef.current = particles;

    // 9. Animation Loop
    let animationFrameId: number;
    let angle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate camera in Flyover mode
      if (viewModeRef.current === 'flyover' && cameraRef.current) {
        angle += 0.003;
        cameraRef.current.position.x = Math.sin(angle) * 16;
        cameraRef.current.position.z = Math.cos(angle) * 16;
        cameraRef.current.position.y = 9 + Math.sin(angle * 2) * 1.5;
        cameraRef.current.lookAt(0, 1.2, 0);
      }

      // Animate irrigation particles
      if (particlesRef.current && particlesRef.current.visible) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] -= 0.035;
          positions[i * 3] += particleVelocities[i].x;
          positions[i * 3 + 2] += particleVelocities[i].z;

          // Reset when fallen to ground
          if (positions[i * 3 + 1] <= 0.2) {
            positions[i * 3 + 1] = 2.2;
            positions[i * 3] = (Math.random() - 0.5) * 8;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
          }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      // Recursive cleanup of geometries, materials, and textures to avoid memory leaks
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (container) container.innerHTML = '';
    };
  }, []);

  // Handle Irrigation toggle
  useEffect(() => {
    if (particlesRef.current) {
      particlesRef.current.visible = isIrrigationActive;
    }
  }, [isIrrigationActive]);

  // Change camera perspective
  const setCameraView = (mode: 'orbit' | 'flyover' | 'top') => {
    setViewMode(mode);
    viewModeRef.current = mode;
    if (!cameraRef.current) return;

    if (mode === 'top') {
      cameraRef.current.position.set(0, 24, 0.1);
      cameraRef.current.lookAt(0, 0, 0);
    } else if (mode === 'orbit') {
      cameraRef.current.position.set(13, 11, 15);
      cameraRef.current.lookAt(0, 1, 0);
    }
  };

  // Focus on specific zone
  const handleSelectZone = (zone: FarmZone) => {
    setSelectedZone(zone);
    if (cameraRef.current) {
      cameraRef.current.position.set(
        zone.coordinates.x + 5,
        zone.coordinates.y + 4.5,
        zone.coordinates.z + 5
      );
      cameraRef.current.lookAt(
        zone.coordinates.x,
        zone.coordinates.y + 0.8,
        zone.coordinates.z
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted tracking-normal">Chế độ xem:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setCameraView('orbit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'orbit'
                  ? 'bg-action text-white shadow-xs'
                  : 'text-body hover:text-ink'
              }`}
            >
              Toàn cảnh 3D
            </button>
            <button
              onClick={() => setCameraView('flyover')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                viewMode === 'flyover'
                  ? 'bg-action text-white shadow-xs'
                  : 'text-body hover:text-ink'
              }`}
            >
              <RotateCw className="w-3 h-3 animate-spin" />
              <span>Flycam Tuần tra</span>
            </button>
            <button
              onClick={() => setCameraView('top')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'top'
                  ? 'bg-action text-white shadow-xs'
                  : 'text-body hover:text-ink'
              }`}
            >
              Nhìn từ trên cao (2D)
            </button>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsIrrigationActive(!isIrrigationActive)}
            aria-pressed={isIrrigationActive}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
              isIrrigationActive
                ? 'bg-action text-white ring-2 ring-emerald-300 animate-pulse'
                : 'bg-emerald-50 text-accent hover:bg-emerald-100'
            }`}
          >
            <Droplets className="w-4 h-4" />
            <span>{isIrrigationActive ? 'Đang tưới phun mưa tự động' : 'Bật hệ thống tưới toàn vườn'}</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Box + Right Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Canvas Container */}
        <div className="lg:col-span-2 relative bg-gradient-to-b from-emerald-100/60 to-emerald-50 rounded-3xl overflow-hidden border border-emerald-200/80 shadow-md h-[460px] lg:h-[540px]">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Floating Canvas Overlays */}
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <p className="text-xs font-semibold text-ink">
                Mô hình 3D Không Gian Đồi Cây Ăn Quả Phường Chũ
              </p>
            </div>
          </div>

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-muted mb-1.5 uppercase">Ký hiệu quả trên đồi:</p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-body">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Vải thiều
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Cam Canh
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Bưởi Diễn
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-lime-500"></span> Ổi & Táo
              </span>
            </div>
          </div>

          {/* Reset position button */}
          <button
            onClick={() => setCameraView('orbit')}
            className="absolute bottom-4 right-4 bg-white/90 hover:bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-body hover:text-accent transition-colors"
            title="Khôi phục góc nhìn mặc định"
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Zone Inspector Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: selectedZone.color }}
                />
                <h3 className="ui-card-title text-ink">Chi Tiết Phân Lô Canh Tác</h3>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  selectedZone.healthStatus === 'Tuyệt vời'
                    ? 'bg-emerald-100 text-accent'
                    : selectedZone.healthStatus === 'Bình thường'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selectedZone.healthStatus}
              </span>
            </div>

            <div className="space-y-3.5">
              <div>
                <h4 className="ui-label-title text-ink">{selectedZone.name}</h4>
                <p className="text-xs text-muted mt-0.5">Giống cây: <strong>{selectedZone.crop}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-muted">Diện tích</span>
                  <p className="text-base font-semibold text-ink">{selectedZone.areaHa} ha</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-muted">Số lượng cây</span>
                  <p className="text-base font-semibold text-ink">{selectedZone.treeCount} gốc</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-muted">Tuổi cây</span>
                  <p className="text-base font-semibold text-ink">{selectedZone.treeAge} năm</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-xs font-medium text-muted">Dự kiến thu</span>
                  <p className="text-base font-semibold text-accent">{selectedZone.expectedYieldTons} tấn</p>
                </div>
              </div>

              {/* Sensor stats */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-body flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    Độ ẩm đất hiện tại:
                  </span>
                  <span className="font-semibold text-ink">{selectedZone.soilMoisture}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${selectedZone.soilMoisture}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-body flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-emerald-500" />
                    Độ pH đất:
                  </span>
                  <span className="font-semibold text-accent">{selectedZone.soilPh} (Chuẩn)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Lần tưới gần nhất:</span>
                  <span className="text-body font-medium">{selectedZone.lastWatered}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => setIsIrrigationActive(!isIrrigationActive)}
                  className="ui-button-primary w-full py-2.5 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Droplets className="w-4 h-4" />
                  <span>Kích hoạt tưới vi sinh cho lô này</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick zone switcher */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
            <h4 className="ui-label-title text-muted mb-2">
              Chuyển nhanh tới phân lô:
            </h4>
            <div className="space-y-1.5">
              {FARM_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => handleSelectZone(zone)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                    selectedZone.id === zone.id
                      ? 'bg-emerald-50 text-accent border border-emerald-300 font-semibold'
                      : 'hover:bg-slate-50 text-body'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: zone.color }}
                    />
                    <span className="truncate">{zone.name}</span>
                  </div>
                  <span className="text-xs text-muted shrink-0">{zone.areaHa} ha</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
