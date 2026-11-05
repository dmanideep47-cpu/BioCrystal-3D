import React, { useState, useEffect } from 'react';
import {
  VisualizationMode,
  QualityPreset,
} from '../../types/dna';
import {
  Dna,
  Rotate3d,
  Camera,
  Download,
  Zap,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface NavbarProps {
  visualizationMode: VisualizationMode;
  setVisualizationMode: (mode: VisualizationMode) => void;
  qualityPreset: QualityPreset;
  setQualityPreset: (preset: QualityPreset) => void;
  autoRotate: boolean;
  setAutoRotate: (val: boolean | ((prev: boolean) => boolean)) => void;
  onResetCamera: () => void;
  onExportReport: () => void;
  sequenceLength: number;
  gcPercent: number;
  hasMutation: boolean;
  sequenceIdentifier?: string;
  onCaptureScreenshot?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  visualizationMode,
  setVisualizationMode,
  qualityPreset,
  setQualityPreset,
  autoRotate,
  setAutoRotate,
  onResetCamera,
  onExportReport,
  sequenceLength,
  gcPercent,
  hasMutation,
  sequenceIdentifier = 'DEMO_001 · B-DNA CANONICAL',
  onCaptureScreenshot,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleScreenshot = () => {
    if (onCaptureScreenshot) {
      onCaptureScreenshot();
      setScreenshotSuccess(true);
      setTimeout(() => setScreenshotSuccess(false), 2000);
      return;
    }

    // Direct canvas capture fallback
    const canvas = document.querySelector('.bc-3d-viewport canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `BioCrystal3D_Capture_${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setScreenshotSuccess(true);
        setTimeout(() => setScreenshotSuccess(false), 2000);
      } catch (err) {
        console.error('Failed to capture canvas screenshot', err);
      }
    }
  };

  const modes: { id: VisualizationMode; label: string }[] = [
    { id: 'surface', label: 'Surface' },
    { id: 'ball-and-stick', label: 'Ball & Stick' },
    { id: 'backbone', label: 'Backbone' },
    { id: 'base-pair', label: 'Base Pair' },
    { id: 'educational', label: 'Educational' },
  ];

  return (
    <header className="h-16 bg-[#111316] border-b border-[#2A2D33] px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Molecular Spec */}
      <div className="flex items-center space-x-3.5">
        <div className="w-9 h-9 rounded-md bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#F4F4F2] shadow-sm">
          <Dna className="w-5 h-5 text-[#FF6500]" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xs font-bold tracking-wider text-[#F4F4F2] uppercase font-mono">
              BIOCRYSTAL <span className="text-[#FF6500]">3D</span>
            </h1>
            <span className="text-[10px] text-[#70757D] font-mono">/</span>
            <span className="text-[10px] font-mono text-[#A0A3AA] tracking-wide">
              MOLECULAR WORKSTATION
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#17191D] text-[#A0A3AA] border border-[#2A2D33]">
              {sequenceIdentifier}
            </span>
            {hasMutation ? (
              <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/35 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6500]" />
                MUTATION ACTIVE
              </span>
            ) : (
              <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/35 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#35C98A]" />
                CANONICAL WILD-TYPE
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#70757D] tracking-tight">
            Computational Biology & Molecular Visualization Workstation
          </p>
        </div>
      </div>

      {/* Center: Visualization Representation Modes */}
      <div className="hidden xl:flex items-center bg-[#090A0C] p-0.5 rounded-md border border-[#2A2D33]">
        {modes.map((m) => {
          const isActive = visualizationMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setVisualizationMode(m.id)}
              className={`px-3 py-1 rounded text-xs transition-all font-medium cursor-pointer ${
                isActive
                  ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] shadow-sm font-semibold'
                  : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#111316]'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Right Controls: Statistics, Quality Preset, Controls, Export */}
      <div className="flex items-center space-x-2">
        {/* Live Sequence Metrics */}
        <div className="hidden sm:flex items-center space-x-2 mr-1 text-[11px] font-mono bg-[#090A0C] px-2.5 py-1 rounded-md border border-[#2A2D33]">
          <span className="text-[#70757D]">LEN:</span>
          <span className="text-[#22C7E8] font-semibold">{sequenceLength} bp</span>
          <span className="text-[#2A2D33]">|</span>
          <span className="text-[#70757D]">GC:</span>
          <span className="text-[#35C98A] font-semibold">{gcPercent}%</span>
        </div>

        {/* Quality Preset Selector */}
        <div className="flex items-center bg-[#090A0C] px-2 py-1 rounded-md border border-[#2A2D33] text-xs text-[#A0A3AA] space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-[#F3B347]" />
          <select
            value={qualityPreset}
            onChange={(e) => setQualityPreset(e.target.value as QualityPreset)}
            className="bg-transparent text-[#F4F4F2] text-xs focus:outline-none cursor-pointer font-mono"
            title="Rendering Quality Preset (Influences 3D Mesh & Texture Precision)"
          >
            <option value="low" className="bg-[#111316]">Low</option>
            <option value="medium" className="bg-[#111316]">Medium</option>
            <option value="high" className="bg-[#111316]">High</option>
            <option value="ultra" className="bg-[#111316]">Ultra</option>
          </select>
        </div>

        {/* Auto Rotate Button */}
        <button
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`p-1.5 rounded-md border text-xs transition-all cursor-pointer ${
            autoRotate
              ? 'bg-[#FF6500]/15 border-[#FF6500]/40 text-[#FF6500]'
              : 'bg-[#090A0C] border-[#2A2D33] text-[#A0A3AA] hover:text-[#F4F4F2] hover:border-[#3D424B]'
          }`}
          title={autoRotate ? 'Pause Auto-Rotation' : 'Enable Auto-Rotation'}
        >
          <Rotate3d className="w-4 h-4" />
        </button>

        {/* Reset Camera Button */}
        <button
          onClick={onResetCamera}
          className="p-1.5 rounded-md bg-[#090A0C] border border-[#2A2D33] text-[#A0A3AA] hover:text-[#F4F4F2] hover:border-[#3D424B] transition-all text-xs cursor-pointer"
          title="Reset Camera to Canonical Isometric Orientation"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* High-Res Snapshot Button */}
        <button
          onClick={handleScreenshot}
          className={`p-1.5 rounded-md border text-xs transition-all cursor-pointer ${
            screenshotSuccess
              ? 'bg-[#35C98A]/20 border-[#35C98A]/40 text-[#35C98A]'
              : 'bg-[#090A0C] border-[#2A2D33] text-[#A0A3AA] hover:text-[#22C7E8] hover:border-[#3D424B]'
          }`}
          title="Capture High-Res PNG Screenshot"
        >
          <Camera className="w-4 h-4 text-[#22C7E8]" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-md bg-[#090A0C] border border-[#2A2D33] text-[#A0A3AA] hover:text-[#F4F4F2] hover:border-[#3D424B] transition-all text-xs cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Export Scientific Report */}
        <button
          onClick={onExportReport}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#F4F4F2] hover:bg-white text-[#090A0C] font-semibold text-xs transition-all shadow-sm cursor-pointer ml-1"
          title="Export Comprehensive Scientific Report (PDF)"
        >
          <Download className="w-3.5 h-3.5 text-[#090A0C]" />
          <span>Report</span>
        </button>
      </div>
    </header>
  );
};
