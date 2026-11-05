import React, { useRef, useEffect } from 'react';
import { NucleotideType } from '../../types/dna';
import { BASE_COLORS, MUTATION_COLOR } from '../../services/bDNAEngine';
import { getComplementaryBase, translateCodon } from '../../services/bioinformatics';

interface BottomSequenceViewerProps {
  sequence: string;
  selectedPosition: number | null;
  selectedStrand: 'coding' | 'complementary' | null;
  onSelectNucleotide: (position: number, strand: 'coding' | 'complementary') => void;
  mutatedPositions: Set<number>;
  originalSequence?: string;
}

export const BottomSequenceViewer: React.FC<BottomSequenceViewerProps> = ({
  sequence,
  selectedPosition,
  selectedStrand,
  onSelectNucleotide,
  mutatedPositions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto scroll to selected nucleotide smoothly
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedPosition]);

  const length = sequence.length;

  return (
    <div className="h-full bg-[#111316] border-t border-[#2A2D33] px-4 py-2 flex flex-col justify-between select-none shrink-0 z-20">
      {/* Label and Strand Legend */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#A0A3AA]">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-[#F4F4F2] tracking-wider uppercase">DUAL-STRAND SEQUENCE RIBBON</span>
          <span className="text-[#3D424B]">|</span>
          <span className="text-[#22C7E8] font-medium">5' &rarr; 3' Coding Strand</span>
          <span className="text-[#3D424B]">&bull;</span>
          <span className="text-[#A78BFA] font-medium">3' &larr; 5' Complementary Strand</span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <span className="text-[#70757D]">Click base to focus 3D camera</span>
          {mutatedPositions.size > 0 && (
            <span className="text-[#F3B347] font-semibold bg-[#F3B347]/10 px-2 py-0.5 rounded border border-[#F3B347]/30 animate-pulse">
              {mutatedPositions.size} Mutated Position(s)
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Dual-Strand Ribbon */}
      <div
        ref={containerRef}
        className="flex items-center overflow-x-auto py-1 space-x-1 scrollbar-thin"
      >
        {/* 5' Terminal Marker */}
        <div className="flex flex-col justify-between items-center text-[10px] font-mono text-[#70757D] px-1 shrink-0 h-[64px]">
          <span className="text-[#22C7E8] font-bold">5'</span>
          <span className="text-[#3D424B] text-[9px]">&bull;</span>
          <span className="text-[#A78BFA] font-bold">3'</span>
        </div>

        {/* Nucleotide Columns */}
        {Array.from({ length }).map((_, i) => {
          const pos = i + 1; // 1-indexed
          const codingBase = sequence[i] as NucleotideType;
          const compBase = getComplementaryBase(codingBase);
          const isMutated = mutatedPositions.has(pos);
          const isSelected = selectedPosition === pos;

          // Codon grouping
          const codonIdx = Math.floor(i / 3) + 1;
          const posInCodon = (i % 3) + 1;
          const isCodonStart = posInCodon === 1;
          const codonSeq = sequence.substring(Math.floor(i / 3) * 3, Math.floor(i / 3) * 3 + 3);
          const aa = translateCodon(codonSeq);

          return (
            <div
              key={pos}
              ref={isSelected ? selectedRef : undefined}
              className={`flex flex-col items-center shrink-0 p-0.5 rounded transition-all ${
                isSelected
                  ? 'bg-[#1D2025] ring-1 ring-[#FF6500]'
                  : isMutated
                  ? 'bg-[#F3B347]/10 ring-1 ring-[#F3B347]/40'
                  : 'hover:bg-[#17191D]'
              }`}
            >
              {/* Top: Coding Strand Base */}
              <button
                onClick={() => onSelectNucleotide(pos, 'coding')}
                className={`w-7 h-6 rounded font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  isMutated
                    ? 'text-[#090A0C] shadow-sm'
                    : isSelected && selectedStrand === 'coding'
                    ? 'ring-2 ring-white text-[#090A0C]'
                    : 'text-[#090A0C] hover:brightness-110'
                }`}
                style={{
                  backgroundColor: isMutated ? MUTATION_COLOR : BASE_COLORS[codingBase],
                }}
                title={`Position ${pos}: ${codingBase} (Coding 5'->3')`}
              >
                {codingBase}
              </button>

              {/* Middle: Position Number & Codon Bracket */}
              <div className="flex flex-col items-center my-0.5">
                <span className="text-[9px] font-mono text-[#70757D] leading-none">{pos}</span>
                {isCodonStart && (
                  <span
                    className="text-[8px] font-mono font-semibold text-[#F4F4F2] leading-none mt-0.5"
                    title={`Codon ${codonIdx}: ${aa.code3}`}
                  >
                    {aa.code3}
                  </span>
                )}
              </div>

              {/* Bottom: Complementary Strand Base */}
              <button
                onClick={() => onSelectNucleotide(pos, 'complementary')}
                className={`w-7 h-6 rounded font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  isMutated
                    ? 'text-[#090A0C] shadow-sm'
                    : isSelected && selectedStrand === 'complementary'
                    ? 'ring-2 ring-white text-[#090A0C]'
                    : 'text-[#090A0C] hover:brightness-110'
                }`}
                style={{
                  backgroundColor: isMutated ? MUTATION_COLOR : BASE_COLORS[compBase],
                }}
                title={`Position ${pos}: ${compBase} (Complementary 3'<-5')`}
              >
                {compBase}
              </button>
            </div>
          );
        })}

        {/* 3' Terminal Marker */}
        <div className="flex flex-col justify-between items-center text-[10px] font-mono text-[#70757D] px-1 shrink-0 h-[64px]">
          <span className="text-[#22C7E8] font-bold">3'</span>
          <span className="text-[#3D424B] text-[9px]">&bull;</span>
          <span className="text-[#A78BFA] font-bold">5'</span>
        </div>
      </div>
    </div>
  );
};
