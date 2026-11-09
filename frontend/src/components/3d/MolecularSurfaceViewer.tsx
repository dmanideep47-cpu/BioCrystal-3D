import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as $3Dmol from '3dmol';
import {
  Camera,
  RotateCcw,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Layers,
  Info,
} from 'lucide-react';
import { MappedResidue, StructureProvenance } from '../../types/dna';

export type RepresentationMode = 'surface' | 'cartoon' | 'stick' | 'surface-stick';

interface MolecularSurfaceViewerProps {
  pdbData: string | null;
  mappedResidues: MappedResidue[];
  selectedResidueNumber: number | null;
  selectedChain: string | null;
  provenance: StructureProvenance | null;
  isMapped: boolean;
  unmappedReason?: string | null;
  onSelectResidue?: (residueNum: number, chain: string) => void;
}

export const MolecularSurfaceViewer: React.FC<MolecularSurfaceViewerProps> = ({
  pdbData,
  mappedResidues,
  selectedResidueNumber,
  selectedChain,
  provenance,
  isMapped,
  unmappedReason,
  onSelectResidue: _onSelectResidue,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const surfaceIdRef = useRef<any>(null);

  const [representation, setRepresentation] = useState<RepresentationMode>('surface');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(true);

  // Initialize or re-render 3Dmol viewer
  const renderStructure = useCallback(() => {
    if (!containerRef.current || !pdbData || !isMapped) return;

    // Clear previous viewer if any
    containerRef.current.innerHTML = '';

    const viewer = $3Dmol.createViewer(containerRef.current, {});
    viewerRef.current = viewer;

    viewer.setBackgroundColor('#090A0C', 1.0);

    // Load authentic PDB coordinates
    viewer.addModel(pdbData, 'pdb');

    // Remove old surface
    if (surfaceIdRef.current) {
      try {
        viewer.removeSurface(surfaceIdRef.current);
      } catch {
        // ignore
      }
      surfaceIdRef.current = null;
    }

    // Default: Multi-coloured chain-based or secondary structure representation
    if (representation === 'surface') {
      viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.6 } });
      // Dense realistic molecular surface (Nature / Amgen KRAS G12C visual target)
      surfaceIdRef.current = viewer.addSurface($3Dmol.SurfaceType.MS, {
        opacity: 0.88,
        colorscheme: 'chainHetatm',
      });
    } else if (representation === 'cartoon') {
      viewer.setStyle({}, { cartoon: { color: 'spectrum', thickness: 0.6 } });
    } else if (representation === 'stick') {
      viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.25 } });
    } else if (representation === 'surface-stick') {
      viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.15 } });
      surfaceIdRef.current = viewer.addSurface($3Dmol.SurfaceType.VDW, {
        opacity: 0.72,
        colorscheme: 'chainHetatm',
      });
    }

    // Mutated residue highlighting: Strong contrasting radiant orange/red (#FF6500)
    mappedResidues.forEach((mut) => {
      const resNum = mut.residue_number;
      const ch = mut.chain || 'A';
      const isSelected = selectedResidueNumber === resNum;

      const highlightColor = isSelected ? '#FF4500' : '#FF6500';

      // Stick and sphere representation for mutated residue sidechain
      viewer.setStyle(
        { resi: resNum, chain: ch },
        {
          stick: { color: highlightColor, radius: 0.4 },
          sphere: { color: highlightColor, scale: 0.5 },
        }
      );

      // Mutated residue surface patch highlight
      viewer.addSurface(
        $3Dmol.SurfaceType.VDW,
        {
          opacity: 0.95,
          color: highlightColor,
        },
        { resi: resNum, chain: ch }
      );

      // Label on the mutation site
      if (labelsVisible) {
        viewer.addLabel(
          `${mut.original_residue}${resNum}${mut.mutated_residue} (Mutation)`,
          {
            backgroundColor: '#FF6500',
            backgroundOpacity: 0.85,
            fontColor: '#090A0C',
            fontSize: 12,
            font: 'monospace',
            borderThickness: 1,
            borderColor: '#FFFFFF',
          },
          { resi: resNum, chain: ch }
        );
      }
    });

    // Camera framing: Focus onto selected mutation or primary mapped residue
    const targetResidue = selectedResidueNumber || (mappedResidues.length > 0 ? mappedResidues[0].residue_number : null);
    const targetChain = selectedChain || (mappedResidues.length > 0 ? mappedResidues[0].chain : 'A');

    if (targetResidue) {
      viewer.zoomTo({ resi: targetResidue, chain: targetChain }, 800);
    } else {
      viewer.zoomTo();
    }

    viewer.render();
  }, [pdbData, isMapped, representation, mappedResidues, selectedResidueNumber, selectedChain, labelsVisible]);

  useEffect(() => {
    renderStructure();
  }, [renderStructure]);

  // Focus on selected residue when external selection changes
  useEffect(() => {
    if (viewerRef.current && selectedResidueNumber && isMapped) {
      viewerRef.current.zoomTo(
        { resi: selectedResidueNumber, chain: selectedChain || 'A' },
        600
      );
    }
  }, [selectedResidueNumber, selectedChain, isMapped]);

  // High-Resolution Snapshot Capture (PNG)
  const handleSnapshot = () => {
    if (!viewerRef.current) return;
    try {
      const uri = viewerRef.current.pngURI();
      const link = document.createElement('a');
      link.download = `BioCrystal3D_Structure_${provenance?.pdb_id || 'PDB'}_${Date.now()}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSnapshotSaved(true);
      setTimeout(() => setSnapshotSaved(false), 2000);
    } catch (e) {
      console.error('Failed to capture molecular snapshot:', e);
    }
  };

  const handleResetCamera = () => {
    if (!viewerRef.current) return;
    if (selectedResidueNumber) {
      viewerRef.current.zoomTo({ resi: selectedResidueNumber, chain: selectedChain || 'A' }, 600);
    } else {
      viewerRef.current.zoomTo();
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current?.parentElement) return;
    if (!document.fullscreenElement) {
      containerRef.current.parentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Honest unavailable state when structural data is absent or unmapped
  if (!isMapped || !pdbData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#090A0C] text-[#A0A3AA] p-8 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#F3B347] mb-4 shadow-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-mono font-bold text-[#F4F4F2] uppercase tracking-wider mb-2">
          Structural Mapping Unavailable
        </h3>
        <p className="text-xs text-[#70757D] max-w-lg leading-relaxed mb-4">
          {unmappedReason ||
            'No experimentally verified 3D macromolecular structure could be confidently mapped for this sequence. Under strict scientific protocol, decorative or fabricated 3D protein models are never rendered.'}
        </p>
        <div className="bg-[#111316] p-3.5 rounded-md border border-[#2A2D33] text-[11px] font-mono text-left max-w-md space-y-1.5 text-[#A0A3AA]">
          <div className="flex items-center gap-1.5 text-[#35C98A] font-semibold">
            <Info className="w-3.5 h-3.5" />
            <span>Available Scientific Analyses:</span>
          </div>
          <p>• Full Biopython pairwise sequence alignment (substitutions, indels, frameshifts).</p>
          <p>• Standard & Organellar codon translation matrix evaluation.</p>
          <p>• Biochemical consequence assessment & candidate restoration suggestions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative select-none bg-[#090A0C] overflow-hidden flex flex-col">
      {/* 3Dmol WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full flex-1 relative cursor-grab active:cursor-grabbing"
        style={{ minHeight: '380px' }}
      />

      {/* Floating Top Representation Switcher Dock */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1 bg-[#111316]/90 p-1 rounded-md border border-[#2A2D33] backdrop-blur-md shadow-lg pointer-events-auto">
          <span className="text-[10px] font-mono font-medium text-[#70757D] px-2 flex items-center gap-1.5 border-r border-[#2A2D33]">
            <Layers className="w-3 h-3 text-[#22C7E8]" />
            SURFACE VIEW
          </span>

          <button
            onClick={() => setRepresentation('surface')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              representation === 'surface'
                ? 'bg-[#1D2025] text-[#22C7E8] border border-[#3D424B] font-semibold shadow-sm'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="Dense Molecular Surface Representation (Default Target)"
          >
            Molecular Surface
          </button>

          <button
            onClick={() => setRepresentation('cartoon')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              representation === 'cartoon'
                ? 'bg-[#1D2025] text-[#22C7E8] border border-[#3D424B] font-semibold shadow-sm'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="Secondary Structure Ribbon Cartoon"
          >
            Secondary Cartoon
          </button>

          <button
            onClick={() => setRepresentation('stick')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              representation === 'stick'
                ? 'bg-[#1D2025] text-[#22C7E8] border border-[#3D424B] font-semibold shadow-sm'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="All-Atom Stick Model"
          >
            Sticks
          </button>

          <button
            onClick={() => setRepresentation('surface-stick')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              representation === 'surface-stick'
                ? 'bg-[#1D2025] text-[#22C7E8] border border-[#3D424B] font-semibold shadow-sm'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
            }`}
            title="Semi-transparent Surface with Active Site Sticks"
          >
            Surface + Sticks
          </button>
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center gap-1.5 bg-[#111316]/90 p-1 rounded-md border border-[#2A2D33] backdrop-blur-md shadow-lg pointer-events-auto">
          <button
            onClick={() => setLabelsVisible(!labelsVisible)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              labelsVisible
                ? 'bg-[#1D2025] text-[#FF6500] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
            title="Toggle Mutation Site Labels"
          >
            Labels: {labelsVisible ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-md bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] transition-all cursor-pointer"
            title="Reset Camera onto Mutation Pocket"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSnapshot}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              snapshotSaved
                ? 'bg-[#35C98A]/20 text-[#35C98A] border border-[#35C98A]/40'
                : 'bg-[#17191D] hover:bg-[#1D2025] text-[#F4F4F2] border border-[#2A2D33]'
            }`}
            title="Capture Publication-Quality PNG Snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-[#22C7E8]" />
            <span>{snapshotSaved ? 'Saved PNG' : 'Snapshot'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Floating Bottom Structure Provenance Footer */}
      {provenance && (
        <div className="bg-[#111316]/95 border-t border-[#2A2D33] px-3.5 py-2 z-10 flex flex-wrap items-center justify-between text-[11px] font-mono text-[#A0A3AA]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#35C98A]" />
            <span className="font-semibold text-[#F4F4F2]">
              PDB: {provenance.pdb_id} (Chain {provenance.chain})
            </span>
            <span className="text-[#3D424B]">|</span>
            <span className="text-[#70757D]">{provenance.method} ({provenance.resolution})</span>
            <span className="text-[#3D424B]">|</span>
            <span className="text-[#22C7E8] font-medium">{provenance.organism}</span>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[#F3B347] bg-[#F3B347]/10 px-2 py-0.5 rounded border border-[#F3B347]/30">
              {provenance.model_type}
            </span>
            <span className="text-[#70757D]">
              Mutated site highlighted in <strong className="text-[#FF6500]">Orange (#FF6500)</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
