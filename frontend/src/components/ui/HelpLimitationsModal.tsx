import React from 'react';
import {
  HelpCircle,
  X,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  FileCode,
} from 'lucide-react';

interface HelpLimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpLimitationsModal: React.FC<HelpLimitationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none">
      <div className="bg-[#111316] border border-[#2A2D33] rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2A2D33] flex items-center justify-between bg-[#17191D]">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-[#FF6500]" />
            <h2 className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
              BioCrystal 3D — Scientific Methodology & Limitations
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#70757D] hover:text-[#F4F4F2] hover:bg-[#1D2025] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs text-[#A0A3AA] font-sans leading-relaxed">
          {/* 1. Core Workflow */}
          <div className="space-y-2">
            <h3 className="font-mono font-bold text-[#F4F4F2] uppercase text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#35C98A]" />
              <span>1. Scientific Analysis Workflow</span>
            </h3>
            <p>
              BioCrystal 3D operates on a strict two-stage pipeline. A DNA sequence cannot reveal a mutation in isolation; it must be pairwise aligned against an established reference sequence using Biopython's Needleman-Wunsch global alignment algorithm.
            </p>
            <p>
              Only when coding context (CDS) and reading frame are validated does the system translate nucleotides into codons, evaluate biochemical shifts, and attempt 3D structural mapping.
            </p>
          </div>

          {/* 2. Coordinate Mapping Systems */}
          <div className="space-y-2">
            <h3 className="font-mono font-bold text-[#F4F4F2] uppercase text-[11px] flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-[#22C7E8]" />
              <span>2. Multi-Coordinate Transformation Rules</span>
            </h3>
            <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
              <li><strong>DNA Coordinates:</strong> 1-indexed human-readable nucleotide position ($1 \dots N$).</li>
              <li><strong>Codon Coordinates:</strong> $(pos - 1 - frame) // 3 + 1$, reflecting triplet boundaries.</li>
              <li><strong>Protein Residues:</strong> Numbered $1 \dots L$ beginning at the initiator Methionine codon (ATG).</li>
              <li><strong>PDB Residue Identifiers:</strong> Mapped to the specific experimental crystal structure chain coordinates, accounting for cloning tags and unresolved terminal residues.</li>
            </ul>
          </div>

          {/* 3. Structural Modeling Rules (No Fake Structures) */}
          <div className="space-y-2">
            <h3 className="font-mono font-bold text-[#F4F4F2] uppercase text-[11px] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#F3B347]" />
              <span>3. Macromolecular Integrity (No Fabricated 3D Models)</span>
            </h3>
            <p>
              Under strict scientific principles, decorative 3D cartoons or hallucinated proteins are never displayed. When an experimental structure is available (e.g. KRAS G12C PDB: 6OIM, HBB PDB: 1A3N), the real atomic coordinates are fetched and rendered as a dense molecular surface.
            </p>
            <p>
              If a sequence cannot be mapped to an experimentally verified PDB structure, the system displays an honest <strong>"Structural mapping unavailable"</strong> status while preserving complete sequence alignment and codon translation.
            </p>
          </div>

          {/* 4. Biological Impact Assessment Disclaimers */}
          <div className="space-y-2 p-3 bg-[#090A0C] rounded-md border border-[#2A2D33]">
            <h3 className="font-mono font-bold text-[#FF6500] uppercase text-[10px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>4. Regulatory & Non-Clinical Disclaimer</span>
            </h3>
            <p className="text-[11px] text-[#70757D]">
              BioCrystal 3D is engineered strictly for computational biology research, educational exploration, and in-silico simulation. Consequence classifications (e.g. missense, nonsense, impact tiers) are algorithmic predictions based on canonical genetic code tables and stereochemical heuristics. They do not constitute clinical genetic diagnoses or medical treatment advice. Wet-lab experimental assays (Sanger/NGS sequencing, functional enzymatic assays) are mandatory prior to drawing clinical conclusions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2A2D33] flex justify-end bg-[#17191D]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#F4F4F2] text-[#090A0C] font-mono font-bold text-xs hover:bg-white cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
