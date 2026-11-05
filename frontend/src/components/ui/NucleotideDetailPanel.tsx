import React from 'react';
import { NucleotideItem, NucleotideType } from '../../types/dna';
import { BASE_COLORS, MUTATION_COLOR } from '../../services/bDNAEngine';
import {
  Info,
  Dna,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface NucleotideDetailPanelProps {
  selectedItem: NucleotideItem | null;
  onInitiateMutation: (position: number, base: NucleotideType) => void;
  onClearSelection: () => void;
  onNavigatePosition: (pos: number) => void;
  sequenceLength: number;
}

// Canonical physical & chemical properties of DNA nitrogenous bases
const BASE_CHEMISTRY: Record<
  NucleotideType,
  {
    name: string;
    formula: string;
    molecularWeight: number; // g/mol
    rings: string;
    hBondDonorsAcceptors: string;
  }
> = {
  A: {
    name: 'Adenine',
    formula: 'C₅H₅N₅',
    molecularWeight: 135.13,
    rings: 'Purine (Bicyclic: 6- & 5-member)',
    hBondDonorsAcceptors: '1 Donor, 1 Acceptor',
  },
  T: {
    name: 'Thymine',
    formula: 'C₅H₆N₂O₂',
    molecularWeight: 126.11,
    rings: 'Pyrimidine (Monocyclic: 6-member)',
    hBondDonorsAcceptors: '1 Donor, 1 Acceptor',
  },
  G: {
    name: 'Guanine',
    formula: 'C₅H₅N₅O',
    molecularWeight: 151.13,
    rings: 'Purine (Bicyclic: 6- & 5-member)',
    hBondDonorsAcceptors: '2 Donors, 1 Acceptor',
  },
  C: {
    name: 'Cytosine',
    formula: 'C₄H₅N₃O',
    molecularWeight: 111.10,
    rings: 'Pyrimidine (Monocyclic: 6-member)',
    hBondDonorsAcceptors: '1 Donor, 2 Acceptors',
  },
};

export const NucleotideDetailPanel: React.FC<NucleotideDetailPanelProps> = ({
  selectedItem,
  onInitiateMutation,
  onClearSelection,
  onNavigatePosition,
  sequenceLength,
}) => {
  if (!selectedItem) {
    return (
      <aside className="w-full h-full bg-[#111316] p-4 flex flex-col justify-between select-none overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2.5 border-b border-[#2A2D33]">
            <Info className="w-3.5 h-3.5 text-[#FF6500]" />
            <h3 className="text-xs font-mono font-bold text-[#F4F4F2] uppercase tracking-wider">
              Molecular Inspector
            </h3>
          </div>

          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-lg bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#70757D]">
              <Dna className="w-6 h-6 text-[#FF6500]/75" />
            </div>
            <p className="text-xs text-[#F4F4F2] font-semibold">No Nucleotide Selected</p>
            <p className="text-[11px] text-[#A0A3AA] leading-relaxed px-2">
              Select any nucleotide base in the 3D molecular viewport or the dual-strand ribbon below to inspect quantum biophysical properties.
            </p>
          </div>
        </div>

        {/* Legend of Base Colors */}
        <div className="bg-[#090A0C] p-3 rounded-md border border-[#2A2D33] space-y-2.5 text-xs">
          <span className="text-[9px] font-mono font-bold text-[#A0A3AA] uppercase tracking-wider block">
            Scientific Color Encoding
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#35C98A]" />
              <span className="text-[#A0A3AA]">Adenine (A)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6500]" />
              <span className="text-[#A0A3AA]">Thymine (T)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C7E8]" />
              <span className="text-[#A0A3AA]">Guanine (G)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F06464]" />
              <span className="text-[#A0A3AA]">Cytosine (C)</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#2A2D33] flex items-center space-x-2 text-[10px] font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F3B347] animate-pulse" />
            <span className="text-[#F3B347]">Mutated Differential</span>
          </div>
        </div>
      </aside>
    );
  }

  const {
    position,
    base,
    complementBase,
    strand,
    direction,
    codonIndex,
    codonPosInTrio,
    codonSeq,
    mrnaCodonSeq,
    aminoAcid,
    isStartCodon,
    isStopCodon,
    isMutated,
  } = selectedItem;

  const chem = BASE_CHEMISTRY[base] || BASE_CHEMISTRY['A'];
  const hBondCount = base === 'A' || base === 'T' ? 2 : 3;

  return (
    <aside className="w-full h-full bg-[#111316] p-4 flex flex-col justify-between select-none overflow-y-auto">
      <div className="space-y-4">
        {/* Header with Position & Navigation */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#2A2D33]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6500]" />
            <h3 className="text-xs font-mono font-bold text-[#F4F4F2] uppercase tracking-wider">
              Position #{position} / {sequenceLength}
            </h3>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onNavigatePosition(Math.max(1, position - 1))}
              disabled={position <= 1}
              className="p-1 rounded-md bg-[#17191D] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] disabled:opacity-30 cursor-pointer"
              title="Previous nucleotide"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigatePosition(Math.min(sequenceLength, position + 1))}
              disabled={position >= sequenceLength}
              className="p-1 rounded-md bg-[#17191D] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] disabled:opacity-30 cursor-pointer"
              title="Next nucleotide"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClearSelection}
              className="p-1 rounded-md text-[#70757D] hover:text-[#F4F4F2] ml-1.5 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selected Base Pair Card */}
        <div className="bg-[#17191D] border border-[#2A2D33] rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            {/* Target Nucleotide */}
            <div className="flex items-center space-x-3">
              <div
                className="w-11 h-11 rounded-md flex items-center justify-center font-mono text-xl font-bold text-[#090A0C] shadow-sm"
                style={{ backgroundColor: isMutated ? MUTATION_COLOR : BASE_COLORS[base] }}
              >
                {base}
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase font-bold text-[#70757D] block">
                  {strand === 'coding' ? "5' Coding Sense" : "3' Complementary"}
                </span>
                <h4 className="text-xs font-bold text-[#F4F4F2]">
                  {chem.name}
                </h4>
                <span className="text-[10px] text-[#A0A3AA] font-mono">{direction}</span>
              </div>
            </div>

            {/* Watson-Crick Hydrogen Bond Bridge */}
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-[9px] font-mono text-[#F4F4F2] font-semibold">{hBondCount} H-Bonds</span>
              <div className="w-6 border-b border-dashed border-[#A0A3AA] my-1" />
              <span className="text-[8px] font-mono text-[#70757D]">Watson-Crick</span>
            </div>

            {/* Complementary Base */}
            <div className="flex items-center space-x-2">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center font-mono text-lg font-bold text-[#090A0C] shadow-sm"
                style={{ backgroundColor: BASE_COLORS[complementBase] }}
                title={`Complementary base: ${complementBase}`}
              >
                {complementBase}
              </div>
            </div>
          </div>

          {/* Biophysical & Chemical Attributes */}
          <div className="pt-2 border-t border-[#2A2D33] space-y-1 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-[#70757D]">Formula:</span>
              <span className="text-[#F4F4F2]">{chem.formula}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#70757D]">Molecular Weight:</span>
              <span className="text-[#F4F4F2]">{chem.molecularWeight} g/mol</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#70757D]">Ring Structure:</span>
              <span className="text-[#A0A3AA] text-[10px] truncate max-w-[160px]" title={chem.rings}>
                {chem.rings}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#70757D]">Status:</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  isMutated
                    ? 'bg-[#F3B347]/15 text-[#F3B347] border border-[#F3B347]/30'
                    : 'bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30'
                }`}
              >
                {isMutated ? 'MUTATED VARIANT' : 'WILD-TYPE'}
              </span>
            </div>
          </div>
        </div>

        {/* Codon & Translation Details */}
        <div className="bg-[#17191D] border border-[#2A2D33] rounded-md p-3 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#2A2D33]">
            <span className="text-xs font-mono font-bold text-[#F4F4F2]">Codon #{codonIndex}</span>
            <div className="flex items-center space-x-1.5">
              {isStartCodon && (
                <span className="text-[9px] font-mono font-bold bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30 px-1.5 py-0.2 rounded">
                  START (ATG)
                </span>
              )}
              {isStopCodon && (
                <span className="text-[9px] font-mono font-bold bg-[#F06464]/15 text-[#F06464] border border-[#F06464]/30 px-1.5 py-0.2 rounded">
                  STOP (NONSENSE)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-[#111316] p-2 rounded-md border border-[#2A2D33]">
              <span className="text-[9px] text-[#70757D] block">DNA Triplet</span>
              <span className="font-bold text-[#22C7E8] text-sm tracking-wider">
                {codonSeq}
              </span>
            </div>
            <div className="bg-[#111316] p-2 rounded-md border border-[#2A2D33]">
              <span className="text-[9px] text-[#70757D] block">mRNA Codon</span>
              <span className="font-bold text-[#A78BFA] text-sm tracking-wider">
                {mrnaCodonSeq}
              </span>
            </div>
          </div>

          <div className="text-[11px] space-y-1 pt-1 font-mono">
            <div className="flex justify-between">
              <span className="text-[#70757D]">Codon Position:</span>
              <span className="text-[#F4F4F2]">
                {codonPosInTrio === 1 ? '1st Base' : codonPosInTrio === 2 ? '2nd Base' : '3rd Base (Wobble)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#70757D]">Amino Acid:</span>
              <span className="font-semibold text-[#F4F4F2]">
                {aminoAcid.name} ({aminoAcid.code3} / {aminoAcid.code1})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#70757D]">Chemical Class:</span>
              <span className="capitalize text-[#A0A3AA]">{aminoAcid.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#70757D]">Hydropathy Index:</span>
              <span className="text-[#F4F4F2]">{aminoAcid.hydropathy}</span>
            </div>
          </div>
        </div>

        {/* Quick Mutate Actions */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold text-[#70757D] uppercase tracking-wider block">
            Point Mutation at Position #{position}
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['A', 'T', 'G', 'C'] as NucleotideType[]).map((mutBase) => {
              const isCurrent = mutBase === base;
              return (
                <button
                  key={mutBase}
                  disabled={isCurrent}
                  onClick={() => onInitiateMutation(position, mutBase)}
                  className={`py-1.5 rounded-md font-mono font-bold text-xs transition-all ${
                    isCurrent
                      ? 'bg-[#090A0C] text-[#70757D] border border-[#2A2D33] cursor-not-allowed'
                      : 'bg-[#17191D] text-[#F4F4F2] border border-[#2A2D33] hover:bg-[#FF6500] hover:text-[#090A0C] hover:border-[#FF6500] cursor-pointer'
                  }`}
                  title={isCurrent ? 'Current base' : `Simulate substitution to ${mutBase}`}
                >
                  &rarr; {mutBase}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#2A2D33] text-[10px] font-mono text-[#70757D] flex justify-between">
        <span>B-DNA Canonical Core</span>
        <span className="text-[#35C98A] font-semibold">READY</span>
      </div>
    </aside>
  );
};
