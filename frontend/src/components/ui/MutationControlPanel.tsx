import React, { useState } from 'react';
import {
  NucleotideType,
  MutationType,
  MutationDiff,
} from '../../types/dna';
import {
  simulateMutation,
  getComplementaryBase,
} from '../../services/bioinformatics';
import { BASE_COLORS } from '../../services/bDNAEngine';
import {
  FlaskConical,
  Zap,
  ArrowRight,
  RotateCcw,
  Play,
  HelpCircle,
} from 'lucide-react';

interface MutationControlPanelProps {
  originalSequence: string;
  activeDiff: MutationDiff | null;
  onApplyMutation: (type: MutationType, pos: number, bases: string) => void;
  onResetMutation: () => void;
  onNavigatePosition: (pos: number) => void;
  selectedPosition: number | null;
}

export const MutationControlPanel: React.FC<MutationControlPanelProps> = ({
  originalSequence,
  activeDiff,
  onApplyMutation,
  onResetMutation,
  onNavigatePosition,
  selectedPosition,
}) => {
  const [mutationCategory, setMutationCategory] = useState<MutationType>('substitution');
  const [targetPos, setTargetPos] = useState<number>(selectedPosition || (originalSequence.length >= 9 ? 9 : 1));
  const [substitutionBase, setSubstitutionBase] = useState<NucleotideType>('G');
  const [insertionSequence, setInsertionSequence] = useState<string>('A');
  const [deletionLength, setDeletionLength] = useState<number>(1);

  // Synchronize targetPos if external selectedPosition changes
  React.useEffect(() => {
    if (selectedPosition !== null && selectedPosition <= originalSequence.length) {
      setTargetPos(selectedPosition);
    }
  }, [selectedPosition, originalSequence.length]);

  const currentOriginalBase = (originalSequence[targetPos - 1] || 'A') as NucleotideType;
  const currentComplementBase = getComplementaryBase(currentOriginalBase);

  // Live preview of proposed mutation
  const proposedSimulation = React.useMemo(() => {
    if (mutationCategory === 'substitution') {
      return simulateMutation(originalSequence, 'substitution', targetPos, substitutionBase);
    } else if (mutationCategory === 'insertion') {
      return simulateMutation(originalSequence, 'insertion', targetPos, insertionSequence);
    } else {
      return simulateMutation(originalSequence, 'deletion', targetPos, 'A'.repeat(deletionLength));
    }
  }, [originalSequence, mutationCategory, targetPos, substitutionBase, insertionSequence, deletionLength]);

  const handleApply = () => {
    if (mutationCategory === 'substitution') {
      onApplyMutation('substitution', targetPos, substitutionBase);
    } else if (mutationCategory === 'insertion') {
      onApplyMutation('insertion', targetPos, insertionSequence);
    } else {
      onApplyMutation('deletion', targetPos, 'A'.repeat(deletionLength));
    }
    onNavigatePosition(targetPos);
  };

  // Run the canonical demonstration test
  const handleRunCanonicalDemo = () => {
    setMutationCategory('substitution');
    setTargetPos(9);
    setSubstitutionBase('G');
    onApplyMutation('substitution', 9, 'G');
    onNavigatePosition(9);
  };

  return (
    <div className="h-full flex flex-col bg-[#080808] overflow-y-auto p-6 max-w-5xl mx-auto space-y-5 select-none font-mono">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#292929] gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wider flex items-center space-x-2">
            <FlaskConical className="w-4 h-4 text-[#ff7417]" />
            <span>Interactive Mutation Simulation Laboratory</span>
          </h2>
          <p className="text-[11px] text-[#a3a3a3] mt-0.5 font-sans">
            Simulate point mutations, insertions, and deletions on canonical B-DNA while preserving reference tracking.
          </p>
        </div>

        {/* Demo Shortcut Button */}
        <button
          onClick={handleRunCanonicalDemo}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#1c1c1c] border border-[#ff7417]/40 text-[#ff7417] hover:bg-[#ff7417] hover:text-[#080808] text-xs font-semibold transition-all shadow-sm cursor-pointer"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Run Canonical Demo (Pos 9: T&rarr;G, ACT&rarr;ACG Synonymous)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Mutation Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mutation Type Tabs */}
          <div className="bg-[#151515] p-1 rounded border border-[#292929] flex space-x-1 text-xs">
            <button
              onClick={() => setMutationCategory('substitution')}
              className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                mutationCategory === 'substitution'
                  ? 'bg-[#1c1c1c] text-[#f5f5f5] border border-[#383838]'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              Substitution (Point)
            </button>
            <button
              onClick={() => setMutationCategory('insertion')}
              className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                mutationCategory === 'insertion'
                  ? 'bg-[#1c1c1c] text-[#f5f5f5] border border-[#383838]'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              Insertion (Indel)
            </button>
            <button
              onClick={() => setMutationCategory('deletion')}
              className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                mutationCategory === 'deletion'
                  ? 'bg-[#1c1c1c] text-[#f5f5f5] border border-[#383838]'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              Deletion (Indel)
            </button>
          </div>

          {/* Position Selector */}
          <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider">
                Target Nucleotide Position
              </label>
              <span className="text-xs font-bold text-[#ff7417] bg-[#101010] px-2 py-0.5 rounded border border-[#292929]">
                Position #{targetPos} of {originalSequence.length}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={originalSequence.length}
              value={targetPos}
              onChange={(e) => {
                const p = parseInt(e.target.value);
                setTargetPos(p);
                onNavigatePosition(p);
              }}
              className="w-full h-1.5 bg-[#101010] rounded appearance-none cursor-pointer accent-[#ff7417]"
            />

            {/* Current base at selected position */}
            <div className="flex items-center justify-between p-2.5 rounded bg-[#101010] border border-[#292929] text-xs">
              <div className="flex items-center space-x-3">
                <span className="text-[#686868]">Current Base:</span>
                <span
                  className="font-bold px-2 py-0.5 rounded text-[#080808]"
                  style={{ backgroundColor: BASE_COLORS[currentOriginalBase] }}
                >
                  {currentOriginalBase}
                </span>
                <span className="text-[#686868]">Complement:</span>
                <span
                  className="font-bold px-2 py-0.5 rounded text-[#080808]"
                  style={{ backgroundColor: BASE_COLORS[currentComplementBase] }}
                >
                  {currentComplementBase}
                </span>
              </div>
              <div className="text-[#a3a3a3]">
                Codon #{Math.floor((targetPos - 1) / 3) + 1}
              </div>
            </div>
          </div>

          {/* Specific controls for each mutation type */}
          {mutationCategory === 'substitution' && (
            <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-3">
              <label className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider block">
                Select Replacement Nucleotide
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {(['A', 'T', 'G', 'C'] as NucleotideType[]).map((base) => {
                  const isCurrent = base === currentOriginalBase;
                  const isSelected = base === substitutionBase;
                  return (
                    <button
                      key={base}
                      disabled={isCurrent}
                      onClick={() => setSubstitutionBase(base)}
                      className={`p-2.5 rounded border text-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#101010] border-[#292929] text-[#686868] opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#1c1c1c] border-[#ff7417] text-[#ff7417] shadow-sm'
                          : 'bg-[#101010] border-[#292929] text-[#f5f5f5] hover:border-[#383838]'
                      }`}
                    >
                      <span className="text-xl font-bold block">{base}</span>
                      <span className="text-[9px] text-[#686868] mt-0.5 block">
                        {isCurrent ? 'Current' : `Pairs with ${getComplementaryBase(base)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mutationCategory === 'insertion' && (
            <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-2.5">
              <label className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider block">
                Nucleotides to Insert (5' &rarr; 3')
              </label>
              <input
                type="text"
                value={insertionSequence}
                onChange={(e) => setInsertionSequence(e.target.value.toUpperCase().replace(/[^ATGC]/g, ''))}
                placeholder="e.g. A or ATG"
                className="w-full bg-[#101010] border border-[#292929] focus:border-[#ff7417] rounded px-3 py-2 text-xs text-[#f5f5f5] placeholder-[#686868] focus:outline-none"
              />
              <p className="text-[11px] text-[#686868]">
                {insertionSequence.length % 3 === 0
                  ? 'In-frame insertion (length is a multiple of 3). Reading frame preserved.'
                  : `Frameshift warning: length (${insertionSequence.length} bp) causes a shift of +${
                      insertionSequence.length % 3
                    } bp.`}
              </p>
            </div>
          )}

          {mutationCategory === 'deletion' && (
            <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-2.5">
              <label className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider block">
                Number of Nucleotides to Remove
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 6].map((count) => (
                  <button
                    key={count}
                    onClick={() => setDeletionLength(count)}
                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${
                      deletionLength === count
                        ? 'bg-[#1c1c1c] text-[#ff7417] border-[#ff7417]'
                        : 'bg-[#101010] text-[#a3a3a3] border-[#292929] hover:border-[#383838]'
                    }`}
                  >
                    {count} bp {count % 3 === 0 ? '(In-frame)' : '(Frameshift)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Execution Bar */}
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={handleApply}
              className="flex-1 py-2.5 px-5 rounded font-bold text-xs bg-[#ff7417] hover:bg-[#ff8533] text-[#080808] flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Simulate & Apply to 3D Helix</span>
            </button>

            {activeDiff && (
              <button
                onClick={onResetMutation}
                className="py-2.5 px-4 rounded font-semibold text-xs bg-[#151515] border border-[#292929] hover:bg-[#1c1c1c] text-[#f5f5f5] flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Prediction & Biological Consequence Preview */}
        <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-4">
          <h3 className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider pb-2 border-b border-[#292929]">
            Consequence Prediction
          </h3>

          <div className="space-y-3.5">
            {/* Classification Badge */}
            <div className="p-2.5 rounded bg-[#101010] border border-[#292929] space-y-1.5">
              <span className="text-[9px] font-bold text-[#686868] uppercase tracking-wider block">
                Classification
              </span>
              <div className="flex items-center space-x-2">
                <span
                  className={`font-bold px-2 py-0.5 rounded text-xs ${
                    proposedSimulation.diff.category === 'synonymous'
                      ? 'bg-[#42cf91]/15 text-[#42cf91] border border-[#42cf91]/30'
                      : proposedSimulation.diff.category === 'nonsense'
                      ? 'bg-[#ff626b]/15 text-[#ff626b] border border-[#ff626b]/30'
                      : 'bg-[#f4b942]/15 text-[#f4b942] border border-[#f4b942]/30'
                  }`}
                >
                  {proposedSimulation.diff.categoryLabel}
                </span>
                {proposedSimulation.diff.isTransition && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c1c1c] text-[#36c5e8] border border-[#292929]">
                    Transition
                  </span>
                )}
                {proposedSimulation.diff.isTransversion && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c1c1c] text-[#a78bfa] border border-[#292929]">
                    Transversion
                  </span>
                )}
              </div>
            </div>

            {/* Codon shift */}
            {proposedSimulation.diff.originalCodon && proposedSimulation.diff.mutatedCodon && (
              <div className="p-2.5 rounded bg-[#101010] border border-[#292929] space-y-1 text-xs">
                <span className="text-[9px] text-[#686868] block">Codon Shift (Triplet)</span>
                <div className="flex items-center space-x-2 font-bold">
                  <span className="text-[#36c5e8]">{proposedSimulation.diff.originalCodon}</span>
                  <ArrowRight className="w-3 h-3 text-[#686868]" />
                  <span className="text-[#ff7417]">{proposedSimulation.diff.mutatedCodon}</span>
                </div>
              </div>
            )}

            {/* Amino acid shift */}
            {proposedSimulation.diff.originalAminoAcid && proposedSimulation.diff.mutatedAminoAcid && (
              <div className="p-2.5 rounded bg-[#101010] border border-[#292929] space-y-1 text-xs">
                <span className="text-[9px] text-[#686868] block">Polypeptide Product</span>
                <div className="flex items-center space-x-2 font-semibold">
                  <span className="text-[#f5f5f5]">
                    {proposedSimulation.diff.originalAminoAcid.name} ({proposedSimulation.diff.originalAminoAcid.code3})
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#686868]" />
                  <span className="text-[#f4b942]">
                    {proposedSimulation.diff.mutatedAminoAcid.name} ({proposedSimulation.diff.mutatedAminoAcid.code3})
                  </span>
                </div>
              </div>
            )}

            {/* Biological Interpretation */}
            <div className="p-3 rounded bg-[#101010] border border-[#292929] text-xs text-[#a3a3a3] leading-relaxed">
              <p className="font-semibold text-[#f5f5f5] mb-1 flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#36c5e8]" />
                <span>Computational Evaluation</span>
              </p>
              <p className="text-[11px] text-[#a3a3a3] font-sans">
                {proposedSimulation.diff.description}
              </p>
            </div>

            {/* Scientific disclaimer */}
            <div className="text-[10px] text-[#686868] border-t border-[#292929] pt-2 font-sans">
              Disclaimer: Sequence analysis reflects in-silico standard genetic code translation. Phenotypic neutrality requires wet-lab experimental confirmation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
