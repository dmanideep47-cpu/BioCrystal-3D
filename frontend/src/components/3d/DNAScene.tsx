import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DNAModel } from './DNAModel';
import {
  VisualizationMode,
  QualityPreset,
} from '../../types/dna';
import {
  Camera,
  RotateCcw,
  Compass,
} from 'lucide-react';

export type CameraPreset = 'isometric' | 'front' | 'top' | 'side';

interface DNASceneProps {
  sequence: string;
  visualizationMode: VisualizationMode;
  selectedPosition: number | null;
  selectedStrand: 'coding' | 'complementary' | null;
  mutatedPositions: Set<number>;
  qualityPreset: QualityPreset;
  onSelectNucleotide: (position: number, strand: 'coding' | 'complementary') => void;
  hoveredPosition: number | null;
  setHoveredPosition: (pos: number | null) => void;
  autoRotate: boolean;
  autoRotateSpeed: number;
  resetCameraTrigger?: number;
  onCaptureScreenshot?: () => void;
}

// Inner camera manager that syncs OrbitControls and camera frustum
function SceneCameraHandler({
  cameraPos,
  targetPos,
  controlsRef,
}: {
  cameraPos: [number, number, number];
  targetPos: [number, number, number];
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(targetPos[0], targetPos[1], targetPos[2]);
      camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
      camera.lookAt(targetPos[0], targetPos[1], targetPos[2]);
      controlsRef.current.update();
    }
  }, [cameraPos, targetPos, camera, controlsRef]);

  return null;
}

export const DNAScene: React.FC<DNASceneProps> = ({
  sequence,
  visualizationMode,
  selectedPosition,
  selectedStrand,
  mutatedPositions,
  qualityPreset,
  onSelectNucleotide,
  hoveredPosition,
  setHoveredPosition,
  autoRotate,
  autoRotateSpeed,
  resetCameraTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [activeAngle, setActiveAngle] = useState<CameraPreset>('isometric');
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);

  // Dynamic Camera Distance Calculation:
  // Helix vertical height = (length - 1) * 1.35 + cap margin
  // Target: helix occupies ~78% of the vertical viewport height
  const { cameraDistance, halfLength } = useMemo(() => {
    const len = Math.max(8, sequence.length);
    const hl = (len - 1) / 2;
    const helixHeight = Math.max(12, (len - 1) * 1.35 + 2.5);
    const fov = 38; // Field of view in degrees
    const frustumTargetHeight = helixHeight / 0.78;
    const dist = (frustumTargetHeight / 2) / Math.tan((fov * Math.PI) / 360);
    return {
      cameraDistance: Math.max(16, dist),
      halfLength: hl,
    };
  }, [sequence.length]);

  // Compute camera position based on selected preset angle
  const cameraPosition: [number, number, number] = useMemo(() => {
    const d = cameraDistance;
    switch (activeAngle) {
      case 'front':
        return [0, 0, d];
      case 'top':
        // Offset slightly in Z to prevent Gimbal lock when looking straight down Y
        return [0.001, d * 0.95, 0.001];
      case 'side':
        return [d, 0, 0];
      case 'isometric':
      default:
        // Elegant 3D isometric oblique view showing double helix twist & groove depth
        return [d * 0.38, d * 0.14, d * 0.92];
    }
  }, [cameraDistance, activeAngle]);

  // Compute target position: focus at nucleotide Y if selected, or helix center (0,0,0)
  const targetPosition: [number, number, number] = useMemo(() => {
    if (selectedPosition !== null && sequence.length > 0) {
      const targetY = (selectedPosition - 1 - halfLength) * 1.35;
      return [0, targetY, 0];
    }
    return [0, 0, 0];
  }, [selectedPosition, halfLength, sequence.length]);

  // External resetCameraTrigger listener
  useEffect(() => {
    if (resetCameraTrigger !== undefined && resetCameraTrigger > 0) {
      setActiveAngle('isometric');
      if (controlsRef.current) {
        controlsRef.current.reset();
        controlsRef.current.target.set(0, 0, 0);
      }
    }
  }, [resetCameraTrigger]);

  // High-Resolution Screenshot Capture
  const handleCaptureScreenshot = useCallback(() => {
    if (!containerRef.current) return;
    const canvas = containerRef.current.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `BioCrystal3D_DNA_${sequence.slice(0, 8)}_${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setScreenshotSuccess(true);
      setTimeout(() => setScreenshotSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to capture canvas screenshot', e);
    }
  }, [sequence]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative select-none bg-[#090A0C] overflow-hidden"
    >
      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: cameraPosition,
          fov: 38,
          near: 0.1,
          far: 2000,
        }}
        gl={{
          antialias: qualityPreset !== 'low',
          alpha: false,
          preserveDrawingBuffer: true, // Required for instant high-res screenshot capture
          powerPreference: qualityPreset === 'ultra' ? 'high-performance' : 'default',
        }}
        dpr={qualityPreset === 'ultra' ? [1, 2] : qualityPreset === 'low' ? 1 : [1, 1.5]}
      >
        {/* Avogadro-grade Scientific Deep Palette */}
        <color attach="background" args={['#090A0C']} />
        <fog attach="fog" args={['#090A0C', cameraDistance * 0.9, cameraDistance * 2.8]} />

        {/* Ambient molecular illumination */}
        <ambientLight intensity={0.75} color="#F4F4F2" />

        {/* Primary Key Light */}
        <directionalLight position={[20, 25, 20]} intensity={1.35} color="#FFFFFF" />

        {/* Fill Light (Soft neutral fill) */}
        <directionalLight position={[-20, -12, -20]} intensity={0.55} color="#D1D5DB" />

        {/* Rim Light for crisp molecular depth separation */}
        <directionalLight position={[0, -22, 16]} intensity={0.75} color="#9CA3AF" />

        {/* DNA 3D Molecular Model */}
        <DNAModel
          sequence={sequence}
          visualizationMode={visualizationMode}
          selectedPosition={selectedPosition}
          selectedStrand={selectedStrand}
          mutatedPositions={mutatedPositions}
          qualityPreset={qualityPreset}
          onSelectNucleotide={onSelectNucleotide}
          hoveredPosition={hoveredPosition}
          setHoveredPosition={setHoveredPosition}
        />

        {/* Sync Camera with Dynamic Preset */}
        <SceneCameraHandler
          cameraPos={cameraPosition}
          targetPos={targetPosition}
          controlsRef={controlsRef}
        />

        {/* Orbit Camera Controls with Damping */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.8}
          zoomSpeed={0.9}
          panSpeed={0.7}
          minDistance={5}
          maxDistance={120}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
        />
      </Canvas>

      {/* Floating Viewport Toolbars */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Left: Camera Orientation Presets */}
        <div className="flex items-center gap-1 bg-[#111316]/90 p-1 rounded-md border border-[#2A2D33] backdrop-blur-md shadow-lg pointer-events-auto">
          <span className="text-[10px] font-mono font-medium text-[#70757D] px-2 flex items-center gap-1.5 border-r border-[#2A2D33]">
            <Compass className="w-3 h-3 text-[#22C7E8]" />
            VIEW
          </span>

          <button
            onClick={() => setActiveAngle('isometric')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              activeAngle === 'isometric'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold text-[#22C7E8]'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="3D Isometric Oblique Perspective (Full Helical Depth)"
          >
            3D Iso
          </button>

          <button
            onClick={() => setActiveAngle('front')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              activeAngle === 'front'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold text-[#22C7E8]'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="Front Coronal View"
          >
            Front
          </button>

          <button
            onClick={() => setActiveAngle('top')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              activeAngle === 'top'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold text-[#22C7E8]'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="Top-Down Axial View (Helical Cross-Section)"
          >
            Axial Top
          </button>

          <button
            onClick={() => setActiveAngle('side')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              activeAngle === 'side'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold text-[#22C7E8]'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="Side Sagittal View (Major & Minor Grooves)"
          >
            Groove Side
          </button>
        </div>

        {/* Right: Quick Actions (Screenshot & Reset) */}
        <div className="flex items-center gap-1.5 bg-[#111316]/90 p-1 rounded-md border border-[#2A2D33] backdrop-blur-md shadow-lg pointer-events-auto">
          <button
            onClick={handleCaptureScreenshot}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              screenshotSuccess
                ? 'bg-[#35C98A]/20 text-[#35C98A] border border-[#35C98A]/40'
                : 'bg-[#17191D] hover:bg-[#1D2025] text-[#F4F4F2] border border-[#2A2D33] hover:border-[#3D424B]'
            }`}
            title="Capture High-Resolution PNG Render"
          >
            <Camera className="w-3.5 h-3.5 text-[#22C7E8]" />
            <span>{screenshotSuccess ? 'Saved PNG' : 'Snapshot'}</span>
          </button>

          <button
            onClick={() => {
              setActiveAngle('isometric');
              if (controlsRef.current) {
                controlsRef.current.reset();
                controlsRef.current.target.set(0, 0, 0);
              }
            }}
            className="p-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] hover:border-[#3D424B] transition-all cursor-pointer"
            title="Reset Camera Target and Angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
