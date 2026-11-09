import React, { useRef, useEffect } from 'react';
import { AlignmentMutation } from '../../types/dna';
import { BASE_COLORS } from '../../services/bDNAEngine';

interface AlignedSequenceRibbonProps {
  alignedReference: string;
  alignedObserved: string;
  mutations: AlignmentMutation[];
  selectedMutationIndex: number | null;
  onSelectMutation: (index: number) => void;
}

export const AlignedSequenceRibbon: React.FC<AlignedSequenceRibbonProps> = ({
  alignedReference,
  alignedObserved,
  mutations,
  selectedMutationIndex,
  onSelectMutation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected mutation
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedMutationIndex]);

  if (!alignedReference || !alignedObserved) {
    return null;
  }

  // Pre-index mutations by reference position for quick lookup
  const mutationMap = new Map<number, number>();
  mutations.forEach((m, idx) => {
    mutationMap.set(m.reference_position, idx);
  });

  const totalLength = alignedReference.length;
  let currentRefPos = 0;

  return (
    <div className="h-full bg-[#111316] border-t border-[#2A2D33] px-4 py-2 flex flex-col justify-between select-none shrink-0 z-20 font-mono">
      {/* Header and Legend */}
      <div className="flex items-center justify-between text-[10px] text-[#A0A3AA]">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-[#F4F4F2] tracking-wider uppercase">
            Pairwise Aligned Sequence Comparison
          </span>
          <span className="text-[#3D424B]">|</span>
          <span className="text-[#35C98A]">Reference Strand (5' &rarr; 3')</span>
          <span className="text-[#3D424B]">&bull;</span>
          <span className="text-[#22C7E8]">Observed Variant Strand</span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <span className="text-[#70757D]">Click any mismatched column to focus in 3D</span>
          {mutations.length > 0 && (
            <span className="text-[#FF6500] font-semibold bg-[#FF6500]/10 px-2 py-0.5 rounded border border-[#FF6500]/30">
              {mutations.length} Sequence Difference(s)
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Aligned Columns */}
      <div
        ref={containerRef}
        className="flex items-center overflow-x-auto py-1 space-x-0.5 scrollbar-thin"
      >
        {/* Terminal Header */}
        <div className="flex flex-col justify-between items-center text-[10px] font-bold text-[#70757D] px-1.5 shrink-0 h-[64px]">
          <span className="text-[#35C98A]">REF</span>
          <span className="text-[#70757D] text-[9px]">POS</span>
          <span className="text-[#22C7E8]">OBS</span>
        </div>

        {Array.from({ length: totalLength }).map((_, i) => {
          const rBase = alignedReference[i];
          const oBase = alignedObserved[i];

          if (rBase !== '-') {
            currentRefPos += 1;
          }

          const thisPos = currentRefPos;
          const isMismatch = rBase !== oBase;
          const mutIdx = mutationMap.get(thisPos);
          const isSelected = mutIdx !== undefined && mutIdx === selectedMutationIndex;

          const rColor = rBase === '-' ? '#70757D' : (BASE_COLORS[rBase as 'A' | 'T' | 'G' | 'C'] || '#A0A3AA');
          const oColor = oBase === '-' ? '#70757D' : (BASE_COLORS[oBase as 'A' | 'T' | 'G' | 'C'] || '#A0A3AA');

          return (
            <div
              key={i}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => {
                if (mutIdx !== undefined) {
                  onSelectMutation(mutIdx);
                }
              }}
              className={`flex flex-col items-center shrink-0 p-0.5 rounded transition-all ${
                isMismatch ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'bg-[#1D2025] ring-2 ring-[#FF6500]'
                  : isMismatch
                  ? 'bg-[#FF6500]/10 hover:bg-[#FF6500]/20'
                  : 'hover:bg-[#17191D]'
              }`}
            >
              {/* Reference Base */}
              <div
                className="w-6 h-5 rounded font-bold text-[11px] flex items-center justify-center text-[#090A0C]"
                style={{ backgroundColor: rColor }}
                title={`Reference pos ${thisPos}: ${rBase}`}
              >
                {rBase}
              </div>

              {/* Position Coordinate */}
              <span className={`text-[8px] my-0.5 ${isMismatch ? 'text-[#FF6500] font-bold' : 'text-[#70757D]'}`}>
                {rBase === '-' ? '-' : thisPos}
              </span>

              {/* Observed Base */}
              <div
                className={`w-6 h-5 rounded font-bold text-[11px] flex items-center justify-center text-[#090A0C] ${
                  isMismatch ? 'ring-1 ring-[#FF6500]' : ''
                }`}
                style={{ backgroundColor: isMismatch ? '#FF6500' : oColor }}
                title={`Observed base: ${oBase}`}
              >
                {oBase}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

