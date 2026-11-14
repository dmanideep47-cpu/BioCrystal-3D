import React from 'react';
import {
  AlignmentMutation,
  MappedResidue,
} from '../../types/dna';
import {
  ListOrdered,
  Layers,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

interface MutationNavigatorProps {
  mutations: AlignmentMutation[];
  mappedResidues: MappedResidue[];
  selectedIndex: number | null;
  onSelectMutation: (index: number) => void;
  isStructureMapped: boolean;
}

export const MutationNavigator: React.FC<MutationNavigatorProps> = ({
  mutations,
  mappedResidues,
  selectedIndex,
  onSelectMutation,
  isStructureMapped: _isStructureMapped,
}) => {
  if (mutations.length === 0) {
    return (
      <div className="h-full bg-[#111316] border-r border-[#2A2D33] p-4 flex flex-col justify-center items-center text-center select-none font-mono">
        <CheckCircle2 className="w-8 h-8 text-[#35C98A] mb-2" />
        <h4 className="text-xs font-bold text-[#F4F4F2] uppercase">No Sequence Differences</h4>
        <p className="text-[11px] text-[#70757D] mt-1 max-w-xs">
          Pairwise alignment detected 100% identity between reference and observed sequences.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#111316] border-r border-[#2A2D33] flex flex-col select-none font-mono overflow-hidden">
      {/* Navigator Header */}
      <div className="p-3.5 border-b border-[#2A2D33] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ListOrdered className="w-3.5 h-3.5 text-[#FF6500]" />
          <h3 className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
            Mutation Navigator
          </h3>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#17191D] text-[#FF6500] border border-[#2A2D33]">
          {mutations.length} Detected
        </span>
      </div>

      {/* Mutation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {mutations.map((mut, idx) => {
          const isSelected = selectedIndex === idx;
          const mappedRes = mappedResidues.find(
            (r) => r.mutation_ref_pos === mut.reference_position
          );

          return (
            <div
              key={idx}
              onClick={() => onSelectMutation(idx)}
              className={`p-3 rounded-md border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#1D2025] border-[#FF6500] shadow-md'
                  : 'bg-[#17191D] border-[#2A2D33] hover:border-[#3D424B] hover:bg-[#1D2025]/60'
              }`}
            >
              {/* Header with Coordinate and Change */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F4F4F2]">
                  Pos {mut.reference_position}: {mut.original_base} &rarr; {mut.observed_base}
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-[#17191D] text-[#A0A3AA] border-[#2A2D33]">
                  {mut.category_label}
                </span>
              </div>

              {/* Codon and Amino Acid context */}
              {mut.reference_codon && mut.observed_codon && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#A0A3AA]">
                  <span>
                    Codon {mut.affected_codon_index}: {mut.reference_codon} &rarr; {mut.observed_codon}
                  </span>
                  <span className="font-semibold text-[#F4F4F2]">
                    {mut.original_amino_acid?.code3} &rarr; {mut.observed_amino_acid?.code3}
                  </span>
                </div>
              )}

              {/* Structural Mapping Status Pill */}
              <div className="mt-2 pt-2 border-t border-[#2A2D33]/60 flex items-center justify-between text-[10px]">
                {mappedRes && mappedRes.is_mapped ? (
                  <span className="flex items-center gap-1 text-[#22C7E8]">
                    <Layers className="w-3 h-3" />
                    <span>
                      Chain {mappedRes.chain}: Res {mappedRes.residue_number}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#70757D]">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Structure Unmapped</span>
                  </span>
                )}

                {mappedRes?.pdb_residue && mappedRes.pdb_residue !== 'undefined' && (
                  <span className="text-[#A0A3AA]">
                    PDB residue: {mappedRes.pdb_residue}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
