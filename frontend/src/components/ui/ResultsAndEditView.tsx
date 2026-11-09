import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GitCompare,
  Layers,
  RotateCcw,
  Check,
  Clock,
  Edit3,
  CheckCircle2,
  Undo2,
  FileText,
} from 'lucide-react';
import {
  FullAnalysisResult,
  AlignmentMutation,
  SequenceEditRecord,
} from '../../types/dna';
import { BASE_COLORS } from '../../services/bDNAEngine';
import { MolecularSurfaceViewer } from '../3d/MolecularSurfaceViewer';

interface ResultsAndEditViewProps {
  analysisResult: FullAnalysisResult;
  referenceSequence: string;
  originalSubmittedSequence: string;
  currentEditedSequence: string;
  lastAnalysedSequence: string;
  editHistory: SequenceEditRecord[];
  onApplyEdit: (edit: { position: number; oldBases: string; newBases: string; action: string }) => void;
  onUndoLastEdit: () => void;
  onDiscardEdits: () => void;
  onReanalyse: () => Promise<void>;
  isReanalysing: boolean;
  gene: string;
  accession: string;
  organism: string;
  pdbData: string | null;
  onNavigateToReport?: () => void;
}

export const ResultsAndEditView: React.FC<ResultsAndEditViewProps> = ({
  analysisResult,
  referenceSequence,
  currentEditedSequence,
  lastAnalysedSequence,
  editHistory,
  onApplyEdit,
  onUndoLastEdit,
  onDiscardEdits,
  onReanalyse,
  isReanalysing,
  gene,
  accession,
  organism,
  pdbData,
  onNavigateToReport,
}) => {
  // Tab Switch: 'alignment' (default) vs 'structure' (3D Surface)
  const [activeSubTab, setActiveSubTab] = useState<'alignment' | 'structure'>('alignment');

  // Currently Selected Mutation / Coordinate for Editing
  const [selectedMutationIndex, setSelectedMutationIndex] = useState<number | null>(
    analysisResult.alignment.mutations.length > 0 ? 0 : null
  );

  // Editor Input State
  const [editorInputBase, setEditorInputBase] = useState<string>('');
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  const isModified = currentEditedSequence !== lastAnalysedSequence;

  const mutations = analysisResult.alignment.mutations || [];
  const selectedMutation: AlignmentMutation | null =
    selectedMutationIndex !== null && mutations[selectedMutationIndex]
      ? mutations[selectedMutationIndex]
      : null;

  // Selected Mutation base and codon helpers
  const selRefBase = selectedMutation
    ? selectedMutation.reference_bases || selectedMutation.original_base || ''
    : '';
  const selObsBase = selectedMutation
    ? selectedMutation.observed_bases || selectedMutation.observed_base || ''
    : '';
  const selOrigCodon = selectedMutation
    ? selectedMutation.original_codon || selectedMutation.reference_codon || '—'
    : '—';
  const selAaChange = selectedMutation
    ? selectedMutation.amino_acid_change ||
      (selectedMutation.original_amino_acid && selectedMutation.observed_amino_acid
        ? `${selectedMutation.original_amino_acid.code3} → ${selectedMutation.observed_amino_acid.code3}`
        : null)
    : null;

  // Sync editor input whenever selected mutation changes
  useEffect(() => {
    if (selectedMutation) {
      const curBase = selectedMutation.observed_bases || selectedMutation.observed_base || '';
      setEditorInputBase(curBase);
      setEditSuccessMsg(null);
    }
  }, [selectedMutationIndex, selectedMutation]);

  // Context window around selected mutation (e.g. ±10 bases)
  const contextSnippet = useMemo(() => {
    if (!selectedMutation) return null;
    const pos = selectedMutation.reference_position; // 1-based index
    const windowSize = 8;
    const start = Math.max(0, pos - 1 - windowSize);
    const end = Math.min(referenceSequence.length, pos - 1 + windowSize + 1);

    const refBefore = referenceSequence.slice(start, pos - 1);
    const refTarget = referenceSequence.slice(pos - 1, pos);
    const refAfter = referenceSequence.slice(pos, end);

    const obsBefore = currentEditedSequence.slice(start, pos - 1);
    const obsTarget = currentEditedSequence.slice(pos - 1, pos);
    const obsAfter = currentEditedSequence.slice(pos, end);

    return {
      pos,
      refBefore,
      refTarget,
      refAfter,
      obsBefore,
      obsTarget,
      obsAfter,
    };
  }, [selectedMutation, referenceSequence, currentEditedSequence]);

  // Apply User Edit from Editor
  const handleCommitEdit = () => {
    if (!selectedMutation) return;
    const cleanBases = editorInputBase.trim().toUpperCase().replace(/[^ACGTN]/g, '');
    if (!cleanBases) return;

    onApplyEdit({
      position: selectedMutation.reference_position,
      oldBases: selObsBase,
      newBases: cleanBases,
      action: `Edit at pos ${selectedMutation.reference_position}: ${selObsBase} -> ${cleanBases}`,
    });

    setEditSuccessMsg(`Updated position ${selectedMutation.reference_position} to ${cleanBases}. Reanalyse to refresh alignment.`);
    setTimeout(() => setEditSuccessMsg(null), 4000);
  };

  // 1-Click Replace with Reference Base(s)
  const handleUseReferenceBases = () => {
    if (!selectedMutation) return;
    const refBase = selRefBase;
    setEditorInputBase(refBase);

    onApplyEdit({
      position: selectedMutation.reference_position,
      oldBases: selObsBase,
      newBases: refBase,
      action: `Revert to reference at pos ${selectedMutation.reference_position}: ${selObsBase} -> ${refBase}`,
    });

    setEditSuccessMsg(`Reverted position ${selectedMutation.reference_position} to wild-type reference base (${refBase}).`);
    setTimeout(() => setEditSuccessMsg(null), 4000);
  };

  const isStructureMapped = Boolean(analysisResult.structure_mapping?.mapped);
  const mappedResidues = analysisResult.structure_mapping?.mappings || [];
  const selectedMappedResidue = selectedMutation
    ? mappedResidues.find((r) => r.mutation_ref_pos === selectedMutation.reference_position) || null
    : mappedResidues[0] || null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090A0C] text-[#F4F4F2] font-mono select-none overflow-hidden">
      {/* ===================================================================
          1. TOP WORKSPACE TOOLBAR
      =================================================================== */}
      <div className="border-b border-[#2A2D33] px-5 py-2.5 bg-[#111316] flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="font-bold text-[#F4F4F2] uppercase tracking-wider">
              {gene}
            </span>
            <span className="text-[#70757D]">/</span>
            <span className="text-[11px] text-[#A0A3AA]">{accession}</span>
            <span className="text-[10px] text-[#70757D]">({organism})</span>
          </div>

          <span className="text-[#3D424B]">|</span>

          {/* Alignment Stats Chips */}
          <div className="flex items-center space-x-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#FF6500]/15 text-[#FF6500] font-bold border border-[#FF6500]/30">
              {mutations.length} Variant(s)
            </span>
            <span className="px-2 py-0.5 rounded bg-[#17191D] text-[#35C98A] border border-[#2A2D33]">
              {analysisResult.alignment.identity_percent.toFixed(1)}% Identity
            </span>
            <span className="px-2 py-0.5 rounded bg-[#17191D] text-[#A0A3AA] border border-[#2A2D33] hidden sm:inline">
              Score: {analysisResult.alignment.alignment_score.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Dual Tab Mode Switcher: Alignment vs 3D Molecular Surface */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-[#17191D] p-0.5 rounded-md border border-[#2A2D33]">
            <button
              type="button"
              onClick={() => setActiveSubTab('alignment')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                activeSubTab === 'alignment'
                  ? 'bg-[#2A2D33] text-[#F4F4F2] font-bold shadow-sm'
                  : 'text-[#A0A3AA] hover:text-[#F4F4F2]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-[#22C7E8]" />
              <span>Alignment & Editor</span>
            </button>

            <button
              type="button"
              onClick={() => isStructureMapped && setActiveSubTab('structure')}
              disabled={!isStructureMapped}
              title={
                isStructureMapped
                  ? 'Inspect 3D macromolecular crystal surface (3Dmol.js)'
                  : '3D structural coordinates not mapped for this sequence'
              }
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                activeSubTab === 'structure'
                  ? 'bg-[#2A2D33] text-[#F4F4F2] font-bold shadow-sm'
                  : isStructureMapped
                  ? 'text-[#A0A3AA] hover:text-[#F4F4F2]'
                  : 'text-[#70757D] opacity-40 cursor-not-allowed'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#FF6500]" />
              <span>3D Surface</span>
              {isStructureMapped && (
                <span className="text-[9px] bg-[#35C98A]/20 text-[#35C98A] px-1 rounded ml-1">
                  PDB
                </span>
              )}
            </button>
          </div>

          {onNavigateToReport && (
            <button
              type="button"
              onClick={onNavigateToReport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#22C7E8] border border-[#2A2D33] text-xs transition-all cursor-pointer ml-1"
              title="Navigate to 4-Page Scientific PDF Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================
          2. STALE / MODIFIED SEQUENCE PERSISTENT BANNER
      =================================================================== */}
      {isModified && (
        <div className="bg-[#F3B347]/10 border-b border-[#F3B347]/30 px-5 py-2.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F3B347] animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-[#F3B347]">
                Sequence modified ({editHistory.length} edit{editHistory.length === 1 ? '' : 's'} recorded)
              </span>
              <span className="text-[#A0A3AA] ml-2 text-[11px] hidden md:inline">
                Reanalyse to recalculate pairwise alignment, detect remaining variants, and refresh the 4-page report.
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onDiscardEdits}
              className="px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] text-[11px] transition-all cursor-pointer"
              title="Discard all pending uncommitted edits"
            >
              Discard Edits
            </button>
            <button
              type="button"
              onClick={onReanalyse}
              disabled={isReanalysing}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold text-[11px] transition-all cursor-pointer shadow-md shadow-[#FF6500]/20"
              title="Execute backend alignment on the edited sequence"
            >
              {isReanalysing ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reanalysing...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3 h-3" />
                  <span>Reanalyse Edited Sequence</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          3. MAIN VIEWPORT: ALIGNMENT & EDITOR vs 3D MOLECULAR SURFACE
      =================================================================== */}
      {activeSubTab === 'alignment' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          {/* A. VISUAL SEQUENCE ALIGNMENT VIEWER (REF / OBS / DIFF) */}
          <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-[#22C7E8]" />
                <span className="font-bold text-[#F4F4F2] uppercase tracking-wider">
                  Pairwise Sequence Alignment & Difference Map
                </span>
              </div>
              <div className="flex items-center space-x-4 text-[11px] text-[#A0A3AA]">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#35C98A]" />
                  <span>REF (Reference)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#22C7E8]" />
                  <span>OBS (Observed)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded bg-[#FF6500]" />
                  <span>Mismatch (*)</span>
                </div>
              </div>
            </div>

            {/* Scrollable Alignment Ribbon */}
            <div className="bg-[#090A0C] border border-[#2A2D33] rounded-md p-3 overflow-x-auto scrollbar-thin">
              <SequenceAlignmentGrid
                alignedReference={analysisResult.alignment.aligned_reference}
                alignedObserved={analysisResult.alignment.aligned_observed}
                mutations={mutations}
                selectedIndex={selectedMutationIndex}
                onSelectMutation={(idx) => setSelectedMutationIndex(idx)}
              />
            </div>

            {/* Quick Mutation Pills */}
            {mutations.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                <span className="text-[10px] text-[#70757D] mr-1">Detected Variants:</span>
                {mutations.map((m, idx) => {
                  const isSelected = selectedMutationIndex === idx;
                  const rBase = m.reference_bases || m.original_base || '';
                  const oBase = m.observed_bases || m.observed_base || '';
                  const aa =
                    m.amino_acid_change ||
                    (m.original_amino_acid && m.observed_amino_acid
                      ? `${m.original_amino_acid.code3}→${m.observed_amino_acid.code3}`
                      : null);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedMutationIndex(idx)}
                      className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#FF6500] text-white border-[#FF6500] font-bold shadow-sm'
                          : 'bg-[#17191D] text-[#A0A3AA] hover:text-[#F4F4F2] border-[#2A2D33] hover:border-[#3D424B]'
                      }`}
                    >
                      <span>
                        c.{m.reference_position}{rBase}&gt;{oBase}
                      </span>
                      {aa && (
                        <span className="text-[10px] ml-1 opacity-80">
                          ({aa})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* B. COMPACT INTERACTIVE MUTATION EDITOR */}
          {selectedMutation && (
            <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#2A2D33] pb-2 flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-[#FF6500]" />
                  <span className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
                    Interactive Mutation Editor — Position #{selectedMutation.reference_position}
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-[#FF6500]/15 text-[#FF6500] font-bold border border-[#FF6500]/30">
                    {selectedMutation.category_label || 'Variant'}
                  </span>
                </div>

                <div className="text-[11px] text-[#A0A3AA]">
                  Codon: {selOrigCodon} &rarr;{' '}
                  <span className="text-[#FF6500] font-bold">
                    {selectedMutation.observed_codon || '—'}
                  </span>
                  {selAaChange && (
                    <span className="ml-1 text-[#35C98A]">
                      ({selAaChange})
                    </span>
                  )}
                </div>
              </div>

              {/* Context Window View */}
              {contextSnippet && (
                <div className="bg-[#090A0C] rounded p-3 border border-[#2A2D33] text-xs font-mono space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="w-12 text-[#35C98A] font-bold text-[10px]">REF:</span>
                    <span className="text-[#70757D]">{contextSnippet.refBefore}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#35C98A]/20 text-[#35C98A] font-bold border border-[#35C98A]/40">
                      {contextSnippet.refTarget}
                    </span>
                    <span className="text-[#70757D]">{contextSnippet.refAfter}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="w-12 text-[#22C7E8] font-bold text-[10px]">CURRENT:</span>
                    <span className="text-[#70757D]">{contextSnippet.obsBefore}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#FF6500]/20 text-[#FF6500] font-bold border border-[#FF6500]/40">
                      {contextSnippet.obsTarget}
                    </span>
                    <span className="text-[#70757D]">{contextSnippet.obsAfter}</span>
                  </div>
                </div>
              )}

              {/* Edit Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                <div>
                  <label className="text-[10px] text-[#70757D] block mb-1">
                    Edit Base at Position {selectedMutation.reference_position} (A, C, G, T):
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editorInputBase}
                      onChange={(e) => setEditorInputBase(e.target.value.toUpperCase())}
                      maxLength={4}
                      className="bg-[#090A0C] border border-[#2A2D33] rounded px-3 py-1.5 text-sm font-mono font-bold text-[#F4F4F2] w-28 uppercase text-center focus:outline-none focus:border-[#FF6500]"
                    />
                    <button
                      type="button"
                      onClick={handleCommitEdit}
                      className="px-3 py-1.5 rounded bg-[#2A2D33] hover:bg-[#3D424B] text-[#F4F4F2] text-xs font-bold transition-all cursor-pointer border border-[#3D424B]"
                    >
                      Apply Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleUseReferenceBases}
                      className="px-3 py-1.5 rounded bg-[#35C98A]/15 hover:bg-[#35C98A]/25 text-[#35C98A] text-xs font-bold transition-all cursor-pointer border border-[#35C98A]/40 flex items-center space-x-1"
                      title="Instantly restore wild-type reference base"
                    >
                      <Check className="w-3 h-3" />
                      <span>Use Reference ({selRefBase})</span>
                    </button>
                  </div>
                </div>

                <div className="text-right sm:text-right text-[11px] text-[#A0A3AA]">
                  {editSuccessMsg ? (
                    <span className="text-[#35C98A] font-semibold flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {editSuccessMsg}
                    </span>
                  ) : (
                    <span>
                      Modifying this base will mark the sequence as modified. Click 'Reanalyse' above to update the report.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* C. DETECTED VARIANTS SUMMARY TABLE */}
          <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#F4F4F2] uppercase tracking-wider">
                Variant Annotation Table ({mutations.length} Detected)
              </span>
              <span className="text-[11px] text-[#70757D]">
                Click 'Edit' to focus editor on any variant
              </span>
            </div>

            <div className="overflow-x-auto border border-[#2A2D33] rounded-md">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#17191D] text-[#70757D] text-[10px] uppercase font-bold border-b border-[#2A2D33]">
                  <tr>
                    <th className="px-3 py-2">Ref Pos</th>
                    <th className="px-3 py-2">Obs Pos</th>
                    <th className="px-3 py-2">Ref Base</th>
                    <th className="px-3 py-2">Obs Base</th>
                    <th className="px-3 py-2">Variant Type</th>
                    <th className="px-3 py-2">Codon Change</th>
                    <th className="px-3 py-2">Consequence</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D33]">
                  {mutations.length > 0 ? (
                    mutations.map((m, idx) => {
                      const isSelected = selectedMutationIndex === idx;
                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedMutationIndex(idx)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#1D2025] text-[#F4F4F2]'
                              : 'hover:bg-[#14161A] text-[#A0A3AA]'
                          }`}
                        >
                          <td className="px-3 py-2 font-bold text-[#F4F4F2]">
                            #{m.reference_position}
                          </td>
                          <td className="px-3 py-2 text-[#70757D]">
                            #{m.observed_position || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[#35C98A] font-bold">
                            {m.reference_bases || m.original_base}
                          </td>
                          <td className="px-3 py-2 font-mono text-[#FF6500] font-bold">
                            {m.observed_bases || m.observed_base}
                          </td>
                          <td className="px-3 py-2 uppercase text-[10px]">
                            {m.mutation_type || m.type}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {m.original_codon || m.reference_codon || '—'} &rarr; {m.observed_codon || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                m.category === 'missense'
                                  ? 'bg-[#F06464]/15 text-[#F06464] border border-[#F06464]/30'
                                  : m.category === 'synonymous'
                                  ? 'bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30'
                                  : 'bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30'
                              }`}
                            >
                              {m.category_label || m.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMutationIndex(idx);
                              }}
                              className="px-2 py-0.5 rounded bg-[#2A2D33] hover:bg-[#3D424B] text-[#F4F4F2] text-[10px] transition-all cursor-pointer"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-[#70757D]">
                        No sequence differences detected. Observed sequence matches reference perfectly.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* D. SEQUENCE EDIT AUDIT TRAIL (If edits have been made) */}
          {editHistory.length > 0 && (
            <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#A78BFA]" />
                  <span className="font-bold text-[#F4F4F2] uppercase tracking-wider">
                    Sequence Edit Audit Trail ({editHistory.length} Edits)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onUndoLastEdit}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] text-xs transition-all cursor-pointer"
                  title="Revert the most recent sequence edit"
                >
                  <Undo2 className="w-3 h-3 text-[#A78BFA]" />
                  <span>Undo Last Edit</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-[#2A2D33] rounded-md">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#17191D] text-[#70757D] text-[10px] uppercase font-bold border-b border-[#2A2D33]">
                    <tr>
                      <th className="px-3 py-2">Edit #</th>
                      <th className="px-3 py-2">Position</th>
                      <th className="px-3 py-2">Previous Bases</th>
                      <th className="px-3 py-2">Replaced Bases</th>
                      <th className="px-3 py-2">Action / Reason</th>
                      <th className="px-3 py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D33]">
                    {editHistory.map((rec, i) => (
                      <tr key={rec.id || i} className="text-[#A0A3AA]">
                        <td className="px-3 py-2 font-bold text-[#F4F4F2]">#{i + 1}</td>
                        <td className="px-3 py-2">Pos {rec.position}</td>
                        <td className="px-3 py-2 font-mono text-[#F06464]">{rec.oldBases}</td>
                        <td className="px-3 py-2 font-mono text-[#35C98A] font-bold">
                          {rec.newBases}
                        </td>
                        <td className="px-3 py-2">{rec.action}</td>
                        <td className="px-3 py-2 text-[10px] text-[#70757D]">{rec.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================
            3D MOLECULAR SURFACE VIEWPORT (Tab 2)
        =================================================================== */
        <div className="flex-1 min-h-0 relative">
          <MolecularSurfaceViewer
            pdbData={pdbData}
            mappedResidues={mappedResidues}
            selectedResidueNumber={selectedMappedResidue?.residue_number ?? null}
            selectedChain={selectedMappedResidue?.chain ?? 'A'}
            provenance={analysisResult.structure_mapping?.provenance ?? null}
            isMapped={isStructureMapped}
            unmappedReason={analysisResult.structure_mapping?.reason}
            onSelectResidue={(resNum) => {
              const foundIdx = mutations.findIndex(
                (m) =>
                  mappedResidues.find(
                    (r) => r.mutation_ref_pos === m.reference_position && r.residue_number === resNum
                  )
              );
              if (foundIdx >= 0) {
                setSelectedMutationIndex(foundIdx);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Internal Helper: Sequence Alignment Grid Component
// ---------------------------------------------------------------------------
interface SequenceAlignmentGridProps {
  alignedReference: string;
  alignedObserved: string;
  mutations: AlignmentMutation[];
  selectedIndex: number | null;
  onSelectMutation: (index: number) => void;
}

const SequenceAlignmentGrid: React.FC<SequenceAlignmentGridProps> = ({
  alignedReference,
  alignedObserved,
  mutations,
  selectedIndex,
  onSelectMutation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Pre-index mutations by reference position
  const mutMap = useMemo(() => {
    const map = new Map<number, number>();
    mutations.forEach((m, idx) => {
      map.set(m.reference_position, idx);
    });
    return map;
  }, [mutations]);

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedIndex]);

  if (!alignedReference || !alignedObserved) {
    return (
      <div className="text-xs text-[#70757D] py-2">
        Alignment data unavailable.
      </div>
    );
  }

  const length = Math.max(alignedReference.length, alignedObserved.length);
  let refCounter = 0;

  return (
    <div
      ref={containerRef}
      className="flex items-center space-x-0.5 select-none font-mono py-1"
    >
      {/* Row Labels */}
      <div className="flex flex-col justify-between items-center text-[10px] font-bold px-2 py-0.5 shrink-0 h-[72px] border-r border-[#2A2D33] mr-1">
        <span className="text-[#35C98A]">REF</span>
        <span className="text-[#70757D] text-[9px]">POS</span>
        <span className="text-[#22C7E8]">OBS</span>
        <span className="text-[#FF6500] text-[9px]">DIFF</span>
      </div>

      {/* Nucleotide Columns */}
      {Array.from({ length }).map((_, i) => {
        const rBase = alignedReference[i] || '-';
        const oBase = alignedObserved[i] || '-';

        if (rBase !== '-') {
          refCounter += 1;
        }
        const currentPos = refCounter;
        const isMismatch = rBase !== oBase;
        const mutIdx = mutMap.get(currentPos);
        const isSelected = mutIdx !== undefined && mutIdx === selectedIndex;

        const rColor =
          rBase === '-' ? '#70757D' : BASE_COLORS[rBase as 'A' | 'T' | 'G' | 'C'] || '#A0A3AA';
        const oColor =
          oBase === '-' ? '#70757D' : BASE_COLORS[oBase as 'A' | 'T' | 'G' | 'C'] || '#A0A3AA';

        return (
          <div
            key={i}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => {
              if (mutIdx !== undefined) {
                onSelectMutation(mutIdx);
              }
            }}
            className={`flex flex-col justify-between items-center w-6 h-[72px] rounded py-0.5 transition-all text-xs shrink-0 ${
              isMismatch ? 'cursor-pointer hover:bg-[#1D2025]' : ''
            } ${
              isSelected
                ? 'bg-[#FF6500]/25 ring-1 ring-[#FF6500] shadow-sm'
                : isMismatch
                ? 'bg-[#FF6500]/10 border border-[#FF6500]/30'
                : 'hover:bg-[#14161A]'
            }`}
            title={`Position ${currentPos}: ${rBase} -> ${oBase}${isMismatch ? ' (Click to edit)' : ''}`}
          >
            {/* REF Base */}
            <span style={{ color: rColor }} className="font-bold text-[11px]">
              {rBase}
            </span>

            {/* Coordinate Ruler (every 5th or 10th or mismatch) */}
            <span
              className={`text-[8px] ${
                isMismatch
                  ? 'text-[#FF6500] font-bold'
                  : currentPos % 10 === 0
                  ? 'text-[#F4F4F2]'
                  : 'text-[#50545E]'
              }`}
            >
              {currentPos % 10 === 0 || isMismatch ? currentPos : '·'}
            </span>

            {/* OBS Base */}
            <span style={{ color: oColor }} className="font-bold text-[11px]">
              {oBase}
            </span>

            {/* Difference Marker */}
            <span
              className={`text-[10px] font-bold leading-none ${
                isMismatch ? 'text-[#FF6500]' : 'text-transparent'
              }`}
            >
              *
            </span>
          </div>
        );
      })}
    </div>
  );
};
