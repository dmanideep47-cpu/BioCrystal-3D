import React, { useState } from 'react';
import { DNAScene } from './DNAScene';
import {
  VisualizationMode,
  QualityPreset,
  MutationDiff,
} from '../../types/dna';
import {
  Columns,
  Layers,
  Eye,
  GitCompare,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

interface ComparisonViewProps {
  originalSequence: string;
  mutatedSequence: string;
  mutationDiff: MutationDiff | null;
  visualizationMode: VisualizationMode;
  qualityPreset: QualityPreset;
  selectedPosition: number | null;
  selectedStrand: 'coding' | 'complementary' | null;
  onSelectNucleotide: (position: number, strand: 'coding' | 'complementary') => void;
  hoveredPosition: number | null;
  setHoveredPosition: (pos: number | null) => void;
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  originalSequence,
  mutatedSequence,
  mutationDiff,
  visualizationMode,
  qualityPreset,
  selectedPosition,
  selectedStrand,
  onSelectNucleotide,
  hoveredPosition,
  setHoveredPosition,
  autoRotate,
  autoRotateSpeed,
}) => {
  const [viewType, setViewType] = useState<'split' | 'overlay' | 'original' | 'mutated'>('split');
  const [resetKey, setResetKey] = useState<number>(0);

  // Set of mutated positions
  const mutatedIndices = new Set<number>();
  if (mutationDiff) {
    mutatedIndices.add(mutationDiff.position);
  }

  const emptySet = new Set<number>();

  return (
    <div className="w-full h-full flex flex-col bg-[#090A0C] relative overflow-hidden select-none">
      {/* Top Comparison Sub-header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111316] border-b border-[#2A2D33] z-10 gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-[#F4F4F2] font-mono font-semibold text-xs">
            <GitCompare className="w-4 h-4 text-[#FF6500]" />
            <span>MOLECULAR STRUCTURE COMPARISON</span>
          </div>

          {mutationDiff && (
            <div className="flex items-center space-x-2 text-xs bg-[#090A0C] px-2.5 py-1 rounded-md border border-[#2A2D33] font-mono">
              <span className="text-[#70757D]">Position:</span>
              <span className="text-[#F3B347] font-semibold">{mutationDiff.position}</span>
              <span className="text-[#2A2D33]">|</span>
              <span className="text-[#70757D]">Change:</span>
              <span className="text-[#F4F4F2] font-semibold">
                {mutationDiff.originalBase || '-'} &rarr; {mutationDiff.newBase || mutationDiff.insertedBases || '-'}
              </span>
              <span className="text-[#2A2D33]">|</span>
              <span className="text-[#70757D]">Class:</span>
              <span
                className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                  mutationDiff.category === 'synonymous'
                    ? 'bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30'
                    : mutationDiff.category === 'nonsense'
                    ? 'bg-[#F06464]/15 text-[#F06464] border border-[#F06464]/30'
                    : 'bg-[#F3B347]/15 text-[#F3B347] border border-[#F3B347]/30'
                }`}
              >
                {mutationDiff.categoryLabel}
              </span>
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center space-x-1 bg-[#090A0C] p-0.5 rounded-md border border-[#2A2D33] text-xs font-mono">
          <button
            onClick={() => setViewType('split')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewType === 'split'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
            title="Side-by-side synchronized view"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Split-Screen</span>
          </button>

          <button
            onClick={() => setViewType('overlay')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewType === 'overlay'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
            title="Overlay comparison"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overlay</span>
          </button>

          <button
            onClick={() => setViewType('original')}
            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
              viewType === 'original'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Reference</span>
          </button>

          <button
            onClick={() => setViewType('mutated')}
            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
              viewType === 'mutated'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mutated</span>
          </button>

          <button
            onClick={() => setResetKey((k) => k + 1)}
            className="p-1 text-[#70757D] hover:text-[#F4F4F2] ml-1 rounded-md hover:bg-[#1D2025] cursor-pointer"
            title="Reset Cameras to Synced Orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3D View Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* SPLIT SCREEN MODE */}
        {viewType === 'split' && (
          <div className="w-full h-full flex">
            {/* LEFT: ORIGINAL WILD-TYPE */}
            <div className="w-1/2 h-full relative border-r border-[#2A2D33]">
              <div className="absolute top-3 left-4 z-10 flex items-center space-x-2 bg-[#111316]/90 px-3 py-1.5 rounded-md border border-[#2A2D33] shadow-md backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-[#35C98A]" />
                <span className="text-xs font-mono font-semibold text-[#F4F4F2]">REFERENCE WILD-TYPE</span>
                <span className="text-[10px] text-[#70757D] font-mono">({originalSequence.length} bp)</span>
              </div>
              <DNAScene
                sequence={originalSequence}
                visualizationMode={visualizationMode}
                selectedPosition={selectedPosition}
                selectedStrand={selectedStrand}
                mutatedPositions={emptySet}
                qualityPreset={qualityPreset}
                onSelectNucleotide={onSelectNucleotide}
                hoveredPosition={hoveredPosition}
                setHoveredPosition={setHoveredPosition}
                autoRotate={autoRotate}
                autoRotateSpeed={autoRotateSpeed}
                resetCameraTrigger={resetKey}
              />
            </div>

            {/* RIGHT: MUTATED OBSERVED */}
            <div className="w-1/2 h-full relative">
              <div className="absolute top-3 left-4 z-10 flex items-center space-x-2 bg-[#111316]/90 px-3 py-1.5 rounded-md border border-[#2A2D33] shadow-md backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-[#F3B347] animate-pulse" />
                <span className="text-xs font-mono font-semibold text-[#F4F4F2]">OBSERVED VARIANT</span>
                <span className="text-[10px] text-[#70757D] font-mono">({mutatedSequence.length} bp)</span>
              </div>
              <DNAScene
                sequence={mutatedSequence}
                visualizationMode={visualizationMode}
                selectedPosition={selectedPosition}
                selectedStrand={selectedStrand}
                mutatedPositions={mutatedIndices}
                qualityPreset={qualityPreset}
                onSelectNucleotide={onSelectNucleotide}
                hoveredPosition={hoveredPosition}
                setHoveredPosition={setHoveredPosition}
                autoRotate={autoRotate}
                autoRotateSpeed={autoRotateSpeed}
                resetCameraTrigger={resetKey}
              />
            </div>
          </div>
        )}

        {/* OVERLAY MODE */}
        {viewType === 'overlay' && (
          <div className="w-full h-full relative">
            <div className="absolute top-3 left-4 z-10 flex items-center space-x-2 bg-[#111316]/90 px-3 py-1.5 rounded-md border border-[#2A2D33] shadow-md backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-[#F3B347]" />
              <span className="text-xs font-mono font-semibold text-[#F4F4F2]">OVERLAY: MUTATED HIGHLIGHTED</span>
              <span className="text-[10px] text-[#70757D] font-mono">(Mutations rendered in radiant amber)</span>
            </div>
            <DNAScene
              sequence={mutatedSequence}
              visualizationMode={visualizationMode}
              selectedPosition={selectedPosition}
              selectedStrand={selectedStrand}
              mutatedPositions={mutatedIndices}
              qualityPreset={qualityPreset}
              onSelectNucleotide={onSelectNucleotide}
              hoveredPosition={hoveredPosition}
              setHoveredPosition={setHoveredPosition}
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              resetCameraTrigger={resetKey}
            />
          </div>
        )}

        {/* ORIGINAL ONLY */}
        {viewType === 'original' && (
          <div className="w-full h-full relative">
            <div className="absolute top-3 left-4 z-10 flex items-center space-x-2 bg-[#111316]/90 px-3 py-1.5 rounded-md border border-[#2A2D33] shadow-md backdrop-blur-md">
              <span className="text-xs font-mono font-semibold text-[#F4F4F2]">REFERENCE SEQUENCE VIEW</span>
            </div>
            <DNAScene
              sequence={originalSequence}
              visualizationMode={visualizationMode}
              selectedPosition={selectedPosition}
              selectedStrand={selectedStrand}
              mutatedPositions={emptySet}
              qualityPreset={qualityPreset}
              onSelectNucleotide={onSelectNucleotide}
              hoveredPosition={hoveredPosition}
              setHoveredPosition={setHoveredPosition}
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              resetCameraTrigger={resetKey}
            />
          </div>
        )}

        {/* MUTATED ONLY */}
        {viewType === 'mutated' && (
          <div className="w-full h-full relative">
            <div className="absolute top-3 left-4 z-10 flex items-center space-x-2 bg-[#111316]/90 px-3 py-1.5 rounded-md border border-[#2A2D33] shadow-md backdrop-blur-md">
              <span className="text-xs font-mono font-semibold text-[#F4F4F2]">OBSERVED SEQUENCE VIEW</span>
            </div>
            <DNAScene
              sequence={mutatedSequence}
              visualizationMode={visualizationMode}
              selectedPosition={selectedPosition}
              selectedStrand={selectedStrand}
              mutatedPositions={mutatedIndices}
              qualityPreset={qualityPreset}
              onSelectNucleotide={onSelectNucleotide}
              hoveredPosition={hoveredPosition}
              setHoveredPosition={setHoveredPosition}
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              resetCameraTrigger={resetKey}
            />
          </div>
        )}
      </div>

      {/* Bottom Differential Summary Bar */}
      {mutationDiff && (
        <div className="bg-[#111316] border-t border-[#2A2D33] px-4 py-2.5 z-10 flex flex-wrap items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-3">
            <span className="text-[#A0A3AA] font-semibold">DIFFERENTIAL ANALYSIS:</span>
            <span className="text-[#F4F4F2]">
              Position #{mutationDiff.position}: {mutationDiff.originalBase || '-'} &rarr; {mutationDiff.newBase || mutationDiff.insertedBases || '-'} ({mutationDiff.categoryLabel})
            </span>
            <span className="text-[#2A2D33]">|</span>
            <span className="text-[#A0A3AA]">
              Codon: {mutationDiff.originalCodon || 'N/A'} ({mutationDiff.originalAminoAcid?.code3 || '?'}) &rarr; {mutationDiff.mutatedCodon || 'N/A'} ({mutationDiff.mutatedAminoAcid?.code3 || '?'})
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-[#35C98A]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Restoration Candidate: {mutationDiff.newBase || '-'} &rarr; {mutationDiff.originalBase || '-'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
