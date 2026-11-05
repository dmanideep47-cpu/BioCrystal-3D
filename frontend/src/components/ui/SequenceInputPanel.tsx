import React, { useState } from 'react';
import {
  SequenceValidationResult,
  ReferenceSequence,
} from '../../types/dna';
import {
  REFERENCE_SEQUENCES,
  validateDNASequence,
} from '../../services/bioinformatics';
import {
  CheckCircle2,
  AlertCircle,
  Dna,
  Database,
  ArrowRight,
  Trash2,
  FileCode,
} from 'lucide-react';

interface SequenceInputPanelProps {
  currentSequence: string;
  onUpdateSequence: (newSeq: string) => void;
  validation: SequenceValidationResult;
  onSelectReference: (ref: ReferenceSequence) => void;
}

export const SequenceInputPanel: React.FC<SequenceInputPanelProps> = ({
  currentSequence,
  onUpdateSequence,
  onSelectReference,
}) => {
  const [inputText, setInputText] = useState(currentSequence);
  const [activeTab, setActiveTab] = useState<'input' | 'references'>('input');

  const currentVal = validateDNASequence(inputText);

  const handleApply = () => {
    if (currentVal.isValid) {
      onUpdateSequence(currentVal.cleanedSequence);
    }
  };

  const handlePasteDemo = () => {
    const demo = REFERENCE_SEQUENCES[0];
    setInputText(demo.sequence);
    onSelectReference(demo);
  };

  return (
    <div className="h-full flex flex-col bg-[#080808] overflow-y-auto p-6 max-w-5xl mx-auto space-y-5 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#292929] gap-4">
        <div>
          <h2 className="text-sm font-mono font-bold text-[#f5f5f5] uppercase tracking-wider flex items-center space-x-2">
            <Dna className="w-4 h-4 text-[#ff7417]" />
            <span>DNA Sequence Input & Reference Explorer</span>
          </h2>
          <p className="text-[11px] text-[#a3a3a3] mt-0.5">
            Input arbitrary FASTA / raw DNA sequences or load validated reference sequences from biological databases.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-[#101010] p-0.5 rounded border border-[#292929] text-xs font-mono">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-3 py-1 rounded transition-all cursor-pointer font-medium ${
              activeTab === 'input'
                ? 'bg-[#1c1c1c] text-[#f5f5f5] border border-[#383838]'
                : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
            }`}
          >
            Sequence Editor
          </button>
          <button
            onClick={() => setActiveTab('references')}
            className={`px-3 py-1 rounded transition-all cursor-pointer font-medium ${
              activeTab === 'references'
                ? 'bg-[#1c1c1c] text-[#f5f5f5] border border-[#383838]'
                : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
            }`}
          >
            Databases ({REFERENCE_SEQUENCES.length})
          </button>
        </div>
      </div>

      {activeTab === 'input' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Input Box (2 cols) */}
          <div className="lg:col-span-2 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-[#a3a3a3] flex items-center space-x-2">
                <FileCode className="w-3.5 h-3.5 text-[#36c5e8]" />
                <span>Raw DNA or FASTA Format</span>
              </label>

              <div className="flex items-center space-x-2 font-mono">
                <button
                  onClick={handlePasteDemo}
                  className="text-xs text-[#a3a3a3] hover:text-[#f5f5f5] bg-[#151515] hover:bg-[#1c1c1c] px-2 py-0.5 rounded border border-[#292929] transition-all cursor-pointer"
                >
                  Load 15bp Preset
                </button>
                <button
                  onClick={() => setInputText('')}
                  className="p-1 text-[#686868] hover:text-[#ff626b] transition-colors cursor-pointer"
                  title="Clear text"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={8}
                placeholder=">Demo_B_DNA_15bp&#10;ATGGCTACTGGTTAA"
                className="w-full bg-[#151515] border border-[#292929] focus:border-[#ff7417] rounded p-3 text-xs font-mono text-[#f5f5f5] placeholder-[#686868] focus:outline-none transition-all resize-none"
              />
              {currentVal.fastaHeader && (
                <div className="mt-1.5 text-[11px] text-[#36c5e8] bg-[#101010] px-2.5 py-1 rounded border border-[#292929] font-mono">
                  FASTA Header: &gt;{currentVal.fastaHeader}
                </div>
              )}
            </div>

            {/* Validation Callouts */}
            {currentVal.errors.length > 0 && (
              <div className="bg-[#ff626b]/10 border border-[#ff626b]/30 rounded p-3 text-xs text-[#ff626b] space-y-1 font-mono">
                <div className="flex items-center space-x-2 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Sequence Validation Failed</span>
                </div>
                {currentVal.errors.map((err, i) => (
                  <p key={i} className="pl-5 text-[11px]">
                    &bull; {err}
                  </p>
                ))}
              </div>
            )}

            {currentVal.warnings.length > 0 && currentVal.isValid && (
              <div className="bg-[#f4b942]/10 border border-[#f4b942]/30 rounded p-3 text-xs text-[#f4b942] space-y-1 font-mono">
                <div className="flex items-center space-x-2 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Validation Notice</span>
                </div>
                {currentVal.warnings.map((warn, i) => (
                  <p key={i} className="pl-5 text-[11px]">
                    &bull; {warn}
                  </p>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-1">
              <button
                onClick={handleApply}
                disabled={!currentVal.isValid || currentVal.cleanedSequence === currentSequence}
                className={`flex-1 py-2.5 px-4 rounded font-mono font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                  currentVal.isValid && currentVal.cleanedSequence !== currentSequence
                    ? 'bg-[#f5f5f5] hover:bg-white text-[#080808] cursor-pointer shadow-sm'
                    : 'bg-[#151515] text-[#686868] border border-[#292929] cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {currentVal.cleanedSequence === currentSequence
                    ? 'Sequence Synchronized with 3D Simulation'
                    : 'Update 3D Simulation Helix'}
                </span>
              </button>
            </div>
          </div>

          {/* Metrics Sidebar (1 col) */}
          <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-4">
            <h3 className="text-xs font-mono font-bold text-[#f5f5f5] uppercase tracking-wider pb-2 border-b border-[#292929]">
              Sequence Metrics
            </h3>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
                <span className="text-[#686868] block text-[10px]">Total Length</span>
                <span className="text-base font-bold text-[#36c5e8]">{currentVal.length} bp</span>
              </div>
              <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
                <span className="text-[#686868] block text-[10px]">Codon Trios</span>
                <span className="text-base font-bold text-[#a78bfa]">{currentVal.codonCount}</span>
              </div>
              <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
                <span className="text-[#686868] block text-[10px]">GC Content</span>
                <span className="text-base font-bold text-[#42cf91]">{currentVal.gcPercent}%</span>
              </div>
              <div className="bg-[#101010] p-2.5 rounded border border-[#292929]">
                <span className="text-[#686868] block text-[10px]">AT Content</span>
                <span className="text-base font-bold text-[#ff7417]">{currentVal.atPercent}%</span>
              </div>
            </div>

            {/* Biophysical Estimates */}
            <div className="space-y-1.5 text-xs pt-2 border-t border-[#292929] font-mono">
              <div className="flex justify-between text-[#a3a3a3]">
                <span className="text-[#686868]">Melting Temp (Tm):</span>
                <span className="text-[#f5f5f5]">{currentVal.meltingTemperature} °C</span>
              </div>
              <div className="flex justify-between text-[#a3a3a3]">
                <span className="text-[#686868]">Est. MW (ssDNA):</span>
                <span className="text-[#f5f5f5]">{currentVal.molecularWeightKDa} kDa</span>
              </div>
              <div className="flex justify-between text-[#a3a3a3]">
                <span className="text-[#686868]">Reading Frame:</span>
                <span className="text-[#f5f5f5]">
                  {currentVal.isCompleteCodingSequence ? 'Complete' : 'Truncated'}
                </span>
              </div>
            </div>

            {/* Scientific Rule Note */}
            <div className="text-[10px] text-[#686868] bg-[#101010] p-2.5 rounded border border-[#292929] font-mono">
              <p className="font-semibold text-[#a3a3a3] mb-1">Base Pairing Constraints:</p>
              <ul className="space-y-0.5">
                <li>&bull; Adenine (A) pairs with Thymine (T) [2 H-bonds]</li>
                <li>&bull; Guanine (G) pairs with Cytosine (C) [3 H-bonds]</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Preset References Tab */}
      {activeTab === 'references' && (
        <div className="space-y-3">
          <p className="text-xs text-[#a3a3a3] font-mono">
            Canonical reference sequences curated from NCBI GenBank, Ensembl, and PDB. Click to load into active workspace.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REFERENCE_SEQUENCES.map((ref) => (
              <div
                key={ref.id}
                onClick={() => {
                  setInputText(ref.sequence);
                  onSelectReference(ref);
                }}
                className="bg-[#151515] border border-[#292929] hover:border-[#383838] p-3.5 rounded space-y-2 cursor-pointer transition-all font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#f5f5f5] text-xs flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-[#ff7417]" />
                    <span>{ref.name}</span>
                  </span>
                  <span className="text-[10px] text-[#686868] bg-[#101010] px-1.5 py-0.5 rounded border border-[#292929]">
                    {ref.accessionNumber}
                  </span>
                </div>
                <p className="text-[11px] text-[#a3a3a3] line-clamp-2 leading-relaxed">
                  {ref.description}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[#686868] pt-1 border-t border-[#292929]">
                  <span>{ref.sequence.length} bp &bull; {ref.organism}</span>
                  <span className="text-[#36c5e8] flex items-center space-x-1 hover:underline">
                    <span>Load</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
