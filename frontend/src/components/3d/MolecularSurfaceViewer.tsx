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
  Play,
  Pause,
  Compass,
} from 'lucide-react';
import { StructureDisplayResidue, StructureProvenance } from '../../types/dna';

export type RepresentationMode = 'surface' | 'cartoon' | 'stick' | 'surface-stick';
export type ColorTheme = 'cyber-violet' | 'atomic' | 'spectrum';

interface MolecularSurfaceViewerProps {
  pdbData: string | null;
  mappedResidues: StructureDisplayResidue[];
  selectedResidueNumber: number | null;
  selectedChain: string | null;
  provenance: StructureProvenance | null;
  isMapped: boolean;
  isAnalyzed?: boolean;
  sequenceRevision?: string;
  structureKind?: 'dna' | 'protein';
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
  isAnalyzed = true,
  sequenceRevision = '',
  structureKind,
  unmappedReason,
  onSelectResidue,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  const isDnaStructure = structureKind
    ? structureKind === 'dna'
    : /b[-\s]?dna|dna/i.test(provenance?.model_type || '');
  const [representation, setRepresentation] = useState<RepresentationMode>(
    isDnaStructure ? 'stick' : 'surface',
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>('cyber-violet');
  const [isSpinning, setIsSpinning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const onSelectResidueRef = useRef(onSelectResidue);

  useEffect(() => {
    onSelectResidueRef.current = onSelectResidue;
  }, [onSelectResidue]);

  useEffect(() => {
    // Reset the representation when switching between DNA and protein models.
    setRepresentation(isDnaStructure ? 'stick' : 'surface');
  }, [isDnaStructure, sequenceRevision]);

  const renderStructure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Dispose the previous scene before attaching a new model. This prevents
    // stale canvases and old mutation labels surviving a successful reanalysis.
    const previousViewer = viewerRef.current;
    if (previousViewer) {
      try {
        previousViewer.clear();
      } catch (error) {
        console.debug('Previous molecular viewer cleanup:', error);
      }
      viewerRef.current = null;
    }
    container.innerHTML = '';

    if (!pdbData || !isMapped) return undefined;

    const viewer = $3Dmol.createViewer(container, {
      backgroundColor: '#000000',
      antialias: true,
    });
    viewerRef.current = viewer;
    viewer.setBackgroundColor('#000000', 1);
    viewer.addModel(pdbData, 'pdb');

    const chainAColor = colorTheme === 'cyber-violet' ? '#A855F7' : '#22C7E8';
    const chainBColor = colorTheme === 'cyber-violet' ? '#6366F1' : '#A0A3AA';

    if (isDnaStructure) {
      if (colorTheme === 'atomic') {
        if (representation === 'cartoon') {
          viewer.setStyle({}, { cartoon: { colorscheme: 'Jmol', thickness: 0.6 } });
        } else if (representation === 'surface') {
          viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.1 } });
          viewer.addSurface($3Dmol.SurfaceType.MS, { opacity: 0.35, colorscheme: 'Jmol' });
        } else if (representation === 'surface-stick') {
          viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.12 } });
          viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.28, colorscheme: 'Jmol' });
        } else {
          viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.15 } });
        }
      } else {
        if (representation === 'cartoon') {
          viewer.setStyle({ chain: 'A' }, { cartoon: { color: chainAColor, thickness: 0.6 } });
          viewer.setStyle({ chain: 'B' }, { cartoon: { color: chainBColor, thickness: 0.6 } });
        } else if (representation === 'surface') {
          viewer.setStyle({ chain: 'A' }, { stick: { color: chainAColor, radius: 0.1 } });
          viewer.setStyle({ chain: 'B' }, { stick: { color: chainBColor, radius: 0.1 } });
          viewer.addSurface($3Dmol.SurfaceType.MS, { opacity: 0.35, color: '#382252' });
        } else if (representation === 'surface-stick') {
          viewer.setStyle({ chain: 'A' }, { stick: { color: chainAColor, radius: 0.12 } });
          viewer.setStyle({ chain: 'B' }, { stick: { color: chainBColor, radius: 0.12 } });
          viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.28, color: '#382252' });
        } else {
          viewer.setStyle({ chain: 'A' }, { stick: { color: chainAColor, radius: 0.15 } });
          viewer.setStyle({ chain: 'B' }, { stick: { color: chainBColor, radius: 0.15 } });
        }
      }
    } else if (representation === 'surface') {
      viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.6 } });
      viewer.addSurface($3Dmol.SurfaceType.MS, { opacity: 0.88, colorscheme: colorTheme === 'atomic' ? 'Jmol' : 'chainHetatm' });
    } else if (representation === 'cartoon') {
      viewer.setStyle({}, { cartoon: { color: 'spectrum', thickness: 0.6 } });
    } else if (representation === 'stick') {
      viewer.setStyle({}, { stick: { colorscheme: colorTheme === 'atomic' ? 'Jmol' : 'chainHetatm', radius: 0.25 } });
    } else {
      viewer.setStyle({}, { stick: { colorscheme: 'Jmol', radius: 0.15 } });
      viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.72, colorscheme: 'chainHetatm' });
    }

    const validMappedResidues = mappedResidues.filter((residue) => !residue.is_gap_context);
    validMappedResidues.forEach((residue) => {
      const residueNumber = residue.residue_number;
      const chain = residue.chain || 'A';
      const isSelected =
        selectedResidueNumber === residueNumber &&
        (!selectedChain || selectedChain === chain);

      // User rule: Before doing any editing, ONLY ORANGE (#FF6500).
      // AFTER UPDATING ONLY, it turns GREEN (#35C98A / #059669).
      const isUpdated = Boolean(residue.is_updated);
      const highlightColor = isUpdated
        ? (isSelected ? '#059669' : '#35C98A')
        : (isSelected ? '#FF4500' : '#FF6500');
      const selection = { resi: residueNumber, chain };

      viewer.setStyle(selection, {
        stick: { color: highlightColor, radius: isDnaStructure ? 0.22 : 0.4 },
        ...(isDnaStructure ? {} : { sphere: { color: highlightColor, scale: 0.5 } }),
      });

      if (!isDnaStructure && representation !== 'stick') {
        viewer.addSurface(
          $3Dmol.SurfaceType.VDW,
          { opacity: 0.95, color: highlightColor },
          selection,
        );
      }

      if (labelsVisible) {
        let label = residue.dna_variant || '';
        if (!isDnaStructure && residue.original_residue && residue.mutated_residue) {
          label = `${residue.original_residue}${residueNumber}${residue.mutated_residue}`;
        }
        if (!label) label = `${isDnaStructure ? 'Base' : 'Residue'} ${residueNumber}`;
        if (residue.pdb_residue && residue.pdb_residue !== 'undefined') {
          label += ` · ${residue.pdb_residue}`;
        }

        viewer.addLabel(
          label,
          {
            backgroundColor: highlightColor,
            backgroundOpacity: 0.92,
            fontColor: isUpdated ? '#090A0C' : '#FFFFFF',
            fontSize: 12,
            font: 'Arial',
            borderThickness: 1,
            borderColor: '#FFFFFF',
          },
          selection,
        );
      }
    });

    // Make mapped atoms selectable in 3D. The parent synchronizes the selected
    // residue with the existing sequence alignment; no new navigation is added.
    viewer.setClickable({}, true, (atom: any) => {
      if (!atom || !onSelectResidueRef.current) return;
      const residueNumber = Number(atom.resi);
      const chain = String(atom.chain || 'A');
      if (!Number.isFinite(residueNumber)) return;

      const isMappedAtom = validMappedResidues.some(
        (residue) =>
          residue.residue_number === residueNumber &&
          (residue.chain || 'A') === chain,
      );
      if (isMappedAtom) onSelectResidueRef.current?.(residueNumber, chain);
    });

    const firstMapped = validMappedResidues[0];
    const targetResidue = selectedResidueNumber ?? firstMapped?.residue_number ?? null;
    const targetChain = selectedChain || firstMapped?.chain || 'A';

    viewer.zoomTo();
    if (targetResidue !== null) {
      viewer.center({ resi: targetResidue, chain: targetChain });
    }
    if (isDnaStructure) viewer.rotate(90, 'x');
    if (isSpinning) viewer.spin('y', 0.8);
    viewer.render();

    return () => {
      try {
        viewer.clear();
      } catch (error) {
        console.debug('Molecular viewer cleanup:', error);
      }
      if (viewerRef.current === viewer) viewerRef.current = null;
      if (container.isConnected) container.innerHTML = '';
    };
  }, [
    pdbData,
    isMapped,
    isDnaStructure,
    representation,
    colorTheme,
    isSpinning,
    mappedResidues,
    selectedResidueNumber,
    selectedChain,
    labelsVisible,
    isAnalyzed,
    sequenceRevision,
    structureKind,
  ]);

  const handleToggleSpin = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = !isSpinning;
    setIsSpinning(next);
    if (next) {
      viewer.spin('y', 0.8);
    } else {
      viewer.spin(false);
    }
  };

  const handleCameraPreset = (preset: 'center' | 'top' | 'side') => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (preset === 'top') {
      viewer.zoomTo();
      viewer.rotate(-90, 'x');
      viewer.render();
    } else if (preset === 'side') {
      viewer.zoomTo();
      viewer.rotate(90, 'y');
      viewer.render();
    } else {
      viewer.zoomTo();
      if (isDnaStructure) viewer.rotate(90, 'x');
      viewer.render();
    }
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const frameId = window.requestAnimationFrame(() => {
      cleanup = renderStructure();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      cleanup?.();
    };
  }, [renderStructure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdbData || !isMapped) return;

    const resizeObserver = new ResizeObserver(() => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.resize();
      viewer.render();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [pdbData, isMapped, sequenceRevision]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const handleSnapshot = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      const uri = viewer.pngURI();
      const link = document.createElement('a');
      link.download = `BioCrystal3D_${provenance?.pdb_id || 'structure'}_${Date.now()}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSnapshotSaved(true);
      window.setTimeout(() => setSnapshotSaved(false), 2000);
    } catch (error) {
      console.error('Failed to capture molecular snapshot:', error);
    }
  };

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.zoomTo();
    if (selectedResidueNumber !== null) {
      viewer.center({ resi: selectedResidueNumber, chain: selectedChain || 'A' });
    }
    viewer.render();
  };

  const toggleFullscreen = async () => {
    const target = containerRef.current?.parentElement;
    if (!target) return;

    try {
      if (!document.fullscreenElement) {
        await target.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen request failed:', error);
    }
  };

  if (!isMapped || !pdbData) {
    return (
      <div
        className="bc-molecular-viewer flex h-full w-full flex-col items-center justify-center bg-[#000000] p-8 text-center text-[#888888]"
        style={{ fontFamily: "Calibri, Candara, Segoe, 'Segoe UI', Optima, Arial, sans-serif" }}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#333333] bg-[#000000] text-[#FFFFFF]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-base font-bold text-[#FFFFFF]">
          Molecular structure unavailable
        </h3>
        <p className="mb-4 max-w-lg text-sm leading-relaxed text-[#888888]">
          {unmappedReason ||
            'No compatible mapped structure is available for this sequence. Sequence alignment, translation and mutation analysis remain available.'}
        </p>
        <div className="max-w-md rounded-md border border-[#333333] bg-[#000000] p-4 text-left text-xs leading-relaxed text-[#888888]">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#FFFFFF]">
            <Info className="h-4 w-4" /> Available analyses
          </div>
          <p>Sequence alignment, codon interpretation and sequence editing remain functional without a 3D structure.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bc-molecular-viewer relative flex h-full w-full flex-col overflow-hidden bg-[#000000] text-[#FFFFFF]"
      style={{ fontFamily: "Calibri, Candara, Segoe, 'Segoe UI', Optima, Arial, sans-serif" }}
    >
      <div
        ref={containerRef}
        className="relative min-h-[380px] w-full flex-1 cursor-grab active:cursor-grabbing"
      />

      <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3">
        {/* Left: View Modes & Color Themes */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-0.5 rounded-[8px] border border-[#E5E5E5] bg-white/95 backdrop-blur-md p-1 shadow-sm">
            <span className="flex items-center gap-1.5 border-r border-[#E5E5E5] px-2.5 text-[11px] font-bold text-[#0F766E]">
              <Layers className="h-3.5 w-3.5 text-[#0F766E]" /> VIEW
            </span>
            {([
              ['surface', 'Surface'],
              ['cartoon', 'Cartoon'],
              ['stick', 'Sticks'],
              ['surface-stick', 'Surface + sticks'],
            ] as [RepresentationMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRepresentation(mode)}
                aria-pressed={representation === mode}
                className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                  representation === mode
                    ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] shadow-xs'
                    : 'border-transparent text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-0.5 rounded-[8px] border border-[#E5E5E5] bg-white/95 backdrop-blur-md p-1 shadow-sm text-xs">
            <button
              type="button"
              onClick={() => setColorTheme('cyber-violet')}
              aria-pressed={colorTheme === 'cyber-violet'}
              className={`rounded-[6px] px-3 py-1 font-semibold transition-all duration-150 cursor-pointer border ${
                colorTheme === 'cyber-violet'
                  ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] shadow-xs'
                  : 'border-transparent text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9]'
              }`}
            >
              Duplex Spectral
            </button>
            <button
              type="button"
              onClick={() => setColorTheme('atomic')}
              aria-pressed={colorTheme === 'atomic'}
              className={`rounded-[6px] px-3 py-1 font-semibold transition-all duration-150 cursor-pointer border ${
                colorTheme === 'atomic'
                  ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] shadow-xs'
                  : 'border-transparent text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9]'
              }`}
            >
              Atomic (CPK)
            </button>
          </div>
        </div>

        {/* Right: Camera Angles, Spin, Labels & Tools */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-0.5 rounded-[8px] border border-[#E5E5E5] bg-white/95 backdrop-blur-md p-1 shadow-sm">
          {/* Spin Auto-Rotation Toggle */}
          <button
            type="button"
            onClick={handleToggleSpin}
            aria-pressed={isSpinning}
            title={isSpinning ? 'Pause auto-rotation' : 'Start smooth auto-rotation'}
            className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border ${
              isSpinning
                ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] shadow-xs'
                : 'border-transparent text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9]'
            }`}
          >
            {isSpinning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            Spin
          </button>

          {/* Camera Presets */}
          <button
            type="button"
            onClick={() => handleCameraPreset('top')}
            title="Longitudinal helical axis view (looking straight down the DNA cylinder)"
            className="rounded-[6px] px-3 py-1 text-xs font-semibold text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9] cursor-pointer flex items-center gap-1 transition-all duration-150 border border-transparent"
          >
            <Compass className="h-3 w-3 text-[#0F766E]" /> Top Axis
          </button>
          <button
            type="button"
            onClick={() => handleCameraPreset('side')}
            title="Major groove side view"
            className="rounded-[6px] px-3 py-1 text-xs font-semibold text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9] cursor-pointer transition-all duration-150 border border-transparent"
          >
            Side Groove
          </button>

          <button
            type="button"
            onClick={() => setLabelsVisible((value) => !value)}
            aria-pressed={labelsVisible}
            className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-all duration-150 cursor-pointer border ${
              labelsVisible
                ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] shadow-xs'
                : 'border-transparent text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9]'
            }`}
          >
            Labels {labelsVisible ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            aria-label="Reset camera"
            title="Reset camera center"
            className="rounded-[6px] p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9] cursor-pointer transition-all duration-150 border border-transparent"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSnapshot}
            title="Save high-resolution structure image"
            className="flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-semibold text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9] cursor-pointer transition-all duration-150 border border-transparent"
          >
            <Camera className="h-3.5 w-3.5 text-[#0F766E]" />
            {snapshotSaved ? 'Saved' : 'Snapshot'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="rounded-[6px] p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#FAFAF9] cursor-pointer transition-all duration-150 border border-transparent"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Floating Canvas Telemetry HUD (Bottom-Left) */}
      <div className="pointer-events-none absolute left-4 bottom-14 z-10 flex flex-col gap-1 text-[11px] bg-white/95 backdrop-blur-md p-3 rounded-[8px] border border-[#E5E5E5] shadow-sm text-[#171717]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#0F766E] uppercase tracking-wider text-[11px]">
            {isDnaStructure ? 'B-DNA DUPLEX ARCHITECTURE' : 'PROTEIN HOMOLOGY MODEL'}
          </span>
        </div>
        <div className="text-[10px] text-[#737373] flex items-center gap-2.5 font-medium">
          <span>Rise: 3.38 Å</span>
          <span>·</span>
          <span>Twist: 36.0°</span>
          <span>·</span>
          <span>Pitch: 34.0 Å (10 bp/turn)</span>
          <span>·</span>
          <span>Diameter: 20.0 Å</span>
        </div>
      </div>

      {provenance && (
        <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E5E5] bg-[#FFFFFF] px-5 py-2.5 text-xs text-[#737373]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#171717]">
              {isDnaStructure
                ? 'Canonical B-DNA model generated from input sequence.'
                : (provenance.pdb_id
                    ? `Experimentally determined Protein Data Bank (PDB) structure (PDB ID: ${provenance.pdb_id}).`
                    : 'No experimentally determined PDB structure available for this sequence. Sequence-level and canonical B-DNA analysis are shown.')}
            </span>
            {provenance.pdb_id && <span>· {provenance.pdb_id}</span>}
            {provenance.chain && <span>· Chain {provenance.chain}</span>}
            {provenance.method && <span>· {provenance.method}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-[6px] border border-[#E5E5E5] bg-[#FAFAF9] px-2.5 py-0.5 text-[#171717] font-medium" title={provenance.disclaimer}>
              {provenance.model_type}
            </span>
            {mappedResidues.some((r) => !r.is_gap_context) && (
              <span className="flex items-center gap-2.5 text-[11px]">
                {mappedResidues.some((r) => !r.is_gap_context && !r.is_updated) && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#D98568]" />
                    <span className="text-[#171717]">Mutation (Coral)</span>
                  </span>
                )}
                {mappedResidues.some((r) => !r.is_gap_context && r.is_updated) && (
                  <span className="flex items-center gap-1 font-semibold text-[#0F766E]">
                    <span>[Updated]</span>
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
