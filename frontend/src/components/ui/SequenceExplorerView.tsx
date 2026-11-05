import React, { useState } from 'react';
import {
  SequenceValidationResult,
  GeneticCodeTable,
} from '../../types/dna';
import {
  extractCodons,
  generateComplementaryStrand,
  transcribeToMRNA,
} from '../../services/bioinformatics';
import {
  Binary,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SequenceExplorerViewProps {
  sequence: string;
  validation: SequenceValidationResult;
  mutatedPositions: Set<number>;
  onSelectPosition: (pos: number) => void;
}

export const SequenceExplorerView: React.FC<SequenceExplorerViewProps> = ({
  sequence,
  mutatedPositions,
  onSelectPosition,
}) => {
  const [readingFrame, setReadingFrame] = useState<0 | 1 | 2>(0);
  const [geneticCode, setGeneticCode] = useState<GeneticCodeTable>('standard');

  const complementarySeq = generateComplementaryStrand(sequence);
  const mrnaSeq = transcribeToMRNA(sequence);
  const codons = extractCodons(sequence, readingFrame, mutatedPositions);

  return (
    <div className="h-full flex flex-col bg-[#080808] overflow-y-auto p-6 max-w-6xl mx-auto space-y-5 select-none">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#292929] gap-4">
        <div>
          <h2 className="text-sm font-mono font-bold text-[#f5f5f5] uppercase tracking-wider flex items-center space-x-2">
            <Binary className="w-4 h-4 text-[#ff7417]" />
            <span>DNA & mRNA Sequence Explorer</span>
          </h2>
          <p className="text-[11px] text-[#a3a3a3] mt-0.5">
            Examine transcription, translation across reading frames, and biochemical codon assignments.
          </p>
        </div>

        {/* Frame & Code Table Selectors */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1 bg-[#101010] p-0.5 rounded border border-[#292929]">
            <span className="text-[10px] text-[#686868] px-2 font-medium">Frame:</span>
            {([0, 1, 2] as (0 | 1 | 2)[]).map((f) => (
              <button
                key={f}
                onClick={() => setReadingFrame(f)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  readingFrame === f
                    ? 'bg-[#1c1c1c] text-[#f5f5f5] border border-[#383838]'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
                }`}
              >
                +{f + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#101010] px-2.5 py-1 rounded border border-[#292929] text-[#a3a3a3]">
            <span className="text-[10px] text-[#686868] mr-2">Code:</span>
            <select
              value={geneticCode}
              onChange={(e) => setGeneticCode(e.target.value as GeneticCodeTable)}
              className="bg-transparent text-[#f5f5f5] text-xs focus:outline-none cursor-pointer font-mono"
            >
              <option value="standard" className="bg-[#151515]">Standard (NCBI 1)</option>
              <option value="vertebrate_mitochondrial" className="bg-[#151515]">Vertebrate Mitochondrial (NCBI 2)</option>
              <option value="bacterial_plastid" className="bg-[#151515]">Bacterial & Plastid (NCBI 11)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transcription & Nucleic Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
        {/* Coding Strand Card */}
        <div className="bg-[#151515] border border-[#292929] rounded p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono font-bold text-[#36c5e8] uppercase tracking-wider text-[10px]">
              Coding Strand (Sense, 5' &rarr; 3')
            </span>
            <span className="font-mono text-[#686868] text-[10px]">{sequence.length} bp</span>
          </div>
          <div className="bg-[#080808] p-2 rounded font-mono text-xs text-[#36c5e8] tracking-wider break-all max-h-24 overflow-y-auto border border-[#292929]">
            {sequence}
          </div>
        </div>

        {/* Complementary Strand Card */}
        <div className="bg-[#151515] border border-[#292929] rounded p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono font-bold text-[#a78bfa] uppercase tracking-wider text-[10px]">
              Complementary (Antisense, 3' &larr; 5')
            </span>
            <span className="font-mono text-[#686868] text-[10px]">{complementarySeq.length} bp</span>
          </div>
          <div className="bg-[#080808] p-2 rounded font-mono text-xs text-[#a78bfa] tracking-wider break-all max-h-24 overflow-y-auto border border-[#292929]">
            {complementarySeq}
          </div>
        </div>

        {/* mRNA Transcript Card */}
        <div className="bg-[#151515] border border-[#292929] rounded p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono font-bold text-[#42cf91] uppercase tracking-wider text-[10px]">
              mRNA Transcript (5' &rarr; 3', T&rarr;U)
            </span>
            <span className="font-mono text-[#686868] text-[10px]">{mrnaSeq.length} nt</span>
          </div>
          <div className="bg-[#080808] p-2 rounded font-mono text-xs text-[#42cf91] tracking-wider break-all max-h-24 overflow-y-auto border border-[#292929]">
            {mrnaSeq}
          </div>
        </div>
      </div>

      {/* Codon by Codon Translation Table */}
      <div className="bg-[#151515] border border-[#292929] rounded p-4 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#292929]">
          <h3 className="text-xs font-mono font-bold text-[#f5f5f5] uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-3.5 h-3.5 text-[#ff7417]" />
            <span>Translated Polypeptide Chain (Reading Frame +{readingFrame + 1})</span>
          </h3>
          <span className="text-[11px] text-[#686868] font-mono">
            {codons.length} Complete Codons &bull; {codons.length} Residues
          </span>
        </div>

        {codons.length === 0 ? (
          <p className="text-xs text-[#686868] py-6 text-center font-mono">
            No complete codons available in frame +{readingFrame + 1}.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {codons.map((codon) => {
              const aa = codon.aminoAcid;
              return (
                <div
                  key={`codon_${codon.index}`}
                  onClick={() => onSelectPosition(codon.startPosition)}
                  className={`bg-[#101010] border rounded p-3 space-y-2 cursor-pointer transition-all hover:border-[#383838] ${
                    codon.isMutated
                      ? 'border-[#f4b942]/60 shadow-sm'
                      : 'border-[#292929]'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-[10px] text-[#a3a3a3] font-semibold">
                      Codon #{codon.index}
                    </span>
                    <span className="text-[9px] text-[#686868]">
                      pos {codon.startPosition}-{codon.endPosition}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 font-mono">
                    <span className="font-bold text-[#36c5e8] text-sm tracking-wider bg-[#080808] px-2 py-0.5 rounded border border-[#292929]">
                      {codon.sequence}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#686868]" />
                    <span className="font-semibold text-[#a78bfa] text-xs">
                      {codon.mrnaSequence}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#292929] flex items-center justify-between font-mono">
                    <div>
                      <span className="font-bold text-[#f5f5f5] text-xs block">
                        {aa.name}
                      </span>
                      <span className="text-[10px] text-[#686868]">
                        {aa.code3} / {aa.code1}
                      </span>
                    </div>

                    <div className="text-right">
                      {codon.isStartCodon && (
                        <span className="text-[8px] font-bold bg-[#42cf91]/15 text-[#42cf91] border border-[#42cf91]/30 px-1 py-0.2 rounded block mb-0.5">
                          START
                        </span>
                      )}
                      {codon.isStopCodon && (
                        <span className="text-[8px] font-bold bg-[#ff626b]/15 text-[#ff626b] border border-[#ff626b]/30 px-1 py-0.2 rounded block mb-0.5">
                          STOP
                        </span>
                      )}
                      <span className="text-[9px] capitalize text-[#a3a3a3]">
                        {aa.category}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
