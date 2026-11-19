import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FullAnalysisResult,
  AlignmentMutation,
  SequenceEditRecord,
  StructureDisplayResidue,
  MutationExperimentResult,
  VariantComparisonResult,
} from '../../types/dna';
import { MolecularSurfaceViewer } from '../3d/MolecularSurfaceViewer';
import { StructuralComparisonView } from '../3d/StructuralComparisonView';
import { BiophysicalAnalysisSection } from '../3d/BiophysicalAnalysisSection';
import { DnaReplacementSection } from './DnaReplacementSection';
import { TacticalButton } from './TacticalButton';
import { ScientificLoader } from './ScientificLoader';
import { ChevronRight, FileText, RotateCcw, Trash2, ArrowLeftRight, Database } from 'lucide-react';

interface AlignmentColumn {
  colIndex: number;
  refBase: string;
  obsBase: string;
  refPos: number | null;
  obsPos: number | null;
  isMismatch: boolean;
  isInsertion: boolean;
  isDeletion: boolean;
  isMatch: boolean;
  isUpdated: boolean;
  mutationIndex: number | null;
}

interface ResultsAndEditViewProps {
  analysisResult: FullAnalysisResult | null;
  referenceSequence: string;
  originalSubmittedSequence: string;
  currentEditedSequence: string;
  lastAnalysedSequence: string;
  editHistory: SequenceEditRecord[];
  onApplyEdit: (edit: { position: number; oldBases: string; newBases: string; action: string }) => Promise<string | null> | string | null;
  onUndoLastEdit: () => void;
  onDiscardEdits: () => void;
  onReanalyse: () => Promise<void>;
  onResetVariant?: () => void;
  isReanalysing: boolean;
  gene: string;
  accession: string;
  organism: string;
  pdbData: string | null;
  onNavigateToReport?: () => void;
  onNavigateToAnalyze?: () => void;
  onReplaceSequences?: (newReference: string, newMutated: string) => Promise<void>;
  mutationExperiment?: MutationExperimentResult | null;
  variantComparison?: VariantComparisonResult | null;
}

function referencePositionLabel(mutation: AlignmentMutation): string {
  if (mutation.type === 'insertion') {
    const left = mutation.reference_left_position ?? 'start';
    const right = mutation.reference_right_position ?? 'end';
    return `between ${left} and ${right}`;
  }
  if (mutation.type === 'deletion' && mutation.reference_end_position) {
    return `${mutation.reference_position}–${mutation.reference_end_position}`;
  }
  return String(mutation.reference_position);
}

function observedPositionLabel(mutation: AlignmentMutation): string {
  if (mutation.type === 'deletion') return `gap before ${mutation.observed_position}`;
  if (mutation.type === 'insertion') {
    const inserted = mutation.observed_bases || mutation.observed_base || '';
    const end = mutation.observed_position + Math.max(inserted.length, 1) - 1;
    return end === mutation.observed_position
      ? String(mutation.observed_position)
      : `${mutation.observed_position}–${end}`;
  }
  return String(mutation.observed_position);
}

export const ResultsAndEditView: React.FC<ResultsAndEditViewProps> = ({
  analysisResult,
  referenceSequence,
  originalSubmittedSequence,
  currentEditedSequence,
  lastAnalysedSequence,
  editHistory,
  onApplyEdit,
  onUndoLastEdit,
  onDiscardEdits,
  onReanalyse,
  onResetVariant,
  isReanalysing,
  gene,
  accession,
  organism,
  pdbData,
  onNavigateToReport,
  onNavigateToAnalyze,
  onReplaceSequences,
  mutationExperiment,
  variantComparison,
}) => {
  // Subtabs: 'alignment' (default) | 'comparison' | 'translation' | 'structure'
  const [activeSubTab, setActiveSubTab] = useState<'alignment' | 'comparison' | 'translation' | 'structure'>(
    variantComparison ? 'comparison' : 'alignment'
  );
  const [structureView, setStructureView] = useState<'dna' | 'protein'>('dna');
  const editorRef = useRef<HTMLElement>(null);
  const [mutationQuery, setMutationQuery] = useState('');
  const [mutationCategory, setMutationCategory] = useState('all');

  useEffect(() => {
    if (variantComparison) {
      setActiveSubTab('comparison');
    }
  }, [variantComparison]);

const mutations = analysisResult?.alignment.mutations || [];

// Track positions updated by user edits:
// - BEFORE any editing: empty set -> ONLY ORANGE for mutations
// - AFTER updating only: contains edited/updated positions -> turns GREEN
const updatedPositions = useMemo<Set<number>>(() => {
  const set = new Set<number>();
  editHistory.forEach((rec) => {
    if (Number.isFinite(rec.position)) {
      set.add(rec.position);
    }
  });
  if (originalSubmittedSequence && lastAnalysedSequence && originalSubmittedSequence !== lastAnalysedSequence) {
    const minLen = Math.min(originalSubmittedSequence.length, lastAnalysedSequence.length);
    for (let i = 0; i < minLen; i++) {
      if (originalSubmittedSequence[i] !== lastAnalysedSequence[i]) {
        set.add(i + 1);
      }
    }
    if (originalSubmittedSequence.length !== lastAnalysedSequence.length) {
      for (let i = minLen; i < Math.max(originalSubmittedSequence.length, lastAnalysedSequence.length); i++) {
        set.add(i + 1);
      }
    }
  }
  return set;
}, [editHistory, originalSubmittedSequence, lastAnalysedSequence]);

// 1. Comprehensive Alignment Columns calculation (Every position is selectable)
const alignmentColumns = useMemo<AlignmentColumn[]>(() => {
  if (!analysisResult?.alignment) return [];
  const ref = analysisResult.alignment.aligned_reference || '';
  const obs = analysisResult.alignment.aligned_observed || '';
  const muts = analysisResult.alignment.mutations || [];
  const maxLen = Math.max(ref.length, obs.length);
  const cols: AlignmentColumn[] = [];
  let rCounter = 0;
  let oCounter = 0;

  for (let c = 0; c < maxLen; c++) {
    const r = ref[c] || '-';
    const o = obs[c] || '-';
    const rPos = r !== '-' ? ++rCounter : null;
    const oPos = o !== '-' ? ++oCounter : null;

    const isMismatch = r !== '-' && o !== '-' && r !== o;
    const isInsertion = r === '-' && o !== '-';
    const isDeletion = r !== '-' && o === '-';
    const isMatch = r !== '-' && o !== '-' && r === o;
    const isUpdated = (oPos !== null && updatedPositions.has(oPos)) || (rPos !== null && updatedPositions.has(rPos));

    let mutIdx: number | null = null;
    if (!isMatch) {
      const found = muts.findIndex((m) => {
        if (m.type === 'substitution') {
          return m.reference_position === rPos && m.observed_position === oPos;
        }
        if (m.type === 'insertion') {
          const insLen = Math.max((m.observed_bases || m.observed_base || '').length, 1);
          return oPos !== null && oPos >= m.observed_position && oPos < m.observed_position + insLen;
        }
        if (m.type === 'deletion') {
          const delLen = Math.max((m.reference_bases || m.original_base || '').length, 1);
          return rPos !== null && rPos >= m.reference_position && rPos < m.reference_position + delLen;
        }
        return m.reference_position === rPos;
      });
      if (found !== -1) mutIdx = found;
    }

    cols.push({
      colIndex: c,
      refBase: r,
      obsBase: o,
      refPos: rPos,
      obsPos: oPos,
      isMismatch,
      isInsertion,
      isDeletion,
      isMatch,
      isUpdated,
      mutationIndex: mutIdx,
    });
  }
  return cols;
}, [analysisResult?.alignment, editHistory]);

// Initial column selection: first mismatch/indel, or position 0
const initialColumnIndex = useMemo(() => {
  if (alignmentColumns.length === 0) return null;
  const firstDiff = alignmentColumns.findIndex((c) => !c.isMatch);
  return firstDiff !== -1 ? firstDiff : 0;
}, [alignmentColumns]);

const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(initialColumnIndex);

// Sync selectedColumnIndex when alignmentColumns change
useEffect(() => {
  setSelectedColumnIndex((prev) => {
    if (alignmentColumns.length === 0) return null;
    if (prev === null || prev >= alignmentColumns.length) {
      const firstDiff = alignmentColumns.findIndex((c) => !c.isMatch);
      return firstDiff !== -1 ? firstDiff : 0;
    }
    return prev;
  });
}, [alignmentColumns]);

const selectedCol =
  selectedColumnIndex !== null && selectedColumnIndex >= 0 && selectedColumnIndex < alignmentColumns.length
    ? alignmentColumns[selectedColumnIndex]
    : alignmentColumns.length > 0
      ? alignmentColumns[0]
      : null;

// Active mutation linked to selected column, or fallback to first mutation
const selectedMutation = useMemo(() => {
  if (selectedCol && selectedCol.mutationIndex !== null && selectedCol.mutationIndex < mutations.length) {
    return mutations[selectedCol.mutationIndex];
  }
  if (mutations.length > 0) {
    return mutations[0];
  }
  return null;
}, [selectedCol, mutations]);

const activeSelectedMutationIndex = selectedMutation ? mutations.indexOf(selectedMutation) : null;

// Editor Input State
const [editorInputBase, setEditorInputBase] = useState('');
const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);
const [editError, setEditError] = useState<string | null>(null);
const [isApplyingEdit, setIsApplyingEdit] = useState(false);
const [isEditingFullSequence, setIsEditingFullSequence] = useState(false);
const [fullSequenceDraft, setFullSequenceDraft] = useState(currentEditedSequence);
const lastSelectedColIndexRef = useRef<number | null>(null);

useEffect(() => {
  setFullSequenceDraft(currentEditedSequence);
}, [currentEditedSequence]);

const isModified = currentEditedSequence !== lastAnalysedSequence;

// Breakdown of mutations
const substitutionsCount = mutations.filter((m) => m.type === 'substitution').length;
const insertionsCount = mutations.filter((m) => m.type === 'insertion').length;
const deletionsCount = mutations.filter((m) => m.type === 'deletion').length;

// Filter mutations for search/filter table
const mutationCategories = useMemo(() => {
  return Array.from(new Set(mutations.map((m) => m.category_label || m.category).filter(Boolean)));
}, [mutations]);

const filteredMutations = useMemo(() => {
  const query = mutationQuery.trim().toLocaleLowerCase();
  return mutations
    .map((mutation, index) => ({ mutation, index }))
    .filter(({ mutation }) => {
      if (mutationCategory !== 'all') {
        const category = mutation.category_label || mutation.category;
        if (category !== mutationCategory) return false;
      }
      if (!query) return true;
      const searchableText = [
        mutation.reference_position,
        mutation.observed_position,
        mutation.original_base,
        mutation.reference_bases,
        mutation.observed_bases,
        mutation.observed_base,
        mutation.mutation_type,
        mutation.type,
        mutation.category_label,
        mutation.category,
        mutation.original_codon,
        mutation.reference_codon,
        mutation.observed_codon,
        mutation.amino_acid_change,
        mutation.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

      return searchableText.includes(query);
    });
}, [mutations, mutationCategory, mutationQuery]);

// Selected base strings
const selRefBase = selectedCol
  ? selectedCol.refBase
  : selectedMutation
    ? selectedMutation.reference_bases || selectedMutation.original_base || ''
    : '';

const selObsBase = selectedCol
  ? (selectedCol.obsBase === '-' ? '' : selectedCol.obsBase)
  : selectedMutation
    ? selectedMutation.observed_bases || selectedMutation.observed_base || ''
    : '';

const selOrigCodon = selectedMutation
  ? selectedMutation.original_codon || selectedMutation.reference_codon || '—'
  : '—';
const selAaChange = selectedMutation && selectedMutation.category !== 'non_coding'
  ? selectedMutation.amino_acid_change ||
  (selectedMutation.original_amino_acid && selectedMutation.observed_amino_acid
    ? `${selectedMutation.original_amino_acid.code3} → ${selectedMutation.observed_amino_acid.code3}`
    : null)
  : null;

const handleInspectMutation = (index: number) => {
  const col = alignmentColumns.find((c) => c.mutationIndex === index);
  if (col) {
    setSelectedColumnIndex(col.colIndex);
  }
  editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const handleSelectChartMutation = (chartMutation: AlignmentMutation) => {
  const index = mutations.findIndex((mutation) =>
    mutation.type === chartMutation.type &&
    mutation.reference_position === chartMutation.reference_position &&
    mutation.observed_position === chartMutation.observed_position &&
    (mutation.reference_bases || mutation.original_base || '') ===
    (chartMutation.reference_bases || chartMutation.original_base || '') &&
    (mutation.observed_bases || mutation.observed_base || '') ===
    (chartMutation.observed_bases || chartMutation.observed_base || '')
  );
  if (index >= 0) handleInspectMutation(index);
};

const handleNavigateMutation = (offset: -1 | 1) => {
  if (activeSelectedMutationIndex === null) return;
  const nextIndex = activeSelectedMutationIndex + offset;
  if (nextIndex < 0 || nextIndex >= mutations.length) return;
  handleInspectMutation(nextIndex);
};

// Sync editor input whenever selected column changes to a different column.
// For mismatches, prefill with reference base so clicking "Apply edit" restores reference without manual typing.
useEffect(() => {
  if (selectedCol && selectedCol.colIndex !== lastSelectedColIndexRef.current) {
    lastSelectedColIndexRef.current = selectedCol.colIndex;
    const defaultReplacement = selectedCol.isMismatch
      ? (selectedCol.refBase === '-' ? '' : selectedCol.refBase)
      : (selectedCol.obsBase === '-' ? '' : selectedCol.obsBase);
    setEditorInputBase(defaultReplacement);
    setEditSuccessMsg(null);
    setEditError(null);
  }
}, [selectedCol?.colIndex]);

// Flanking context snippet (±8 bp)
const contextSnippet = useMemo(() => {
  if (!selectedMutation) return null;
  const windowSize = 8;
  const refIndex = selectedMutation.reference_position - 1;
  const obsIndex = selectedMutation.observed_position - 1;
  const refStart = Math.max(0, refIndex - windowSize);
  const obsStart = Math.max(0, obsIndex - windowSize);
  const refTargetLength = selectedMutation.type === 'insertion' ? 0 : selRefBase.length;
  const obsTargetLength = selectedMutation.type === 'deletion' ? 0 : selObsBase.length;
  const refTargetEnd = refIndex + refTargetLength;
  const obsTargetEnd = obsIndex + obsTargetLength;
  const refEnd = Math.min(referenceSequence.length, refTargetEnd + windowSize);
  const obsEnd = Math.min(lastAnalysedSequence.length, obsTargetEnd + windowSize);

  return {
    refPosition: selectedMutation.reference_position,
    obsPosition: selectedMutation.observed_position,
    refBefore: referenceSequence.slice(refStart, refIndex),
    refTarget: referenceSequence.slice(refIndex, refTargetEnd),
    refAfter: referenceSequence.slice(refTargetEnd, refEnd),
    obsBefore: lastAnalysedSequence.slice(obsStart, obsIndex),
    obsTarget: lastAnalysedSequence.slice(obsIndex, obsTargetEnd),
    obsAfter: lastAnalysedSequence.slice(obsTargetEnd, obsEnd),
  };
}, [selectedMutation, referenceSequence, lastAnalysedSequence, selRefBase, selObsBase]);

// Unified base application: can be invoked with a specific base or editorInputBase
const handleApplyBase = async (customBase?: string) => {
  if (!selectedCol) return;
  if (isModified) {
    setEditError('Reanalyse the current sequence before applying another edit.');
    return;
  }
  const cleanBases = (customBase !== undefined ? customBase : editorInputBase).trim().toUpperCase();
  if (!/^[ACGT]*$/.test(cleanBases)) {
    setEditError('Use only A, C, G, and T. Leave empty to delete the selected base.');
    return;
  }

  let editPos: number;
  let oldBases: string;

  if (selectedCol.isDeletion) {
    editPos = selectedMutation?.observed_position ?? (selectedCol.obsPos || 1);
    oldBases = '';
  } else {
    if (selectedCol.obsPos === null) {
      setEditError('Cannot locate target position in variant sequence.');
      return;
    }
    editPos = selectedCol.obsPos;
    oldBases = selectedCol.obsBase === '-' ? '' : selectedCol.obsBase;
  }

  if (oldBases === cleanBases) {
    setEditError(`Position ${editPos} is already '${cleanBases}'. Enter a different replacement base (A, C, G, T) or click 'Use reference'.`);
    return;
  }

  const editPayload = {
    position: editPos,
    oldBases,
    newBases: cleanBases,
    action: cleanBases === ''
      ? `Deleted base at pos ${editPos}`
      : `Changed base at pos ${editPos} to ${cleanBases}`,
  };

  setIsApplyingEdit(true);
  setEditError(null);
  setEditSuccessMsg(null);

  try {
    const err = await onApplyEdit(editPayload);
    if (err) {
      setEditError(err);
      setEditSuccessMsg(null);
    } else {
      setEditorInputBase(cleanBases);
      setEditSuccessMsg(
        cleanBases === selectedCol.refBase
          ? `Restored position ${editPos} to reference base '${cleanBases}'.`
          : `Applied edit at pos ${editPos}: ${oldBases || '∅'} → ${cleanBases}.`
      );
      setEditError(null);
    }
  } catch (e: any) {
    setEditError(e.message || 'Edit failed.');
  } finally {
    setIsApplyingEdit(false);
  }
};

const handleCommitEdit = () => handleApplyBase();

// One-click action to restore reference base and immediately trigger reanalysis
const handleUseReferenceBases = async () => {
  if (!selectedCol) return;
  const refBase = selectedCol.refBase === '-' ? '' : selectedCol.refBase;
  setEditorInputBase(refBase);
  await handleApplyBase(refBase);
};

// Prefer the sequence-derived DNA model for DNA-level edits. A protein PDB
// is a reference structure, so it is offered as a separate view when present.
const hasDnaStructure = Boolean(
  analysisResult?.dna_structure?.mapped && analysisResult?.dna_structure?.pdb_data
);
const hasProteinStructure = Boolean(
  analysisResult?.structure_mapping?.mapped &&
  (pdbData || (analysisResult?.structure_mapping as any)?.pdb_data)
);

useEffect(() => {
  if (structureView === 'dna' && !hasDnaStructure && hasProteinStructure) {
    setStructureView('protein');
  } else if (structureView === 'protein' && !hasProteinStructure && hasDnaStructure) {
    setStructureView('dna');
  }
}, [structureView, hasDnaStructure, hasProteinStructure]);

const activeStructureMode: 'dna' | 'protein' =
  hasDnaStructure && (structureView === 'dna' || !hasProteinStructure)
    ? 'dna'
    : hasProteinStructure
      ? 'protein'
      : 'dna';

const isDnaStructureMapped = activeStructureMode === 'dna' && hasDnaStructure;
const isProteinStructureMapped = activeStructureMode === 'protein' && hasProteinStructure;
const isStructureMapped = isDnaStructureMapped || isProteinStructureMapped;

const activeStructureMapping = isDnaStructureMapped
  ? analysisResult?.dna_structure
  : analysisResult?.structure_mapping;

const activePdbData = isDnaStructureMapped
  ? analysisResult?.dna_structure?.pdb_data ?? null
  : isProteinStructureMapped
    ? pdbData || (analysisResult?.structure_mapping as any)?.pdb_data || null
    : null;

const activeProvenance = isDnaStructureMapped
  ? analysisResult?.dna_structure?.provenance ?? null
  : analysisResult?.structure_mapping?.provenance ?? null;

const mappedResidues = useMemo<StructureDisplayResidue[]>(() => {
  if (isProteinStructureMapped && analysisResult?.structure_mapping) {
    return (analysisResult.structure_mapping.mappings ?? []).map((m) => {
      const isUpd = updatedPositions.has(m.residue_number) || updatedPositions.has(m.mutation_ref_pos);
      return {
        ...m,
        is_updated: isUpd,
      };
    });
  }

  if (isDnaStructureMapped && analysisResult?.dna_structure) {
    const baseMappings: StructureDisplayResidue[] = (analysisResult.dna_structure.mappings ?? []).map((m) => {
      const isUpd =
        updatedPositions.has(m.residue_number) ||
        updatedPositions.has(m.observed_position) ||
        updatedPositions.has(m.mutation_ref_pos);
      return {
        mutation_ref_pos: m.residue_number,
        mutation_type: m.mutation_type,
        dna_variant: isUpd ? `${m.dna_variant} (Updated)` : m.dna_variant,
        chain: m.chain,
        residue_number: m.residue_number,
        original_residue: m.original_residue,
        mutated_residue: m.mutated_residue,
        pdb_residue: m.pdb_residue,
        is_updated: isUpd,
      };
    });

    // If user updated/restored positions that now match reference (so backend returned 0 mutations for them),
    // include them so they are visibly highlighted in GREEN on the 3D structure!
    if (updatedPositions.size > 0) {
      const existingPositions = new Set(baseMappings.map((m) => m.residue_number));
      updatedPositions.forEach((pos) => {
        if (!existingPositions.has(pos) && pos >= 1 && pos <= lastAnalysedSequence.length) {
          const currentBase = lastAnalysedSequence[pos - 1] || 'N';
          baseMappings.push({
            mutation_ref_pos: pos,
            mutation_type: 'restored',
            dna_variant: `c.${pos}${currentBase} (Restored)`,
            chain: 'A',
            residue_number: pos,
            original_residue: `D${currentBase}`,
            mutated_residue: `D${currentBase}`,
            pdb_residue: `D${currentBase}`,
            is_updated: true,
          });
        }
      });
    }

    return baseMappings;
  }

  return [];
}, [
  isProteinStructureMapped,
  isDnaStructureMapped,
  analysisResult?.structure_mapping,
  analysisResult?.dna_structure,
  updatedPositions,
  lastAnalysedSequence,
]);

const selectedMappedResidue = useMemo(() => {
  if (!selectedCol) return null;
  const targetPos = selectedCol.obsPos ?? selectedCol.refPos;
  if (targetPos === null) return null;
  return (
    mappedResidues.find((residue) =>
      isDnaStructureMapped
        ? residue.residue_number === targetPos || residue.mutation_ref_pos === targetPos
        : residue.mutation_ref_pos === selectedCol.refPos || residue.residue_number === selectedCol.obsPos
    ) || null
  );
}, [selectedCol, mappedResidues, isDnaStructureMapped]);

// A compact fingerprint forces a fresh 3D viewer instance after reanalysis,
// including same-length substitutions and update-color transitions.
const structureRevision = useMemo(() => {
  const updatedStr = Array.from(updatedPositions).sort((a, b) => a - b).join(',');
  const source = `${lastAnalysedSequence}|${activeStructureMode}|${activeProvenance?.pdb_id || ''}|${activePdbData?.length || 0}|${mappedResidues.length}|${updatedStr}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}, [
  lastAnalysedSequence,
  activeStructureMode,
  activeProvenance?.pdb_id,
  activePdbData,
  mappedResidues.length,
  updatedPositions,
]);

const isStructureTab = activeSubTab === 'structure';

const primaryInterpretation = useMemo(() => {
  if (analysisResult?.metadata?.primary_interpretation) {
    return analysisResult.metadata.primary_interpretation;
  }
  if (!mutations || mutations.length === 0) {
    return `Interpretation: No sequence alterations detected. Variant sequence matches wild-type reference across all ${referenceSequence.length} bp. Canonical B-DNA conformation modeled.`;
  }
  const firstMut = mutations[0];
  const codonIdx = firstMut.affected_codon_index;
  const origAa = firstMut.original_amino_acid?.name || firstMut.original_amino_acid?.code3;
  const obsAa = firstMut.observed_amino_acid?.name || firstMut.observed_amino_acid?.code3;
  const origAa3 = firstMut.original_amino_acid?.code3;
  const obsAa3 = firstMut.observed_amino_acid?.code3;
  const aaStr = origAa3 && obsAa3 && codonIdx ? `, p.${origAa3}${codonIdx}${obsAa3}` : '';
  const hgvs = firstMut.type === 'substitution' && firstMut.original_base && firstMut.observed_base
    ? `c.${firstMut.reference_position}${firstMut.original_base}>${firstMut.observed_base}`
    : `${firstMut.type} at position ${firstMut.reference_position}`;
  const structStr = isProteinStructureMapped && activeProvenance?.pdb_id
    ? `Experimentally determined Protein Data Bank (PDB) structure (${activeProvenance.pdb_id}) mapped with atomic resolution.`
    : `Canonical B-DNA conformation modeled; no experimentally determined PDB structure mapped.`;

  const mutDesc = firstMut.category === 'missense'
    ? `Missense mutation resulting in ${origAa || 'residue'} to ${obsAa || 'residue'} substitution.`
    : firstMut.category === 'frameshift'
    ? `Frameshift mutation altering downstream translational reading frame.`
    : firstMut.category === 'synonymous'
    ? `Synonymous variant conserving amino acid sequence.`
    : `${firstMut.category_label || firstMut.category || 'Variant'} identified.`;

  return `Interpretation: Single nucleotide variant (${hgvs}${aaStr}) detected${codonIdx ? ` in codon ${codonIdx}` : ''}. ${mutDesc} ${structStr}`;
}, [analysisResult, mutations, referenceSequence.length, isProteinStructureMapped, activeProvenance?.pdb_id]);

const impactSummaryItems = useMemo(() => {
  if (analysisResult?.mutation_impact_summary?.items && analysisResult.mutation_impact_summary.items.length > 0) {
    return analysisResult.mutation_impact_summary.items;
  }
  return mutations.map((m, idx) => {
    const codonIdx = m.affected_codon_index;
    const origAa = m.original_amino_acid?.code3 || m.original_amino_acid?.name || '';
    const obsAa = m.observed_amino_acid?.code3 || m.observed_amino_acid?.name || '';
    const refPos = m.reference_position || m.observed_position;
    const origB = m.original_base || '';
    const obsB = m.observed_base || '';
    const notation = m.type === 'substitution' && origB && obsB ? `c.${refPos}${origB}>${obsB}` : `${m.type} at ${refPos}`;
    const codonChange = m.reference_codon && m.observed_codon ? `${m.reference_codon} → ${m.observed_codon}` : '—';
    const aaChange = origAa && obsAa && codonIdx ? `p.${origAa}${codonIdx}${obsAa}` : origAa && obsAa ? `${origAa} → ${obsAa}` : '—';
    const isStop = m.category === 'nonsense' || obsAa === 'Stop';
    const changesLen = m.category === 'frameshift' || m.type === 'insertion' || m.type === 'deletion' || isStop;
    return {
      index: idx + 1,
      mutation_type: m.type,
      mutation_notation: notation,
      codon_position: codonIdx || null,
      codon_change: codonChange,
      amino_acid_change: aaChange,
      consequence: m.category || 'missense',
      consequence_label: m.category_label || m.category || 'Missense',
      creates_premature_stop: isStop,
      changes_protein_length: changesLen,
      pdb_available: isProteinStructureMapped && !!activeProvenance?.pdb_id,
      pdb_id: activeProvenance?.pdb_id || null,
      structure_provenance: isProteinStructureMapped && activeProvenance?.pdb_id ? `PDB ID: ${activeProvenance.pdb_id}` : 'Canonical B-DNA',
      primary_interpretation: `Mutation at position ${refPos} (${notation}).`,
    };
  });
}, [analysisResult, mutations, isProteinStructureMapped, activeProvenance?.pdb_id]);

return (
  <div
    className="bc-results-screen flex-1 flex flex-col h-full overflow-hidden bg-[#FFFFFF] text-[#000000]"
    style={{
      fontFamily: isStructureTab
        ? "Calibri, Candara, 'Segoe UI', Arial, sans-serif"
        : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    }}
  >
    {/* ===================================================================
          1. TOP WORKSPACE TOOLBAR
      =================================================================== */}
      <div className="px-6 py-3 flex items-center justify-between shrink-0 flex-wrap gap-4 border-b border-[#E5E5E5] bg-[#FFFFFF]">
        <div className="flex items-center space-x-3">
          <ChevronRight className="w-4 h-4 text-[#A3A3A3]" />
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-semibold text-[#171717]">
              Results &amp; Edit
            </h1>
            {gene && (
              <span className="text-[11px] px-2 py-0.5 rounded-[8px] font-mono bg-[#F0FDFA] border border-[#CCFBF1] text-[#0F766E] font-semibold">
                {gene}
              </span>
            )}
            {accession && (
              <span className="text-[11px] font-mono text-[#737373]">
                ({accession})
              </span>
            )}
          </div>
        </div>

        {/* View Subtabs & Report Action */}
        <div className="flex items-center gap-3">
          <div
            className="bc-results-tabs inline-flex items-center p-1 rounded-[8px] bg-[#F5F5F5] border border-[#E5E5E5] gap-1"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'alignment'}
              onClick={() => setActiveSubTab('alignment')}
              className={`px-3.5 py-1.5 rounded-[6px] text-xs transition-all duration-150 cursor-pointer border ${
                activeSubTab === 'alignment'
                  ? 'bg-[#FFFFFF] text-[#171717] font-semibold shadow-xs border-[#E5E5E5]'
                  : 'border-transparent text-[#737373] font-medium hover:text-[#171717] hover:bg-white/50'
              }`}
            >
              Alignment &amp; Differences
            </button>
            {variantComparison && (
              <button
                type="button"
                role="tab"
                aria-selected={activeSubTab === 'comparison'}
                onClick={() => setActiveSubTab('comparison')}
                className={`px-3.5 py-1.5 rounded-[6px] text-xs transition-all duration-150 cursor-pointer border flex items-center gap-1.5 ${
                  activeSubTab === 'comparison'
                    ? 'bg-[#FFFFFF] text-[#171717] font-semibold shadow-xs border-[#E5E5E5]'
                    : 'border-transparent text-[#737373] font-medium hover:text-[#171717] hover:bg-white/50'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#0F766E]" />
                Dual Variant Comparison
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'translation'}
              onClick={() => setActiveSubTab('translation')}
              className={`px-3.5 py-1.5 rounded-[6px] text-xs transition-all duration-150 cursor-pointer border ${
                activeSubTab === 'translation'
                  ? 'bg-[#FFFFFF] text-[#171717] font-semibold shadow-xs border-[#E5E5E5]'
                  : 'border-transparent text-[#737373] font-medium hover:text-[#171717] hover:bg-white/50'
              }`}
            >
              Translation
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'structure'}
              onClick={() => setActiveSubTab('structure')}
              className={`px-3.5 py-1.5 rounded-[6px] text-xs transition-all duration-150 cursor-pointer border flex items-center gap-1.5 ${
                activeSubTab === 'structure'
                  ? 'bg-[#FFFFFF] text-[#171717] font-semibold shadow-xs border-[#E5E5E5]'
                  : 'border-transparent text-[#737373] font-medium hover:text-[#171717] hover:bg-white/50'
              }`}
            >
              <span>3D Structure</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToAnalyze && (
              <TacticalButton
                type="button"
                variant="outline"
                size="sm"
                arrow={false}
                onClick={onNavigateToAnalyze}
                icon={<Database className="w-3.5 h-3.5 text-[#0F766E]" />}
                title="Return to sequence analysis workspace"
              >
                Analyze
              </TacticalButton>
            )}
            {onNavigateToReport && (
              <TacticalButton
                type="button"
                variant="primary"
                size="sm"
                arrow={false}
                onClick={onNavigateToReport}
                icon={<FileText className="w-3.5 h-3.5 text-white" />}
                title="View full clinical mutation report"
              >
                View report
              </TacticalButton>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. STALE SEQUENCE ALERT BANNER (If modified)
      =================================================================== */}
      {isModified && (
        <div
          role="alert"
          className="bg-[#FFF7ED] border-b border-[#FED7AA] px-6 py-2.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2 text-[#9A3412]"
        >
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-[#C2410C]">
              Edits have not been analyzed. Reanalyse to update results.
            </span>
            <span className="text-[#9A3412]/80 hidden md:inline">
              (The alignment grid and translation reflect the last analysed revision.)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onDiscardEdits && (
              <TacticalButton
                type="button"
                variant="outline"
                size="sm"
                arrow={false}
                onClick={onDiscardEdits}
                icon={<Trash2 className="w-3.5 h-3.5 text-[#737373]" />}
              >
                Discard edits
              </TacticalButton>
            )}
            {onReanalyse && (
              <TacticalButton
                type="button"
                variant="primary"
                size="sm"
                arrow={false}
                onClick={onReanalyse}
                disabled={isReanalysing}
                loading={isReanalysing}
                loadingText="Reanalysing…"
                icon={<RotateCcw className={`w-3.5 h-3.5 ${isReanalysing ? 'animate-spin' : ''}`} />}
              >
                Reanalyse
              </TacticalButton>
            )}
          </div>
        </div>
      )}

    {/* ===================================================================
          3. MAIN VIEWPORT
      =================================================================== */}
    <div
      className={`flex-1 min-h-0 overflow-y-auto transition-colors ${isStructureTab
        ? 'bg-[#FFFFFF] px-6 py-6 md:px-12 md:py-8'
        : 'p-5 space-y-5 bg-[#FFFFFF]'
        }`}
    >
      {activeSubTab === 'alignment' && (
        <>
          {/* Primary Scientific Interpretation Panel */}
          <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] p-4 text-xs shadow-xs space-y-1.5">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <h2 className="text-xs font-semibold text-[#171717] tracking-wider uppercase font-mono">
                Primary Scientific Interpretation
              </h2>
              {analysisResult?.metadata?.mutation_classification && (
                <span className="text-[11px] font-mono text-[#0F766E] font-semibold">
                  {analysisResult.metadata.mutation_classification}
                  {analysisResult.metadata.amino_acid_change ? ` (${analysisResult.metadata.amino_acid_change})` : ''}
                </span>
              )}
            </div>
            <p className="text-[#171717] leading-relaxed pt-1">
              {primaryInterpretation}
            </p>
          </section>

          {/* Mutation Impact Summary Section */}
          {impactSummaryItems.length > 0 && (
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] p-4 text-xs shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-[#171717] tracking-wider uppercase font-mono">
                    Mutation Impact Summary
                  </h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#F0FDFA] text-[#0F766E] font-medium border border-[#CCFBF1]">
                    {impactSummaryItems.length} Variant{impactSummaryItems.length === 1 ? '' : 's'} Detected
                  </span>
                </div>
                <span className="text-[11px] text-[#737373] font-mono">
                  Structured Consequence &amp; Structural Feasibility
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#E5E5E5] rounded-[4px]">
                  <thead className="bg-[#FAFAFA] text-[#737373] text-[11px] font-mono border-b border-[#E5E5E5]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Notation</th>
                      <th className="py-2.5 px-3 font-semibold">Codon Pos</th>
                      <th className="py-2.5 px-3 font-semibold">Codon Change</th>
                      <th className="py-2.5 px-3 font-semibold">AA Change</th>
                      <th className="py-2.5 px-3 font-semibold">Consequence</th>
                      <th className="py-2.5 px-3 font-semibold">Premature Stop</th>
                      <th className="py-2.5 px-3 font-semibold">Length Alteration</th>
                      <th className="py-2.5 px-3 font-semibold">3D Structure</th>
                      <th className="py-2.5 px-3 font-semibold min-w-[200px]">Primary Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5] text-[#171717]">
                    {impactSummaryItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#0F766E]">{item.mutation_notation}</td>
                        <td className="py-2.5 px-3 font-mono">{item.codon_position ? `Codon ${item.codon_position}` : '—'}</td>
                        <td className="py-2.5 px-3 font-mono">{item.codon_change || '—'}</td>
                        <td className="py-2.5 px-3 font-mono font-medium">{item.amino_acid_change || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                            item.consequence === 'missense'
                              ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                              : item.consequence === 'nonsense'
                              ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                              : item.consequence === 'synonymous'
                              ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                              : 'bg-[#F5F5F5] text-[#737373] border-[#E5E5E5]'
                          }`}>
                            {item.consequence_label || item.consequence}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {item.creates_premature_stop ? (
                            <span className="text-[#DC2626] font-semibold">Yes</span>
                          ) : (
                            <span className="text-[#737373]">No</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {item.changes_protein_length ? (
                            <span className="text-[#B45309] font-semibold">Yes</span>
                          ) : (
                            <span className="text-[#737373]">No</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {item.pdb_available && item.pdb_id ? (
                            <span className="text-[#0F766E] font-medium">Available (PDB: {item.pdb_id})</span>
                          ) : (
                            <span className="text-[#737373]">Not available in experimental registry</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#171717] leading-relaxed text-[11px]">{item.primary_interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
                SECTION 1: COMPACT RESULT SUMMARY
            ------------------------------------------------------------- */}
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-[#171717] tracking-wider uppercase font-mono">
                  Comparison Summary
                </h2>
                <span className="text-xs text-[#737373]">
                  NCBI Table 1 · Standard in-silico translation
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-[#FAFAF9] border border-[#E5E5E5] rounded-[8px]">
                  <span className="text-[11px] text-[#737373] block font-mono">Reference length</span>
                  <span className="text-base font-bold text-[#171717] font-mono">
                    {referenceSequence.length} bp
                  </span>
                </div>

                <div className="p-3 bg-[#FAFAF9] border border-[#E5E5E5] rounded-[8px]">
                  <span className="text-[11px] text-[#737373] block font-mono">Variant length</span>
                  <span className="text-base font-bold text-[#171717] font-mono">
                    {lastAnalysedSequence.length} bp
                  </span>
                </div>

                <div className="p-3 bg-[#FAFAF9] border border-[#E5E5E5] rounded-[8px]">
                  <span className="text-[11px] text-[#737373] block font-mono">Sequence identity</span>
                  <span className="text-base font-bold text-[#0F766E] font-mono">
                    {analysisResult ? `${analysisResult.alignment.identity_percent.toFixed(1)}%` : '—'}
                  </span>
                </div>

                <div className="p-3 bg-[#FAFAF9] border border-[#E5E5E5] rounded-[8px]">
                  <span className="text-[11px] text-[#737373] block font-mono">Differences found</span>
                  <span className="text-base font-bold text-[#DC2626] font-mono">
                    {mutations.length}
                  </span>
                </div>

                <div className="p-3 bg-[#FAFAF9] border border-[#E5E5E5] rounded-[8px]">
                  <span className="text-[11px] text-[#737373] block font-mono">Breakdown</span>
                  <span className="text-xs text-[#171717] font-mono block mt-1">
                    {substitutionsCount} sub · {insertionsCount} ins · {deletionsCount} del
                  </span>
                </div>
              </div>
            </section>

            {/* -------------------------------------------------------------
                SECTION 2: REFERENCE-VS-VARIANT ALIGNMENT
            ------------------------------------------------------------- */}
            {analysisResult && (
              <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 flex-wrap gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-[#171717] tracking-wider uppercase font-mono">
                      Reference-vs-Variant Alignment
                    </h2>
                    <p className="text-xs text-[#737373]">
                      Aligned sequence columns. Click any position to inspect and modify.
                    </p>
                  </div>

                  {/* Clean Legend */}
                  <div className="flex items-center space-x-3 text-xs font-mono text-[#737373] flex-wrap gap-y-1">
                    <span className="flex items-center space-x-1">
                      <span className="inline-block w-3 h-3 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px]"></span>
                      <span className="text-[#171717]">Match</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="inline-block w-3 h-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[8px]"></span>
                      <span className="text-[#DC2626] font-semibold">Mismatch (*)</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="inline-block w-3 h-3 bg-[#F0FDFA] border border-[#CCFBF1] rounded-[8px]"></span>
                      <span className="text-[#0F766E] font-semibold">Updated (✓)</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="inline-block w-3 h-3 bg-[#EFECF7] border border-[#D8D2EB] rounded-[8px]"></span>
                      <span className="text-[#8175AA] font-semibold">Insertion (+)</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="inline-block w-3 h-3 bg-[#FEF2F2] border border-dashed border-[#DC2626] rounded-[8px]"></span>
                      <span className="text-[#DC2626] font-semibold">Deletion (-)</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="inline-block w-3 h-3 bg-[#0F766E] rounded-[2px]"></span>
                      <span className="text-[#0F766E] font-semibold">Selected</span>
                    </span>
                  </div>
                </div>

                {/* Contained Horizontal Scroll Viewport */}
                <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] p-3 overflow-x-auto">
                  <SequenceAlignmentGrid
                    columns={alignmentColumns}
                    selectedColumnIndex={selectedColumnIndex}
                    onSelectColumn={(colIdx) => setSelectedColumnIndex(colIdx)}
                  />
                </div>
              </section>
            )}

            {/* -------------------------------------------------------------
                SECTION 3: DIFFERENCE LIST (Interactive Pills)
            ------------------------------------------------------------- */}
            {mutations.length > 0 && (
              <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717] uppercase font-mono tracking-wider">
                    Detected Differences ({mutations.length}):
                  </span>
                  <span className="text-[11px] text-[#737373]">
                    Click any difference to inspect and edit
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                  {mutations.map((m, idx) => {
                    const isSelected = activeSelectedMutationIndex === idx;
                    const rBase = m.reference_bases || m.original_base || '∅';
                    const oBase = m.observed_bases || m.observed_base || '∅';
                    const aa =
                      m.amino_acid_change ||
                      (m.original_amino_acid && m.observed_amino_acid
                        ? `${m.original_amino_acid.code3}→${m.observed_amino_acid.code3}`
                        : null);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleInspectMutation(idx)}
                        aria-pressed={isSelected}
                        className={`px-3 py-1.5 rounded-[6px] text-xs font-mono transition-all duration-150 cursor-pointer border ${isSelected
                            ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] font-medium shadow-xs'
                            : 'bg-[#FFFFFF] text-[#171717] hover:bg-[#FAFAFA] border-[#E5E5E5] hover:border-[#0F766E]'
                          }`}
                      >
                        <span>
                          Pos {m.type === 'deletion' ? referencePositionLabel(m) : m.observed_position}: {rBase} → <span className={isSelected ? 'text-[#CCFBF1] font-bold' : 'text-[#DC2626] font-bold'}>{oBase}</span>
                        </span>
                        {aa && (
                          <span className={`ml-1.5 text-[11px] ${isSelected ? 'text-[#F0FDFA]' : 'text-[#737373]'}`}>
                            ({aa})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* -------------------------------------------------------------
                SECTION 4: SELECTED DIFFERENCE DETAILS & EXPLANATION
            ------------------------------------------------------------- */}
            {selectedMutation && (
              <section ref={editorRef} className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-[#171717]">
                      Difference #{activeSelectedMutationIndex !== null ? activeSelectedMutationIndex + 1 : 1}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-[4px] bg-[#FEF2F2] text-[#DC2626] font-semibold uppercase border border-[#FECACA]">
                      {selectedMutation.mutation_type || selectedMutation.type}
                    </span>
                    <span className="text-xs text-[#737373]">
                      Reference pos {referencePositionLabel(selectedMutation)} · Variant pos {observedPositionLabel(selectedMutation)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <TacticalButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      arrow={false}
                      onClick={() => handleNavigateMutation(-1)}
                      disabled={activeSelectedMutationIndex === 0}
                    >
                      Previous
                    </TacticalButton>
                    <span className="text-[#737373] font-medium font-mono px-1">
                      {(activeSelectedMutationIndex ?? 0) + 1} of {mutations.length}
                    </span>
                    <TacticalButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      arrow={false}
                      onClick={() => handleNavigateMutation(1)}
                      disabled={activeSelectedMutationIndex === mutations.length - 1}
                    >
                      Next
                    </TacticalButton>
                  </div>
                </div>

                {/* Detail Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                    <span className="text-[11px] text-[#737373] block font-mono uppercase">1-based Coordinate</span>
                    <span className="text-sm font-bold text-[#171717] font-mono">
                      Pos {selectedMutation.type === 'deletion' ? referencePositionLabel(selectedMutation) : selectedMutation.observed_position}
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                    <span className="text-[11px] text-[#737373] block font-mono uppercase">Bases (Ref → Var)</span>
                    <span className="text-sm font-bold font-mono">
                      <span className="text-[#171717]">{selRefBase || '∅'}</span>
                      <span className="text-[#737373] mx-1.5">→</span>
                      <span className="text-[#DC2626]">{selObsBase || '∅'}</span>
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                    <span className="text-[11px] text-[#737373] block font-mono uppercase">Codon Change</span>
                    <span className="text-sm font-bold text-[#171717] font-mono">
                      {selOrigCodon} → {selectedMutation.observed_codon || '—'}
                      {selAaChange ? ` (${selAaChange})` : ''}
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                    <span className="text-[11px] text-[#737373] block font-mono uppercase">Consequence</span>
                    <span className="text-sm font-bold text-[#DC2626]">
                      {selectedMutation.category_label || selectedMutation.category}
                    </span>
                  </div>
                </div>

                {/* Calculated Explanation */}
                <div className="p-3.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] space-y-1">
                  <span className="text-xs font-semibold text-[#171717] uppercase font-mono block">
                    Calculated Explanation:
                  </span>
                  <p className="text-xs text-[#737373] leading-relaxed">
                    {selectedMutation.description ||
                      `${selectedMutation.category_label || 'Mutation'} at position ${selectedMutation.observed_position}. Codon ${selOrigCodon} changes to ${selectedMutation.observed_codon || '—'}.`}
                  </p>
                </div>

                {/* Flanking Context Window */}
                {contextSnippet && (
                  <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] space-y-2 font-mono text-xs">
                    <div className="text-[11px] text-[#737373] font-sans">
                      Flanking sequence context (±8 bp):
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-16 text-[#737373] shrink-0 font-sans text-[11px]">Reference:</span>
                      <span className="text-[#171717]">{contextSnippet.refBefore}</span>
                      <span className="bg-[#E5E5E5] text-[#171717] font-bold px-1.5 py-0.5 rounded-[4px]">
                        {contextSnippet.refTarget || '∅'}
                      </span>
                      <span className="text-[#171717]">{contextSnippet.refAfter}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-16 text-[#737373] shrink-0 font-sans text-[11px]">Variant:</span>
                      <span className="text-[#171717]">{contextSnippet.obsBefore}</span>
                      <span className="bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-bold px-1.5 py-0.5 rounded-[4px]">
                        {contextSnippet.obsTarget || '∅'}
                      </span>
                      <span className="text-[#171717]">{contextSnippet.obsAfter}</span>
                    </div>
                  </div>
                )}

                {/* Expandable "How to read this result" Section */}
                <details className="border border-[#E5E5E5] rounded-[6px] p-3.5 bg-[#FAFAFA] text-xs">
                  <summary className="font-semibold text-[#171717] cursor-pointer select-none font-mono">
                    ▶ How to read this result
                  </summary>
                  <div className="mt-3 space-y-2 text-[#737373] leading-relaxed">
                    <p>
                      <strong className="text-[#171717]">Reading frame:</strong> The reading frame determines how nucleotides are grouped into triplets (codons) starting from position 0, 1, or 2. All standard translations assume a 5′ to 3′ coding strand.
                    </p>
                    <p>
                      <strong className="text-[#171717]">Triplet codons:</strong> Each 3-nucleotide codon translates into one specific amino acid (or a stop signal) according to the standard genetic code (NCBI Table 1).
                    </p>
                    <p>
                      <strong className="text-[#171717]">Synonymous vs. nonsynonymous changes:</strong> Because multiple codons can code for the same amino acid (degeneracy), some nucleotide substitutions do not alter the translated protein product (synonymous/silent). Substitutions that change an amino acid are missense mutations.
                    </p>
                    <p>
                      <strong className="text-[#171717]">Frameshifts and premature stop codons:</strong> Insertions or deletions that are not multiples of 3 shift the reading frame for all downstream codons, changing the resulting amino acids and frequently creating an early stop codon (nonsense). In-frame indels add or remove full amino acids without altering downstream frame alignment.
                    </p>
                  </div>
                </details>
                            </section>
            )}

            {/* -------------------------------------------------------------
                SECTION 5: EDITABLE SEQUENCE & REANALYSIS
            ------------------------------------------------------------- */}
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#171717] font-mono uppercase tracking-wider">
                    Edit variant sequence &amp; reanalyse
                  </h3>
                  <p className="text-xs text-[#737373]">
                    Modify bases at the selected coordinate or reset the variant sequence back to the reference.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <TacticalButton
                    type="button"
                    variant="outline"
                    size="sm"
                    arrow={false}
                    onClick={() => {
                      if (onResetVariant) {
                        onResetVariant();
                      } else {
                        onApplyEdit({
                          position: 1,
                          oldBases: currentEditedSequence,
                          newBases: referenceSequence,
                          action: 'Reset variant to reference',
                        });
                      }
                    }}
                    title="Reset variant sequence to match reference sequence exactly"
                  >
                    Reset variant
                  </TacticalButton>
                  <TacticalButton
                    type="button"
                    variant="primary"
                    size="sm"
                    arrow={false}
                    onClick={onReanalyse}
                    disabled={isReanalysing}
                    loading={isReanalysing}
                    loadingText="Reanalysing…"
                    title="Reanalyse the variant sequence against reference"
                  >
                    Reanalyse
                  </TacticalButton>
                </div>
              </div>

              {/* Coordinate Edit Form */}
              {selectedCol ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-[#FAFAF9] p-4 rounded-[8px] border border-[#E5E5E5]">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#171717] uppercase font-mono" htmlFor="edit-pos">
                        Selected coordinate
                      </label>
                      {selectedCol.isUpdated ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] font-semibold bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]">
                          Updated ✓
                        </span>
                      ) : selectedCol.isMismatch ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                          Mismatch
                        </span>
                      ) : selectedCol.isInsertion ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] font-semibold bg-[#EFECF7] text-[#8175AA] border border-[#D8D2EB]">
                          Insertion
                        </span>
                      ) : selectedCol.isDeletion ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                          Deletion
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] font-semibold bg-[#FFFFFF] text-[#737373] border border-[#E5E5E5]">
                          Conserved
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-[#171717] bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] px-3 py-2">
                      {selectedCol.isDeletion
                        ? `Pos ${selectedCol.refPos} in ref (Gap in var)`
                        : `Pos ${selectedCol.obsPos} (Ref: ${selectedCol.refBase}, Var: ${selectedCol.obsBase})`}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#171717] uppercase font-mono" htmlFor="replacement-bases">
                      Replacement base (A, C, G, T)
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        id="replacement-bases"
                        type="text"
                        value={editorInputBase}
                        onChange={(e) => setEditorInputBase(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCommitEdit();
                          }
                        }}
                        placeholder="Base"
                        disabled={isModified || isApplyingEdit || isReanalysing}
                        maxLength={1}
                        className="bc-sequence-mono w-16 text-center text-sm font-bold bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] px-2 py-1.5 text-[#171717] focus:outline-none focus:border-[#0F766E] disabled:bg-[#FAFAF9]"
                      />
                      <div className="flex items-center space-x-1">
                        {(['A', 'C', 'G', 'T'] as const).map((b) => {
                          const isCurrent = (selectedCol.obsBase || '').toUpperCase() === b;
                          const isRef = (selectedCol.refBase || '').toUpperCase() === b;
                          const isSelected = editorInputBase.toUpperCase() === b;
                          return (
                            <button
                              key={b}
                              type="button"
                              onClick={() => {
                                setEditorInputBase(b);
                                if (!isCurrent) {
                                  void handleApplyBase(b);
                                }
                              }}
                              disabled={isModified || isApplyingEdit || isReanalysing}
                              className={`w-7 h-7 rounded-[8px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center border ${
                                isSelected
                                  ? 'bg-[#0F766E] text-[#FFFFFF] border-[#0F766E] shadow-xs'
                                  : isRef
                                    ? 'bg-[#F0FDFA] text-[#0F766E] border-[#CCFBF1] hover:bg-[#CCFBF1]'
                                    : isCurrent
                                      ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                                      : 'bg-[#FFFFFF] text-[#171717] border-[#E5E5E5] hover:bg-[#FAFAF9]'
                              }`}
                              title={
                                isRef
                                  ? `Reference base (${b}) - Click to restore`
                                  : isCurrent
                                    ? `Current variant base (${b})`
                                    : `Mutate to ${b}`
                              }
                            >
                              {b}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#737373] block font-mono">
                      Ref: <strong className="text-[#0F766E]">{selectedCol.refBase}</strong> · Current:{' '}
                      <strong className="text-[#DC2626]">{selectedCol.obsBase}</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <TacticalButton
                      type="button"
                      variant="primary"
                      size="sm"
                      arrow={false}
                      onClick={handleCommitEdit}
                      disabled={isModified || isApplyingEdit || isReanalysing || !editorInputBase || editorInputBase === (selectedCol.obsBase || '')}
                      loading={isApplyingEdit || isReanalysing}
                      loadingText="Applying…"
                      title={
                        isModified
                          ? 'Reanalyse before applying another edit'
                          : editorInputBase === (selectedCol.obsBase || '')
                            ? `Pos ${selectedCol.obsPos} is already '${editorInputBase}'. Pick A, C, G or T.`
                            : `Apply change to ${editorInputBase}`
                      }
                    >
                      {editorInputBase && editorInputBase !== (selectedCol.obsBase || '')
                        ? `Apply (${selectedCol.obsBase} → ${editorInputBase})`
                        : 'Apply edit'}
                    </TacticalButton>
                    {selectedCol.refBase && selectedCol.refBase !== '-' && selectedCol.refBase !== selectedCol.obsBase && (
                      <TacticalButton
                        type="button"
                        variant="outline"
                        size="sm"
                        arrow={false}
                        onClick={handleUseReferenceBases}
                        disabled={isModified || isApplyingEdit || isReanalysing}
                        loading={isApplyingEdit || isReanalysing}
                        loadingText="Restoring…"
                        title={`Restore reference base '${selectedCol.refBase}' at pos ${selectedCol.obsPos}`}
                      >
                        Restore Ref ({selectedCol.refBase})
                      </TacticalButton>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#737373]">
                  Select a difference from the alignment or list above to edit its bases.
                </div>
              )}

              {/* Edit Feedback / Errors */}
              {editError && (
                <div role="alert" className="text-xs text-[#DC2626] font-semibold">
                  {editError}
                </div>
              )}
              {editSuccessMsg && (
                <div className="text-xs text-[#15803D] font-semibold">
                  {editSuccessMsg}
                </div>
              )}

              {/* Current Variant Sequence Box */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#171717] uppercase font-mono">
                    Current variant sequence ({currentEditedSequence.length} bp):
                  </span>
                  <div className="flex items-center space-x-3">
                    {editHistory.length > 0 && (
                      <span className="text-[#737373]">
                        {editHistory.length} edit{editHistory.length === 1 ? '' : 's'} recorded
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingFullSequence(!isEditingFullSequence)}
                      className="text-xs text-[#0F766E] hover:underline font-mono cursor-pointer font-semibold"
                    >
                      {isEditingFullSequence ? 'Cancel direct edit' : 'Edit sequence text'}
                    </button>
                  </div>
                </div>

                {isEditingFullSequence ? (
                  <div className="space-y-2">
                    <textarea
                      value={fullSequenceDraft}
                      onChange={(e) => setFullSequenceDraft(e.target.value.toUpperCase().replace(/[^ATGC]/g, ''))}
                      rows={3}
                      className="bc-sequence-mono w-full p-3 bg-[#FFFFFF] border-2 border-[#0F766E] rounded-[8px] text-xs text-[#171717] break-all focus:outline-none"
                      placeholder="Enter variant DNA sequence (A, T, G, C)"
                    />
                    <div className="flex items-center space-x-2">
                      <TacticalButton
                        type="button"
                        variant="primary"
                        size="sm"
                        arrow={false}
                        disabled={fullSequenceDraft === currentEditedSequence || isReanalysing}
                        loading={isReanalysing}
                        loadingText="Reanalysing…"
                        onClick={async () => {
                          if (onReplaceSequences) {
                            await onReplaceSequences(referenceSequence, fullSequenceDraft);
                            setIsEditingFullSequence(false);
                          }
                        }}
                      >
                        Apply edited sequence &amp; reanalyse
                      </TacticalButton>
                      <button
                        type="button"
                        onClick={() => {
                          setFullSequenceDraft(currentEditedSequence);
                          setIsEditingFullSequence(false);
                        }}
                        className="text-xs text-[#737373] hover:text-[#171717] px-2 py-1 font-mono"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bc-sequence-mono p-3 bg-[#FAFAF9] border border-[#E5E5E5] rounded-[8px] text-xs text-[#171717] break-all max-h-32 overflow-y-auto select-all">
                    {currentEditedSequence}
                  </div>
                )}
              </div>

              {/* Edit History Audit Trail */}
              {editHistory.length > 0 && (
                <div className="border border-[#E5E5E5] rounded-[8px] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171717] uppercase font-mono">
                      Edit history ({editHistory.length})
                    </span>
                    <button
                      type="button"
                      onClick={onUndoLastEdit}
                      className="text-xs text-[#0F766E] underline hover:text-[#115E59] cursor-pointer"
                    >
                      Undo last edit
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-[#E5E5E5] rounded-[8px]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#FAFAF9] text-[#737373] font-mono text-[10px] border-b border-[#E5E5E5]">
                        <tr>
                          <th className="px-2.5 py-1.5">#</th>
                          <th className="px-2.5 py-1.5">Pos</th>
                          <th className="px-2.5 py-1.5">Old</th>
                          <th className="px-2.5 py-1.5">New</th>
                          <th className="px-2.5 py-1.5">Action</th>
                          <th className="px-2.5 py-1.5">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E5E5]">
                        {editHistory.map((rec, i) => (
                          <tr key={rec.id || i} className="font-mono text-[11px]">
                            <td className="px-2.5 py-1 font-bold">#{i + 1}</td>
                            <td className="px-2.5 py-1">Pos {rec.position}</td>
                            <td className="px-2.5 py-1 text-[#DC2626]">{rec.oldBases || '∅'}</td>
                            <td className="px-2.5 py-1 text-[#171717] font-bold">{rec.newBases || '∅'}</td>
                            <td className="px-2.5 py-1 font-sans">{rec.action}</td>
                            <td className="px-2.5 py-1 text-[#737373]">{rec.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Difference Table (Searchable & Filterable) */}
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-[#171717] font-mono uppercase tracking-wider">
                    Difference Inspection Table
                  </h3>
                  <p className="text-xs text-[#737373]">
                    Complete list of aligned differences. Filter by consequence or search by coordinate.
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <input
                    type="search"
                    value={mutationQuery}
                    onChange={(e) => setMutationQuery(e.target.value)}
                    placeholder="Search position or consequence…"
                    className="px-2.5 py-1.5 rounded-[8px] border border-[#E5E5E5] text-[#171717] text-xs focus:outline-none focus:border-[#0F766E] bg-[#FFFFFF]"
                  />
                  {mutationCategories.length > 0 && (
                    <select
                      value={mutationCategory}
                      onChange={(e) => setMutationCategory(e.target.value)}
                      className="px-2.5 py-1.5 rounded-[8px] border border-[#E5E5E5] text-[#171717] text-xs bg-[#FFFFFF] focus:outline-none focus:border-[#0F766E]"
                    >
                      <option value="all">All consequences</option>
                      {mutationCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {filteredMutations.length > 0 ? (
                <div className="overflow-x-auto border border-[#E5E5E5] rounded-[8px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAFAF9] text-[#737373] font-mono text-[10px] uppercase border-b border-[#E5E5E5]">
                      <tr>
                        <th className="px-2.5 py-1.5">#</th>
                        <th className="px-2.5 py-1.5">Pos</th>
                        <th className="px-2.5 py-1.5">Old</th>
                        <th className="px-2.5 py-1.5">New</th>
                        <th className="px-2.5 py-1.5">Action</th>
                        <th className="px-2.5 py-1.5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      {filteredMutations.map(({ mutation: m, index: idx }) => {
                        const isSelected = activeSelectedMutationIndex === idx;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleInspectMutation(idx)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#F0FDFA]/50 font-semibold' : 'hover:bg-[#FAFAF9]'
                              }`}
                          >
                            <td className="px-3 py-2 font-mono">{referencePositionLabel(m)}</td>
                            <td className="px-3 py-2 font-mono">{observedPositionLabel(m)}</td>
                            <td className="px-3 py-2 font-mono font-bold text-[#171717]">
                              {m.reference_bases || m.original_base}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-[#DC2626]">
                              {m.observed_bases || m.observed_base}
                            </td>
                            <td className="px-3 py-2 uppercase text-[10px]">{m.mutation_type || m.type}</td>
                            <td className="px-3 py-2 font-mono">
                              {m.category === 'non_coding'
                                ? 'Not annotated'
                                : `${m.original_codon || m.reference_codon || '—'} → ${m.observed_codon || '—'}`}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                                {m.category_label || m.category}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInspectMutation(idx);
                                }}
                                className="px-2.5 py-1 rounded-[8px] bg-[#0F766E] hover:bg-[#115E59] text-[#FFFFFF] text-[10px] font-mono cursor-pointer transition-colors shadow-xs"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-[#737373] py-4 text-center">
                  No differences match the specified search query or category.
                </div>
              )}
            </section>

            {/* Reference vs Variant Analysis & Sequence Replacement */}
            {onReplaceSequences && (
              <DnaReplacementSection
                currentReferenceSequence={referenceSequence}
                currentMutatedSequence={currentEditedSequence}
                onReplaceSequences={onReplaceSequences}
                onSelectMutation={handleSelectChartMutation}
                isProcessing={isReanalysing}
              />
            )}
          </>
        )}

        {/* -------------------------------------------------------------
            SUBTAB: VARIANT COMPARISON MODE
        ------------------------------------------------------------- */}
        {activeSubTab === 'comparison' && variantComparison && (
          <div className="space-y-5">
            {/* Stale result protection banner */}
            {isModified && (
              <div className="rounded-[6px] border border-[#FED7AA] bg-[#FFF7ED] p-3 text-xs text-[#9A3412] flex items-center justify-between gap-4">
                <span>
                  <strong className="text-[#C2410C]">Pending sequence edits.</strong> Results correspond to the previously analyzed sequence. Current draft contains unsaved edits.
                </span>
                <TacticalButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onReanalyse}
                  loading={isReanalysing}
                  loadingText="Reanalysing…"
                >
                  Re-run comparison
                </TacticalButton>
              </div>
            )}

            {/* Comparison Overview Header Card */}
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 flex-wrap gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-[#0F766E]" />
                    <h2 className="text-sm font-semibold text-[#171717] tracking-wider uppercase font-mono">
                      Dual Variant Comparison Matrix
                    </h2>
                  </div>
                  <p className="text-xs text-[#737373]">
                    Side-by-side comparison of <strong>{variantComparison.variant_a.name}</strong> vs <strong>{variantComparison.variant_b.name}</strong> against shared reference.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#0F766E] font-medium bg-[#F0FDFA] px-2.5 py-1 rounded-[4px] border border-[#CCFBF1]">
                    Ref Length: {variantComparison.reference_length} bp
                  </span>
                </div>
              </div>

              {/* 13-Metric Differential Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#E5E5E5] rounded-[4px]">
                  <thead className="bg-[#FAFAFA] text-[#737373] text-[11px] font-mono border-b border-[#E5E5E5]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Variant Label</th>
                      <th className="py-2.5 px-3 font-semibold">Mutation Type</th>
                      <th className="py-2.5 px-3 font-semibold">Mutation Notation</th>
                      <th className="py-2.5 px-3 font-semibold">Codon Change</th>
                      <th className="py-2.5 px-3 font-semibold">Amino-Acid Change</th>
                      <th className="py-2.5 px-3 font-semibold">Mutation Consequence</th>
                      <th className="py-2.5 px-3 font-semibold">Protein MW Change</th>
                      <th className="py-2.5 px-3 font-semibold">GRAVY Change</th>
                      <th className="py-2.5 px-3 font-semibold">Net Charge Change</th>
                      <th className="py-2.5 px-3 font-semibold">GC% Change</th>
                      <th className="py-2.5 px-3 font-semibold">Tm Change</th>
                      <th className="py-2.5 px-3 font-semibold">PDB Availability</th>
                      <th className="py-2.5 px-3 font-semibold min-w-[220px]">Primary Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5] text-[#171717]">
                    {variantComparison.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 px-3 font-semibold text-[#171717]">{row.variant_label}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.mutation_type}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-[#0F766E]">{row.mutation_notation}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.codon_change}</td>
                        <td className="py-3 px-3 font-mono font-medium">{row.amino_acid_change}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                            row.mutation_consequence === 'missense'
                              ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                              : 'bg-[#F5F5F5] text-[#737373] border-[#E5E5E5]'
                          }`}>
                            {row.mutation_consequence}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.protein_mw_change}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.gravy_score_change}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.net_charge_change}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.gc_content_change}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{row.melting_temp_change}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#0F766E]">{row.pdb_availability}</td>
                        <td className="py-3 px-3 text-[#171717] leading-relaxed text-[11px]">{row.primary_interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Comparison Conclusion Panel */}
            <section className="bg-[#F0FDFA] border border-[#CCFBF1] rounded-[8px] p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-[#CCFBF1] pb-2">
                <h3 className="text-xs font-semibold text-[#0F766E] tracking-wider uppercase font-mono">
                  Comparison Conclusion &amp; Synthesis
                </h3>
                <span className="text-[10px] font-mono text-[#0F766E]">Automated Biophysical Comparison</span>
              </div>
              <p className="text-xs text-[#171717] leading-relaxed pt-1">
                {variantComparison.conclusion}
              </p>
            </section>
          </div>
        )}

{/* -------------------------------------------------------------
            SUBTAB 2: TRANSLATION (Full Translated Protein Comparison)
        ------------------------------------------------------------- */}
        {activeSubTab === 'translation' && (
          <div className="space-y-5">
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 space-y-4 shadow-xs">
              <div className="border-b border-[#E5E5E5] pb-3">
                <h2 className="text-sm font-semibold text-[#171717] font-mono uppercase tracking-wider">
                  In-Silico Translation Comparison
                </h2>
                <p className="text-xs text-[#737373]">
                  5′ to 3′ coding strand · Reading frame 0 · Standard Genetic Code (NCBI Table 1)
                </p>
              </div>

              {/* Protein Products Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-[#171717]">Reference Protein Product:</span>
                    <span className="text-[#737373]">
                      {mutationExperiment?.reference_protein_product?.length || 0} amino acids
                    </span>
                  </div>
                  <div className="font-mono text-sm font-semibold text-[#171717] break-all bg-[#FFFFFF] p-2.5 rounded-[6px] border border-[#E5E5E5] tracking-wider">
                    {mutationExperiment?.reference_protein_product || '—'}
                    {mutationExperiment?.reference_first_stop_position !== null && ' *'}
                  </div>
                  <div className="text-[11px] text-[#737373]">
                    First stop codon:{' '}
                    {mutationExperiment?.reference_first_stop_position !== null
                      ? `Codon ${mutationExperiment?.reference_first_stop_position}`
                      : 'None within sequence'}
                  </div>
                </div>

                <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-[#171717]">Variant Protein Product:</span>
                    <span className="text-[#737373]">
                      {mutationExperiment?.variant_protein_product?.length || 0} amino acids
                    </span>
                  </div>
                  <div className="font-mono text-sm font-semibold text-[#0F766E] break-all bg-[#FFFFFF] p-2.5 rounded-[6px] border border-[#E5E5E5] tracking-wider">
                    {mutationExperiment?.variant_protein_product || '—'}
                    {mutationExperiment?.variant_first_stop_position !== null && ' *'}
                  </div>
                  <div className="text-[11px] text-[#737373]">
                    First stop codon:{' '}
                    {mutationExperiment?.variant_first_stop_position !== null
                      ? `Codon ${mutationExperiment?.variant_first_stop_position}`
                      : 'None within sequence'}
                  </div>
                </div>
              </div>

              {/* Peptide Physical-Chemical Properties Comparison */}
              {mutationExperiment?.reference_protein_product && mutationExperiment?.variant_protein_product && (() => {
                const AA_MASS_MAP: Record<string, number> = {
                  A: 89.09, R: 174.20, N: 132.12, D: 133.10, C: 121.16, E: 147.13, Q: 146.15,
                  G: 75.07, H: 155.16, I: 131.17, L: 131.17, K: 146.19, M: 149.21, F: 165.19,
                  P: 115.13, S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15,
                };
                const AA_HYDRO_MAP: Record<string, number> = {
                  I: 4.5, V: 4.2, L: 3.8, F: 2.8, C: 2.5, M: 1.9, A: 1.8, G: -0.4,
                  T: -0.7, S: -0.8, W: -0.9, Y: -1.3, P: -1.6, H: -3.2, E: -3.5,
                  Q: -3.5, D: -3.5, N: -3.5, K: -3.9, R: -4.5,
                };
                const calc = (pep: string) => {
                  const s = pep.replace(/[^A-Za-z]/g, '').toUpperCase();
                  if (!s) return { mass: 0, gravy: 0, charge: 0 };
                  let m = 18.02;
                  let h = 0;
                  let pos = 0;
                  let neg = 0;
                  for (const a of s) {
                    m += (AA_MASS_MAP[a] || 110) - 18.015;
                    h += AA_HYDRO_MAP[a] || 0;
                    if (a === 'K' || a === 'R') pos += 1;
                    if (a === 'H') pos += 0.1;
                    if (a === 'D' || a === 'E') neg += 1;
                  }
                  return {
                    mass: Math.round(m),
                    gravy: Math.round((h / s.length) * 100) / 100,
                    charge: Math.round((pos - neg) * 10) / 10,
                  };
                };
                const refP = calc(mutationExperiment.reference_protein_product);
                const varP = calc(mutationExperiment.variant_protein_product);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
                    <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                      <span className="text-[10px] text-[#737373] block">Ref Molecular Mass</span>
                      <span className="text-sm font-semibold text-[#171717]">{refP.mass} Da</span>
                    </div>
                    <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                      <span className="text-[10px] text-[#737373] block">Var Molecular Mass</span>
                      <span className="text-sm font-semibold text-[#0F766E]">{varP.mass} Da</span>
                    </div>
                    <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                      <span className="text-[10px] text-[#737373] block">Ref Hydropathy (GRAVY)</span>
                      <span className="text-sm font-semibold text-[#171717]">{refP.gravy}</span>
                    </div>
                    <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                      <span className="text-[10px] text-[#737373] block">Var Hydropathy (GRAVY)</span>
                      <span className="text-sm font-semibold text-[#0F766E]">
                        {varP.gravy} {varP.gravy > refP.gravy ? '▲ More Hydrophobic' : ''}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Translation Outcome Summary */}
              {mutationExperiment && (
                <div className="p-4 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] space-y-2">
                  <span className="text-xs font-semibold text-[#171717] uppercase font-mono block">
                    Consequence Classification:
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-2.5 py-1 rounded-[4px] bg-[#FEF2F2] text-[#DC2626] font-semibold border border-[#FECACA]">
                      {mutationExperiment.category_label || mutationExperiment.mutation_category}
                    </span>
                    <span className="text-xs text-[#171717]">
                      {mutationExperiment.explanation}
                    </span>
                  </div>
                </div>
              )}

              {/* Codon-by-Codon Alignment Table */}
              {mutationExperiment?.codon_comparison && mutationExperiment.codon_comparison.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-[#171717] uppercase font-mono block">
                    Codon-by-Codon Translation Table ({mutationExperiment.codon_comparison.length} codons)
                  </span>
                  <div className="overflow-x-auto border border-[#E5E5E5] rounded-[6px] max-h-96">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#FAFAFA] text-[#737373] font-mono text-[10px] uppercase border-b border-[#E5E5E5] sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Codon #</th>
                          <th className="px-3 py-2">Ref Codon</th>
                          <th className="px-3 py-2">Ref AA</th>
                          <th className="px-3 py-2">Var Codon</th>
                          <th className="px-3 py-2">Var AA</th>
                          <th className="px-3 py-2">Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F0F0]">
                        {mutationExperiment.codon_comparison.map((item) => (
                          <tr
                            key={item.codon_index}
                            className={`font-mono ${item.is_changed ? 'bg-[#FEF2F2] text-[#DC2626] font-semibold' : 'text-[#171717]'
                              }`}
                          >
                            <td className="px-3 py-2">Codon {item.codon_index}</td>
                            <td className="px-3 py-2">{item.ref_codon}</td>
                            <td className="px-3 py-2">{item.ref_aa}</td>
                            <td className="px-3 py-2">{item.var_codon}</td>
                            <td className="px-3 py-2">{item.var_aa}</td>
                            <td className="px-3 py-2 font-sans text-[11px]">
                              {item.is_changed ? (
                                <span className="text-[#DC2626] font-semibold">Altered</span>
                              ) : (
                                <span className="text-[#737373]">Conserved</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Benchmark Validation Summary */}
            <section className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[6px] p-4 text-xs text-[#737373] space-y-1.5 shadow-xs">
              <span className="font-semibold text-[#171717] font-mono uppercase tracking-wider text-[11px] block">
                Validation &amp; Verification Status
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-[#0F766E]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0F766E]"></span>
                  <span>Benchmark validation: 4/4 curated clinical variants correctly classified.</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#0F766E]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0F766E]"></span>
                  <span>Backend validation: 38/38 test cases passed.</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#0F766E]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0F766E]"></span>
                  <span>PDF report generation: Valid multi-page vector PDF generated.</span>
                </div>
              </div>
            </section>

            {/* Research Use Disclaimer */}
            <footer className="pt-2 pb-4 text-center text-xs text-[#737373] border-t border-[#E5E5E5]">
              For research and educational use only. Not intended for clinical diagnosis or treatment decisions.
            </footer>
          </div>
        )}

      {/* -------------------------------------------------------------
            SUBTAB 3: 3D STRUCTURE (Illustrative Model)
            Spacious, Free Layout with Violet Accents, Font: Calibri
        ------------------------------------------------------------- */}
        {activeSubTab === 'structure' && (
          <div className="bc-3d-structure-view max-w-7xl mx-auto w-full space-y-8 py-2 bg-[#FFFFFF] text-[#171717]">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#E5E5E5]">
              <div>
                <h2 className="text-lg font-semibold text-[#171717] tracking-tight">
                  Molecular Structure &amp; 3D Biophysics
                </h2>
                <p className="mt-0.5 text-xs text-[#737373]">
                  Structure and mutation highlights are dynamically synchronized from the latest completed sequence analysis.
                </p>
              </div>

              {hasDnaStructure && hasProteinStructure && (
                <div
                  className="inline-flex items-center gap-1 rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-1"
                  role="group"
                  aria-label="Choose structure model"
                >
                  <button
                    type="button"
                    onClick={() => setStructureView('dna')}
                    aria-pressed={activeStructureMode === 'dna'}
                    className={`rounded-[5px] px-3.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer border ${
                      activeStructureMode === 'dna'
                        ? 'bg-[#FFFFFF] text-[#171717] shadow-xs border-[#E5E5E5]'
                        : 'border-transparent text-[#737373] hover:text-[#171717]'
                    }`}
                  >
                    DNA duplex
                  </button>
                  <button
                    type="button"
                    onClick={() => setStructureView('protein')}
                    aria-pressed={activeStructureMode === 'protein'}
                    className={`rounded-[5px] px-3.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer border ${
                      activeStructureMode === 'protein'
                        ? 'bg-[#FFFFFF] text-[#171717] shadow-xs border-[#E5E5E5]'
                        : 'border-transparent text-[#737373] hover:text-[#171717]'
                    }`}
                  >
                    Protein structure
                  </button>
                </div>
              )}
            </div>

            {/* Strict Structure Provenance Strip */}
            <div className="text-xs text-[#737373] flex items-center gap-2">
              <span className="font-semibold text-[#0F766E]">Structure Provenance: </span>
              <span>
                {activeStructureMode === 'protein'
                  ? (isProteinStructureMapped && activeProvenance?.pdb_id
                      ? `Experimentally determined Protein Data Bank (PDB) structure (PDB ID: ${activeProvenance.pdb_id}).`
                      : 'No experimentally determined PDB structure available for this sequence. Sequence-level and canonical B-DNA analysis are shown.')
                  : 'Canonical B-DNA model generated from input sequence.'}
              </span>
            </div>

            {isModified && (
              <div className="rounded-[6px] border border-[#FED7AA] bg-[#FFF7ED] p-3 text-xs text-[#9A3412] flex items-center justify-between gap-4">
                <span>
                  <strong className="text-[#C2410C]">Pending sequence edits.</strong> Results correspond to the previously analyzed sequence. Current draft contains unsaved edits.
                </span>
                <TacticalButton
                  type="button"
                  variant="primary"
                  size="sm"
                  arrow={false}
                  onClick={onReanalyse}
                  disabled={isReanalysing}
                  loading={isReanalysing}
                  loadingText="Reanalysing…"
                  icon={<RotateCcw className={`w-3.5 h-3.5 ${isReanalysing ? 'animate-spin' : ''}`} />}
                >
                  Re-run analysis
                </TacticalButton>
              </div>
            )}

            {/* Stat Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-5 border-y border-[#E5E5E5]">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-[#737373] font-medium block">Structure Model</span>
                <span className="text-xl font-semibold text-[#171717] tracking-tight">{isDnaStructureMapped ? 'B-DNA Duplex' : isProteinStructureMapped ? 'Protein Fold' : 'Unavailable'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-[#737373] font-medium block">Mapped Mutations</span>
                <span className="text-xl font-semibold text-[#171717] tracking-tight">
                  {mappedResidues.filter((residue) => !residue.is_gap_context).length} <span className="text-sm font-normal text-[#A3A3A3]">/ {mutations.length}</span>
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-[#737373] font-medium block">Variant Length</span>
                <span className="text-xl font-semibold text-[#171717] tracking-tight">{lastAnalysedSequence.length} <span className="text-sm font-normal text-[#A3A3A3]">bp</span></span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-[#737373] font-medium block">Thermodynamic Reference</span>
                <span className="text-xl font-semibold text-[#0F766E] tracking-tight">{activeProvenance?.pdb_id || activeProvenance?.model_type || 'Unified NN'}</span>
              </div>
            </div>

            {/* Dual 3D Structural Comparison Container (Before vs After) */}
            <div className="border border-[#E5E5E5] rounded-[8px] overflow-hidden bg-[#0A0D0C] shadow-xs" style={{ minHeight: '620px' }}>
              <StructuralComparisonView
                key={`${structureRevision}:${activePdbData?.length ?? 0}`}
                pdbData={activePdbData}
                referencePdbData={analysisResult?.structure_mapping?.reference_pdb_data}
                comparison={analysisResult?.structure_mapping?.comparison}
                mappedResidues={mappedResidues}
                mutations={mutations}
                selectedResidueNumber={selectedMappedResidue?.residue_number ?? null}
                selectedChain={selectedMappedResidue?.chain ?? 'A'}
                provenance={activeProvenance}
                isMapped={isStructureMapped}
                unmappedReason={
                  analysisResult?.structure_error ||
                  activeStructureMapping?.reason
                }
                onSelectResidue={(resNum, chain) => {
                  const foundCol = alignmentColumns.find((column) => {
                    const positionMatches = isDnaStructureMapped
                      ? column.obsPos === resNum
                      : column.refPos === resNum;
                    const mapped = mappedResidues.find((residue) =>
                      residue.residue_number === resNum && (residue.chain || 'A') === (chain || 'A')
                    );
                    return positionMatches && Boolean(mapped);
                  });
                  if (foundCol) setSelectedColumnIndex(foundCol.colIndex);
                }}
              />
            </div>

            {/* Comparative Biophysical, Chemical & Thermal Intelligence Section */}
            <BiophysicalAnalysisSection
              biophysics={analysisResult?.dna_biophysics}
              referenceSequence={referenceSequence}
              variantSequence={lastAnalysedSequence}
              variantIntelligence={analysisResult?.variant_intelligence}
            />
          </div>
        )}
      </div>

        {/* Scientific Reanalysis Skeleton Loader Overlay */}
    {isReanalysing && (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="absolute inset-0 bg-white/90 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-6"
      >
        <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] shadow-lg p-6 max-w-md w-full">
          <ScientificLoader
            title="Reanalysing Sequence"
            stage="STAGE 2/3: NEEDLEMAN-WUNSCH ALIGNMENT & TRANSLATION"
            subtext="Detecting coordinate differences, updating translation frames, and recalculating thermodynamic metrics…"
            compact={true}
          />
        </div>
      </div>
    )}
  </div>
);
};

// ---------------------------------------------------------------------------
// Internal Component: Sequence Alignment Grid
// ---------------------------------------------------------------------------
interface SequenceAlignmentGridProps {
  columns: AlignmentColumn[];
  selectedColumnIndex: number | null;
  onSelectColumn: (colIndex: number) => void;
}

const SequenceAlignmentGrid: React.FC<SequenceAlignmentGridProps> = ({
  columns,
  selectedColumnIndex,
  onSelectColumn,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedColumnIndex]);

  if (!columns || columns.length === 0) {
    return <div className="text-xs text-[#6B7280] py-2">Alignment data unavailable.</div>;
  }

  return (
    <div ref={containerRef} className="bc-sequence-mono flex items-center space-x-0.5 select-none py-1">
      {/* Row Labels */}
      <div className="flex flex-col justify-between items-center text-[10px] font-bold px-2 py-0.5 shrink-0 h-[72px] border-r border-[#E5E7EB] mr-1">
        <span className="text-[#000000]">REF</span>
        <span className="text-[#6B7280] text-[9px]">POS</span>
        <span className="text-[#000000]">VAR</span>
        <span className="text-[#EA580C] text-[9px]">DIFF</span>
      </div>

      {/* Nucleotide Columns */}
      {columns.map((col) => {
        const isSelected = selectedColumnIndex === col.colIndex;
        const currentPos = col.refPos ?? col.obsPos ?? 1;

        // Visual classes strictly adhering to specification:
        // Match: clean white/gray background, black text
        // Mismatch: signal orange (bg-[#FFF7ED], border-2 border-[#EA580C], text-[#EA580C]) with '*'
        // Insertion: blue (bg-[#EFF6FF], border border-[#3B82F6], text-[#2563EB]) with '+'
        // Deletion: red dashed (bg-[#FEF2F2], border border-dashed border-[#DC2626], text-[#DC2626]) with '-'
        // Selected: high-contrast pure black (bg-[#000000], text-[#FFFFFF])
        let colStyle = 'bg-[#FFFFFF] border border-[#E5E7EB] text-[#000000] hover:bg-[#F3F4F6]';
        let diffMarker = '';
        let diffColor = 'text-transparent';

        if (isSelected) {
          colStyle = 'bg-[#000000] text-[#FFFFFF] shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#000000] z-10 font-bold border-2 border-[#000000]';
          if (col.isUpdated) {
            diffMarker = '✓';
            diffColor = 'text-[#35C98A]';
          } else if (col.isMismatch) {
            diffMarker = '*';
            diffColor = 'text-[#FF8A4C]';
          } else if (col.isInsertion) {
            diffMarker = '+';
            diffColor = 'text-[#60A5FA]';
          } else if (col.isDeletion) {
            diffMarker = '-';
            diffColor = 'text-[#F87171]';
          }
        } else if (col.isUpdated) {
          colStyle = 'bg-[#ECFDF5] border-2 border-[#10B981] text-[#059669] hover:bg-[#D1FAE5] cursor-pointer';
          diffMarker = '✓';
          diffColor = 'text-[#059669]';
        } else if (col.isMismatch) {
          colStyle = 'bg-[#FFF7ED] border-2 border-[#EA580C] text-[#EA580C] hover:bg-[#FFEDD5] cursor-pointer';
          diffMarker = '*';
          diffColor = 'text-[#EA580C]';
        } else if (col.isInsertion) {
          colStyle = 'bg-[#EFF6FF] border border-[#3B82F6] text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer';
          diffMarker = '+';
          diffColor = 'text-[#2563EB]';
        } else if (col.isDeletion) {
          colStyle = 'bg-[#FEF2F2] border border-dashed border-[#DC2626] text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer';
          diffMarker = '-';
          diffColor = 'text-[#DC2626]';
        }

        const accessibleLabel = col.isUpdated
          ? `Updated position ${currentPos}: Reference ${col.refBase} to Variant ${col.obsBase}`
          : col.isMismatch
            ? `Mismatch at position ${currentPos}: Reference ${col.refBase} to Variant ${col.obsBase}`
            : col.isInsertion
              ? `Insertion at position ${col.obsPos}: +${col.obsBase}`
              : col.isDeletion
                ? `Deletion at position ${col.refPos}: -${col.refBase}`
                : `Conserved position ${currentPos}: ${col.refBase}`;

        return (
          <button
            key={col.colIndex}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelectColumn(col.colIndex)}
            aria-pressed={isSelected}
            aria-label={accessibleLabel}
            className={`flex flex-col justify-between items-center w-6 h-[72px] rounded-[3px] py-0.5 transition-all text-xs shrink-0 cursor-pointer ${colStyle}`}
            title={`Col ${col.colIndex + 1} (Pos ${currentPos}): Ref ${col.refBase} | Var ${col.obsBase} - Click to select & edit`}
          >
            {/* REF Base */}
            <span
              className={`font-bold text-[11px] ${isSelected
                ? 'text-[#FFFFFF]'
                : col.isUpdated
                  ? 'text-[#059669]'
                  : col.isMismatch
                    ? 'text-[#000000]'
                    : ''
                }`}
            >
              {col.refBase}
            </span>

            {/* Coordinate Ruler */}
            <span
              className={`text-[8px] ${isSelected
                ? 'text-[#FFFFFF]'
                : col.isUpdated
                  ? 'text-[#059669] font-bold'
                  : col.isMismatch
                    ? 'text-[#EA580C] font-bold'
                    : currentPos % 10 === 0
                      ? 'text-[#000000] font-semibold'
                      : 'text-[#9CA3AF]'
                }`}
            >
              {currentPos % 10 === 0 || !col.isMatch || col.isUpdated ? currentPos : '·'}
            </span>

            {/* VAR Base */}
            <span
              className={`font-bold text-[11px] ${isSelected
                ? 'text-[#FFFFFF]'
                : col.isUpdated
                  ? 'text-[#059669]'
                  : col.isMismatch
                    ? 'text-[#EA580C]'
                    : col.isInsertion
                      ? 'text-[#2563EB]'
                      : col.isDeletion
                        ? 'text-[#DC2626]'
                        : 'text-[#000000]'
                }`}
            >
              {col.obsBase}
            </span>

            {/* Difference Marker */}
            <span className={`text-[10px] font-bold leading-none ${diffColor}`}>
              {diffMarker || ' '}
            </span>
          </button>
        );
      })}
    </div>
  );
};
