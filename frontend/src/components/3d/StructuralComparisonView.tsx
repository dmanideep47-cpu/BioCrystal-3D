import React, { useState } from 'react';
import { MolecularSurfaceViewer } from './MolecularSurfaceViewer';
import { MappedResidue, StructureProvenance, AlignmentMutation } from '../../types/dna';
import {
  Columns,
  GitCompare,
  ShieldAlert,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface StructuralComparisonViewProps {
  pdbData: string | null;
  mappedResidues: MappedResidue[];
  mutations: AlignmentMutation[];
  selectedResidueNumber: number | null;
  selectedChain: string | null;
  provenance: StructureProvenance | null;
  isMapped: boolean;
  unmappedReason?: string | null;
  onSelectResidue?: (residueNum: number, chain: string) => void;
}

export const StructuralComparisonView: React.FC<StructuralComparisonViewProps> = ({
  pdbData,
  mappedResidues,
  mutations: _mutations,
  selectedResidueNumber,
  selectedChain,
  provenance,
  isMapped,
  unmappedReason,
  onSelectResidue,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'reference-focus'>('side-by-side');

  if (!isMapped || !pdbData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#090A0C] text-[#A0A3AA] p-8 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#F3B347] mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-mono font-bold text-[#F4F4F2] uppercase tracking-wider mb-2">
          Structural Comparison Unavailable
        </h3>
        <p className="text-xs text-[#70757D] max-w-lg leading-relaxed">
          {unmappedReason ||
            'Neither reference nor mutant tertiary macromolecular structures could be mapped for this input. Synthetic or fabricated protein conformations are never generated.'}
        </p>
      </div>
    );
  }

  const primaryMutation = mappedResidues.length > 0 ? mappedResidues[0] : null;

  return (
    <div className="w-full h-full flex flex-col bg-[#090A0C] select-none overflow-hidden">
      {/* Top Comparison Sub-header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111316] border-b border-[#2A2D33] z-10 gap-2 font-mono">
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 text-[#F4F4F2] font-semibold">
            <GitCompare className="w-4 h-4 text-[#FF6500]" />
            <span>STRUCTURAL CONFORMATION COMPARISON</span>
          </div>

          {primaryMutation && (
            <div className="flex items-center space-x-2 text-xs bg-[#090A0C] px-2.5 py-1 rounded-md border border-[#2A2D33]">
              <span className="text-[#70757D]">Variant:</span>
              <span className="text-[#FF6500] font-semibold">
                {primaryMutation.original_residue}{primaryMutation.residue_number}{primaryMutation.mutated_residue}
              </span>
              <span className="text-[#2A2D33]">|</span>
              <span className="text-[#70757D]">Chain:</span>
              <span className="text-[#22C7E8]">{primaryMutation.chain}</span>
              <span className="text-[#2A2D33]">|</span>
              <span className="text-[#35C98A]">{primaryMutation.impact_label}</span>
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center space-x-1 bg-[#090A0C] p-0.5 rounded-md border border-[#2A2D33] text-xs">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'side-by-side'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>

          <button
            onClick={() => setViewMode('reference-focus')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'reference-focus'
                ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] font-semibold'
                : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
            }`}
          >
            <span>Reference Surface Focus</span>
          </button>
        </div>
      </div>

      {/* Main Structural Viewport */}
      <div className="flex-1 relative overflow-hidden flex">
        {viewMode === 'side-by-side' ? (
          <div className="w-full h-full flex flex-col md:flex-row">
            {/* LEFT: EXPERIMENTAL REFERENCE CRYSTAL STRUCTURE */}
            <div className="w-full md:w-1/2 h-full relative border-r border-[#2A2D33] flex flex-col">
              <div className="absolute top-3 left-4 z-10 flex items-center space-x-2 bg-[#111316]/90 px-3 py-1.5 rounded-md border border-[#2A2D33] shadow-md backdrop-blur-md font-mono text-xs">
                <div className="w-2 h-2 rounded-full bg-[#35C98A]" />
                <span className="font-semibold text-[#F4F4F2]">
                  EXPERIMENTAL REFERENCE ({provenance?.pdb_id || 'PDB'})
                </span>
                <span className="text-[10px] text-[#70757D]">
                  {provenance?.method} {provenance?.resolution}
                </span>
              </div>
              <MolecularSurfaceViewer
                pdbData={pdbData}
                mappedResidues={mappedResidues}
                selectedResidueNumber={selectedResidueNumber}
                selectedChain={selectedChain}
                provenance={provenance}
                isMapped={isMapped}
                unmappedReason={unmappedReason}
                onSelectResidue={onSelectResidue}
              />
            </div>

            {/* RIGHT: MUTANT CONFORMATION HONEST STATUS */}
            <div className="w-full md:w-1/2 h-full relative bg-[#090A0C] flex flex-col justify-between p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 bg-[#111316] px-3.5 py-2 rounded-md border border-[#2A2D33] font-mono text-xs text-[#F4F4F2]">
                  <span className="w-2 h-2 rounded-full bg-[#F3B347] animate-pulse" />
                  <span className="font-semibold">MUTANT CONFORMATION STATUS</span>
                </div>

                <div className="bg-[#111316] p-4 rounded-md border border-[#2A2D33] space-y-3 font-mono text-xs">
                  <div className="flex items-center gap-2 text-[#F3B347] font-semibold text-[11px]">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Scientific Accuracy Notice (No Fabricated Coordinates)</span>
                  </div>
                  <p className="text-[11px] text-[#A0A3AA] leading-relaxed">
                    An experimentally determined crystal structure of this specific altered mutant conformation has not been deposited in the PDB. Under BioCrystal 3D's strict computational biology principles, an artificial or hallucinated 3D structure is <strong>never displayed</strong> in place of real experimental data.
                  </p>
                  <p className="text-[11px] text-[#70757D] leading-relaxed">
                    The reference crystal structure (left) accurately displays the physical spatial position, secondary structure context, and sidechain geometry of the wild-type residue undergoing mutation.
                  </p>
                </div>

                {primaryMutation && (
                  <div className="bg-[#111316] p-4 rounded-md border border-[#2A2D33] space-y-2.5 font-mono text-xs">
                    <h4 className="font-bold text-[#F4F4F2] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#35C98A]" />
                      <span>Computational Impact Assessment</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-[#090A0C] p-2 rounded border border-[#2A2D33]">
                        <span className="text-[#70757D] block text-[10px]">Wild-Type Residue</span>
                        <span className="font-bold text-[#35C98A] text-sm">
                          {primaryMutation.original_residue} (Res {primaryMutation.residue_number})
                        </span>
                      </div>
                      <div className="bg-[#090A0C] p-2 rounded border border-[#2A2D33]">
                        <span className="text-[#70757D] block text-[10px]">Altered Residue</span>
                        <span className="font-bold text-[#FF6500] text-sm">
                          {primaryMutation.mutated_residue} (Res {primaryMutation.residue_number})
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#70757D]">Region:</span>
                        <span className="text-[#F4F4F2]">{primaryMutation.structural_region}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#70757D]">Assessment:</span>
                        <span className="text-[#FF6500] font-semibold">{primaryMutation.impact_label}</span>
                      </div>
                      <div className="pt-1.5 border-t border-[#2A2D33] text-[10px] text-[#A0A3AA] leading-relaxed">
                        {primaryMutation.impact_rationale}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#111316] rounded-md border border-[#2A2D33] text-[10px] font-mono text-[#70757D] flex items-center gap-2 mt-4">
                <Info className="w-4 h-4 text-[#22C7E8] shrink-0" />
                <span>
                  Validation criteria: To observe tertiary conformational changes, submit sequence to AlphaFold-Multimer or RosettaFold or perform X-ray crystallography.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <MolecularSurfaceViewer
              pdbData={pdbData}
              mappedResidues={mappedResidues}
              selectedResidueNumber={selectedResidueNumber}
              selectedChain={selectedChain}
              provenance={provenance}
              isMapped={isMapped}
              unmappedReason={unmappedReason}
              onSelectResidue={onSelectResidue}
            />
          </div>
        )}
      </div>
    </div>
  );
};
