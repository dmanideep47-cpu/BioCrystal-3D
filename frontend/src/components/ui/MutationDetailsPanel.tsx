import React from 'react';
import {
  AlignmentMutation,
  MappedResidue,
  FullAnalysisResult,
} from '../../types/dna';
import {
  Info,
  Layers,
  Dna,
} from 'lucide-react';

interface MutationDetailsPanelProps {
  selectedMutation: AlignmentMutation | null;
  mappedResidue: MappedResidue | null;
  analysisResult: FullAnalysisResult | null;
}

export const MutationDetailsPanel: React.FC<MutationDetailsPanelProps> = ({
  selectedMutation,
  mappedResidue,
  analysisResult,
}) => {
  if (!selectedMutation) {
    return (
      <aside className="h-full bg-[#111316] border-l border-[#2A2D33] p-4 flex flex-col justify-between select-none font-mono overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2.5 border-b border-[#2A2D33]">
            <Info className="w-3.5 h-3.5 text-[#FF6500]" />
            <h3 className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
              Analysis Summary
            </h3>
          </div>

          {analysisResult && (
            <div className="bg-[#17191D] p-3.5 rounded-md border border-[#2A2D33] space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-[#2A2D33]">
                <span className="text-[#70757D]">Alignment Identity:</span>
                <span className="font-bold text-[#35C98A]">
                  {analysisResult.alignment.identity_percent}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#70757D]">Alignment Score:</span>
                <span className="text-[#F4F4F2] font-semibold">
                  {analysisResult.alignment.alignment_score}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#70757D]">Total Differences:</span>
                <span className="text-[#FF6500] font-bold">
                  {analysisResult.alignment.mutation_count}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#70757D]">3D Structure Mapping:</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  analysisResult.structure_mapping.mapped
                    ? 'bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30'
                    : 'bg-[#70757D]/15 text-[#70757D] border border-[#70757D]/30'
                }`}>
                  {analysisResult.structure_mapping.mapped ? `PDB: ${analysisResult.structure_mapping.pdb_id}` : 'UNAVAILABLE'}
                </span>
              </div>
            </div>
          )}

          <div className="text-center py-6 space-y-2">
            <div className="w-10 h-10 mx-auto rounded-lg bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#70757D]">
              <Dna className="w-5 h-5 text-[#FF6500]/70" />
            </div>
            <p className="text-xs text-[#F4F4F2] font-semibold">Select a Mutation</p>
            <p className="text-[11px] text-[#70757D] px-2 leading-relaxed font-sans">
              Click any variant in the Mutation Navigator or Aligned Ribbon to inspect codon context, structural localization, and impact rationale.
            </p>
          </div>
        </div>

        <div className="p-3 bg-[#090A0C] rounded-md border border-[#2A2D33] text-[10px] text-[#70757D] leading-relaxed font-sans">
          <strong className="text-[#A0A3AA] block mb-0.5 font-mono">Computational Biology Notice</strong>
          Variant consequences and biological impact ratings are algorithmic inferences based on standard codon tables and reference crystal coordinates. Not intended for clinical diagnostic use.
        </div>
      </aside>
    );
  }

  const {
    reference_position,
    observed_position,
    original_base,
    observed_base,
    affected_codon_index,
    reference_codon,
    observed_codon,
    original_amino_acid,
    observed_amino_acid,
    category_label,
    description,
    is_transition,
    is_transversion,
  } = selectedMutation;

  return (
    <aside className="h-full bg-[#111316] border-l border-[#2A2D33] p-4 flex flex-col justify-between select-none font-mono overflow-y-auto space-y-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#2A2D33]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6500]" />
            <h3 className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
              Variant Detail: Pos #{reference_position}
            </h3>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30">
            {selectedMutation.type.toUpperCase()}
          </span>
        </div>

        {/* Nucleotide Change Card */}
        <div className="bg-[#17191D] p-3 rounded-md border border-[#2A2D33] space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] text-[#70757D] block uppercase">DNA Substitution</span>
              <span className="text-sm font-bold text-[#F4F4F2]">
                {original_base} &rarr; <strong className="text-[#FF6500]">{observed_base}</strong>
              </span>
            </div>

            <div className="text-right">
              <span className="text-[9px] text-[#70757D] block uppercase">Nucleic Type</span>
              <span className="text-[11px] font-semibold text-[#22C7E8]">
                {is_transition ? 'Transition' : is_transversion ? 'Transversion' : 'Indel'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#2A2D33] flex justify-between text-[11px]">
            <span className="text-[#70757D]">Ref Position: {reference_position}</span>
            <span className="text-[#70757D]">Obs Position: {observed_position}</span>
          </div>

          {description && (
            <p className="text-[10px] text-[#A0A3AA] pt-1.5 border-t border-[#2A2D33]/40">
              {description}
            </p>
          )}
        </div>

        {/* Codon & Translation Shift Card */}
        {reference_codon && observed_codon && (
          <div className="bg-[#17191D] p-3 rounded-md border border-[#2A2D33] space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#2A2D33]">
              <span className="font-bold text-[#F4F4F2]">Codon #{affected_codon_index}</span>
              <span className="text-[10px] text-[#22C7E8] font-semibold">{category_label}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#111316] p-2 rounded border border-[#2A2D33]">
                <span className="text-[9px] text-[#70757D] block">Wild-Type Codon</span>
                <span className="font-bold text-[#35C98A] text-sm">{reference_codon}</span>
                <span className="text-[10px] text-[#A0A3AA] block mt-0.5">
                  {original_amino_acid?.name} ({original_amino_acid?.code3})
                </span>
              </div>

              <div className="bg-[#111316] p-2 rounded border border-[#2A2D33]">
                <span className="text-[9px] text-[#70757D] block">Altered Codon</span>
                <span className="font-bold text-[#FF6500] text-sm">{observed_codon}</span>
                <span className="text-[10px] text-[#A0A3AA] block mt-0.5">
                  {observed_amino_acid?.name} ({observed_amino_acid?.code3})
                </span>
              </div>
            </div>

            {original_amino_acid && observed_amino_acid && (
              <div className="text-[11px] space-y-1 pt-1 border-t border-[#2A2D33]">
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Sidechain Shift:</span>
                  <span className="text-[#F4F4F2] capitalize">
                    {original_amino_acid.category} &rarr; {observed_amino_acid.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#70757D]">Hydropathy Shift:</span>
                  <span className="text-[#F4F4F2]">
                    {original_amino_acid.hydropathy} &rarr; {observed_amino_acid.hydropathy}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3D Macromolecular Mapping Card */}
        <div className="bg-[#17191D] p-3 rounded-md border border-[#2A2D33] space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#2A2D33]">
            <span className="font-bold text-[#F4F4F2] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#22C7E8]" />
              <span>3D Structural Mapping</span>
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
              mappedResidue?.is_mapped
                ? 'bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30'
                : 'bg-[#70757D]/15 text-[#70757D] border border-[#70757D]/30'
            }`}>
              {mappedResidue?.is_mapped ? 'MAPPED' : 'UNAVAILABLE'}
            </span>
          </div>

          {mappedResidue && mappedResidue.is_mapped ? (
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#70757D]">Chain & Residue:</span>
                <span className="text-[#F4F4F2] font-bold">
                  Chain {mappedResidue.chain}, Residue #{mappedResidue.residue_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#70757D]">Structural Region:</span>
                <span className="text-[#22C7E8] font-semibold text-right max-w-[170px] truncate" title={mappedResidue.structural_region}>
                  {mappedResidue.structural_region}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#70757D]">Confidence:</span>
                <span className="text-[#35C98A]">{mappedResidue.mapping_confidence}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[#70757D] leading-relaxed">
              No experimentally solved 3D protein structure could be confidently mapped to this sequence.
            </p>
          )}
        </div>

        {/* Biological Impact Assessment */}
        {mappedResidue && mappedResidue.is_mapped && (
          <div className="bg-[#17191D] p-3 rounded-md border border-[#2A2D33] space-y-2 text-xs">
            <span className="font-bold text-[#F4F4F2] block uppercase text-[10px] tracking-wider">
              Biological Impact Assessment
            </span>

            <div className={`p-2 rounded border text-[11px] font-semibold ${
              mappedResidue.impact_category === 'high'
                ? 'bg-[#FF6500]/10 border-[#FF6500]/30 text-[#FF6500]'
                : mappedResidue.impact_category === 'moderate'
                ? 'bg-[#F3B347]/10 border-[#F3B347]/30 text-[#F3B347]'
                : 'bg-[#35C98A]/10 border-[#35C98A]/30 text-[#35C98A]'
            }`}>
              {mappedResidue.impact_label}
            </div>

            <p className="text-[11px] text-[#A0A3AA] leading-relaxed font-sans">
              {mappedResidue.impact_rationale}
            </p>

            <div className="pt-2 border-t border-[#2A2D33] text-[10px] text-[#70757D] font-sans">
              <strong>Limitation:</strong> {mappedResidue.limitation}
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[#2A2D33] text-[10px] text-[#70757D] flex justify-between items-center">
        <span>Coordinate System: 1-Based</span>
        <span className="text-[#35C98A]">VERIFIED</span>
      </div>
    </aside>
  );
};
