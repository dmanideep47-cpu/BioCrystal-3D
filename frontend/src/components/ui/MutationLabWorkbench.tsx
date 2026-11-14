import React, { useState, useMemo } from 'react';
import {
  MutationExperimentResult,
  StudentPrediction,
} from '../../types/dna';
import { TacticalButton } from './TacticalButton';

const PREDICTION_LABELS: Record<string, string> = {
  no_change: 'No amino-acid change',
  one_aa_change: 'One amino acid is replaced',
  early_stop: 'Translation stops earlier',
  frameshift: 'The downstream reading frame changes',
  inframe_indel: 'Amino acids are added or removed without shifting the downstream frame',
  not_sure: 'Not sure',
};

interface MutationLabWorkbenchProps {
  mutationExperiment: MutationExperimentResult | null;
  currentPrediction?: StudentPrediction | null;
  referenceSequence: string;
  currentEditedSequence: string;
  lastAnalysedSequence: string;
  isReanalysing: boolean;
  onApplyEdit: (edit: { position: number; oldBases: string; newBases: string; action: string }) => string | null;
  onReanalyse: () => Promise<void>;
  onDiscardEdits: () => void;
  onSaveExperiment?: (reflectionText?: string) => boolean;
  onNavigateToNotebook?: () => void;
  onResetToReference?: () => void;
}

export const MutationLabWorkbench: React.FC<MutationLabWorkbenchProps> = ({
  mutationExperiment,
  currentPrediction,
  referenceSequence,
  currentEditedSequence,
  lastAnalysedSequence,
  isReanalysing,
  onApplyEdit,
  onReanalyse,
  onDiscardEdits,
  onSaveExperiment,
  onNavigateToNotebook,
  onResetToReference,
}) => {
  // Reflection state
  const [reflectionInput, setReflectionInput] = useState<string>('');
  const [showModelAnswer, setShowModelAnswer] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Stage C: Mutation Editor Controls
  const [mutType, setMutType] = useState<'substitution' | 'insertion' | 'deletion'>('substitution');
  const [editPos, setEditPos] = useState<number>(1);
  const [newBases, setNewBases] = useState<string>('A');
  const [delLength, setDelLength] = useState<number>(1);
  const [editorError, setEditorError] = useState<string | null>(null);

  const isDraftModified = Boolean(lastAnalysedSequence && currentEditedSequence !== lastAnalysedSequence);

  // Compute live preview of the proposed edit
  const editPreview = useMemo(() => {
    const seq = currentEditedSequence;
    const len = seq.length;
    const pos = editPos;

    if (pos < 1 || (mutType !== 'insertion' && pos > len) || (mutType === 'insertion' && pos > len + 1)) {
      return { isValid: false, message: `Position ${pos} is out of bounds for sequence of length ${len} bp.` };
    }

    if (mutType === 'substitution') {
      const cleanNew = newBases.trim().toUpperCase();
      if (!/^[ATGC]$/.test(cleanNew)) {
        return { isValid: false, message: 'New base must be a single canonical DNA character: A, T, G, or C.' };
      }
      const oldBase = seq[pos - 1] || '';
      if (oldBase === cleanNew) {
        return { isValid: false, message: `Position ${pos} is already '${cleanNew}'. Substitution must alter the base.` };
      }
      return {
        isValid: true,
        message: `Substitute ${oldBase} with ${cleanNew} at base ${pos}.`,
        oldBases: oldBase,
        newBases: cleanNew,
      };
    }

    if (mutType === 'insertion') {
      const cleanIns = newBases.trim().toUpperCase();
      if (!/^[ATGC]+$/.test(cleanIns)) {
        return { isValid: false, message: 'Inserted sequence must contain only A, T, G, C.' };
      }
      const label = pos === 1 ? 'before base 1' : `after base ${pos - 1}`;
      return {
        isValid: true,
        message: `Insert "${cleanIns}" (+${cleanIns.length} bp) ${label}.`,
        oldBases: '',
        newBases: cleanIns,
      };
    }

    if (mutType === 'deletion') {
      const dLen = Math.max(1, delLength);
      if (pos + dLen - 1 > len) {
        return { isValid: false, message: `Deletion of ${dLen} bp from base ${pos} extends beyond sequence end.` };
      }
      const delSeq = seq.slice(pos - 1, pos - 1 + dLen);
      return {
        isValid: true,
        message: `Delete ${dLen} base(s) [${delSeq}] starting at base ${pos}.`,
        oldBases: delSeq,
        newBases: '',
      };
    }

    return { isValid: false, message: 'Select an edit operation.' };
  }, [currentEditedSequence, mutType, editPos, newBases, delLength]);

  const handleExecuteEdit = () => {
    if (!editPreview.isValid) {
      setEditorError(editPreview.message);
      return;
    }
    setEditorError(null);

    const err = onApplyEdit({
      position: editPos,
      oldBases: editPreview.oldBases || '',
      newBases: editPreview.newBases || '',
      action: editPreview.message,
    });

    if (err) {
      setEditorError(err);
    }
  };

  const handleSaveToNotebook = () => {
    if (!onSaveExperiment) return;
    const ok = onSaveExperiment(reflectionInput.trim());
    if (ok) {
      setSaveSuccessMsg('Experiment saved to Lab Notebook! View records in the Lab Notebook tab.');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Draft Modified Warning Banner */}
      {isDraftModified && (
        <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-lg p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
            <span className="font-bold text-[#9A3412]">
              Sequence changed. Run the experiment to update results.
            </span>
            <span className="text-[#6B7280] hidden md:inline">
              (Current results describe the last successfully analyzed sequence.)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TacticalButton
              type="button"
              variant="outline"
              size="sm"
              arrow={false}
              onClick={onDiscardEdits}
            >
              DISCARD EDITS
            </TacticalButton>
            <TacticalButton
              type="button"
              variant="accent"
              size="sm"
              arrow={true}
              onClick={onReanalyse}
              disabled={isReanalysing}
              loading={isReanalysing}
              loadingText="ANALYZING..."
            >
              RUN EXPERIMENT ↗
            </TacticalButton>
          </div>
        </div>
      )}

      {/* Save Success Toast */}
      {saveSuccessMsg && (
        <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-lg p-3 flex items-center justify-between text-xs text-[#166534]">
          <span className="font-bold">{saveSuccessMsg}</span>
          {onNavigateToNotebook && (
            <button
              type="button"
              onClick={onNavigateToNotebook}
              className="text-[#166534] font-bold underline cursor-pointer ml-3"
            >
              Open Notebook &rarr;
            </button>
          )}
        </div>
      )}

      {/* ===================================================================
          STAGE D: UNANALYZED EXPERIMENT SETUP & EXECUTION
      =================================================================== */}
      {!mutationExperiment && (
        <section className="bg-[#FFFFFF] rounded-lg border border-[#E5E7EB] p-5 shadow-sm space-y-4">
          <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-[#FF6500] uppercase tracking-wider block">
                STAGE D · EXPERIMENT EXECUTION
              </span>
              <h2 className="text-base font-bold text-[#111827]">
                Inspect Staged Variant &amp; Run Experiment
              </h2>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Review your reference codons and staged variant sequence before executing translation analysis.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] font-bold text-xs uppercase font-mono">
                READY TO RUN · UNANALYZED DRAFT
              </span>
            </div>
          </div>

          {/* Reference vs Staged Sequence Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {/* Reference */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[#6B7280] text-[11px] font-sans">
                <span className="font-bold">5′ Reference Sequence</span>
                <span>{referenceSequence.length} bp</span>
              </div>
              <div className="font-bold text-[#111827] break-all tracking-wider">
                {referenceSequence}
              </div>
            </div>

            {/* Staged Variant */}
            <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[#9A3412] text-[11px] font-sans">
                <span className="font-bold">5′ Staged Variant Sequence (Draft)</span>
                <span>{currentEditedSequence.length} bp</span>
              </div>
              <div className="font-bold text-[#C2410C] break-all tracking-wider">
                {currentEditedSequence}
              </div>
            </div>
          </div>

          {/* Staged Hypothesis */}
          <div className="bg-[#FFFDF5] border border-[#FDE68A] rounded p-3.5 space-y-2 text-xs">
            <span className="text-[11px] font-bold text-[#92400E] uppercase tracking-wider block font-sans">
              Recorded Prediction (Prior Hypothesis)
            </span>
            {currentPrediction?.choice ? (
              <div className="space-y-1">
                <div className="font-bold text-[#111827]">
                  Expected primary outcome: {PREDICTION_LABELS[currentPrediction.choice] || currentPrediction.choice}
                </div>
                {currentPrediction.rationale ? (
                  <p className="text-[11px] text-[#4B5563] italic">
                    Reasoning: &ldquo;{currentPrediction.rationale}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] text-[#6B7280]">
                    No rationale provided.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-[#6B7280]">
                Exploring without a prior prediction.
              </div>
            )}
          </div>

          {/* Prominent Run CTA */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-bold text-xs text-[#111827] block">
                Execute Translation Experiment
              </span>
              <p className="text-[11px] text-[#4B5563] mt-0.5">
                The engine will evaluate codons in reading frame 0, determine protein product changes, and evaluate your prediction.
              </p>
            </div>
            <TacticalButton
              type="button"
              variant="accent"
              size="lg"
              arrow={true}
              onClick={onReanalyse}
              disabled={isReanalysing}
              loading={isReanalysing}
              loadingText="RUNNING EXPERIMENT..."
            >
              RUN EXPERIMENT ↗
            </TacticalButton>
          </div>
        </section>
      )}

      {/* ===================================================================
          STAGE E: COMPARE THE OUTCOME
      =================================================================== */}
      {mutationExperiment && (
        <section className="bg-[#FFFFFF] rounded-lg border border-[#E5E7EB] p-5 shadow-sm space-y-4">
          {/* Header & Mutation Category Badge */}
          <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-[#FF6500] uppercase tracking-wider block">
                STAGE E · EXPERIMENT OUTCOME
              </span>
              <h2 className="text-base font-bold text-[#111827]">
                Reference vs. Variant Translation Comparison
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-[#FFF7ED] border border-[#FDBA74] text-[#C2410C] font-bold text-xs uppercase font-mono">
                {mutationExperiment.category_label || mutationExperiment.mutation_category}
              </span>
            </div>
          </div>

          {/* Biological Explanation Card (Stage F) */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5 space-y-1.5 text-xs">
            <span className="font-bold text-[#111827] block">Scientific Explanation:</span>
            <p className="text-[#374151] leading-relaxed text-[12px]">
              {mutationExperiment.explanation}
            </p>
            {mutationExperiment.first_affected_codon && (
              <div className="text-[11px] text-[#6B7280] pt-1">
                First affected codon: <strong>Codon {mutationExperiment.first_affected_codon}</strong>
                {mutationExperiment.variant_first_stop_position && (
                  <span className="ml-3">
                    First stop codon: <strong>Codon {mutationExperiment.variant_first_stop_position}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Educational Triplet & Translation Pipeline Visualizer */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#111827]">
              <span>Triplet Codon Comparison (5′ → 3′, Reading Frame 0):</span>
              <span className="text-[11px] text-[#6B7280] font-normal">
                Changed DNA Base &rarr; Affected Codon &rarr; Translated Product
              </span>
            </div>

            {/* Side-by-Side Codon Grid */}
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg bg-[#FFFFFF] p-3 scrollbar-thin">
              <div className="flex items-center gap-2 min-w-max">
                {mutationExperiment.codon_comparison.map((item) => (
                  <div
                    key={item.codon_index}
                    className={`border rounded p-2 text-center min-w-[70px] transition-all font-mono ${
                      item.is_changed
                        ? 'bg-[#FFF7ED] border-[#FF6500] ring-1 ring-[#FF6500]/30'
                        : 'bg-[#F9FAFB] border-[#E5E7EB]'
                    }`}
                  >
                    <div className="text-[10px] text-[#6B7280] font-sans">
                      Codon {item.codon_index}
                    </div>
                    {/* Reference Triplet & Amino Acid */}
                    <div className="border-b border-[#E5E7EB] pb-1 my-1">
                      <div className="text-[11px] text-[#6B7280]">{item.ref_codon}</div>
                      <div className="text-xs font-bold text-[#111827]">
                        {item.ref_aa}
                      </div>
                    </div>
                    {/* Variant Triplet & Amino Acid */}
                    <div>
                      <div className={`text-[11px] ${item.is_changed ? 'text-[#C2410C] font-bold' : 'text-[#6B7280]'}`}>
                        {item.var_codon}
                      </div>
                      <div className={`text-xs font-bold ${item.is_changed ? 'text-[#FF6500]' : 'text-[#111827]'}`}>
                        {item.var_aa}
                      </div>
                    </div>
                    {item.is_changed && (
                      <div className="text-[9px] uppercase font-bold text-[#EA580C] mt-1 pt-0.5 border-t border-[#FDBA74]">
                        CHANGED
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Protein Product Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
              {/* Reference Translated Product */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 space-y-1 font-mono">
                <span className="text-[11px] font-bold text-[#6B7280] font-sans block">
                  Reference Translated Product (MAEFPK*):
                </span>
                <div className="text-sm font-bold text-[#111827] tracking-wider break-all">
                  {mutationExperiment.reference_protein_product || '—'}
                  {mutationExperiment.reference_first_stop_position && (
                    <span className="text-[#DC2626]"> *</span>
                  )}
                </div>
                <div className="text-[11px] text-[#6B7280] font-sans">
                  Length: {mutationExperiment.reference_protein_product.length} AA
                  {mutationExperiment.reference_first_stop_position && (
                    <span> (Stop codon at position {mutationExperiment.reference_first_stop_position})</span>
                  )}
                </div>
              </div>

              {/* Variant Translated Product */}
              <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-lg p-3 space-y-1 font-mono">
                <span className="text-[11px] font-bold text-[#9A3412] font-sans block">
                  Observed Variant Product:
                </span>
                <div className="text-sm font-bold text-[#C2410C] tracking-wider break-all">
                  {mutationExperiment.variant_protein_product || '—'}
                  {mutationExperiment.variant_first_stop_position && (
                    <span className="text-[#DC2626]"> *</span>
                  )}
                </div>
                <div className="text-[11px] text-[#9A3412] font-sans">
                  Length: {mutationExperiment.variant_protein_product.length} AA
                  {mutationExperiment.variant_first_stop_position ? (
                    <span> (Stop codon at position {mutationExperiment.variant_first_stop_position})</span>
                  ) : (
                    <span> (No in-frame stop codon occurs)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes & Educational Bounds */}
            {mutationExperiment.notes.length > 0 && (
              <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded p-3 text-[11px] text-[#4B5563] space-y-1">
                <span className="font-bold text-[#111827] block">Educational Laboratory Notes:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {mutationExperiment.notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===================================================================
          STAGE B & F: PREDICTION EVALUATION
      =================================================================== */}
      {mutationExperiment && mutationExperiment.prediction_evaluation && (
        <section className="bg-[#FFFFFF] rounded-lg border border-[#E5E7EB] p-5 shadow-sm space-y-3">
          <div className="border-b border-[#E5E7EB] pb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#FF6500] uppercase tracking-wider block">
              STAGE B &amp; F · PREDICTION EVALUATION
            </span>
            <span className="text-xs font-mono font-bold">
              {mutationExperiment.prediction_evaluation.status === 'correct' || mutationExperiment.prediction_evaluation.matched === true ? (
                <span className="text-[#16A34A] px-2 py-0.5 rounded bg-[#F0FDF4] border border-[#86EFAC]">PREDICTION MATCHED ✓</span>
              ) : mutationExperiment.prediction_evaluation.status === 'diverged' || mutationExperiment.prediction_evaluation.matched === false ? (
                <span className="text-[#B45309] px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A]">OUTCOME DIVERGED</span>
              ) : mutationExperiment.prediction_evaluation.status === 'not_sure' ? (
                <span className="text-[#374151] px-2 py-0.5 rounded bg-[#F3F4F6] border border-[#D1D5DB]">EXPLORATION RUN (NOT SURE)</span>
              ) : (
                <span className="text-[#4B5563] px-2 py-0.5 rounded bg-[#F3F4F6] border border-[#D1D5DB]">EXPLORATION RUN</span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 space-y-1">
              <span className="font-bold text-[#6B7280] block text-[11px]">Your Prior Hypothesis:</span>
              <p className="font-bold text-[#111827]">
                {PREDICTION_LABELS[mutationExperiment.prediction_evaluation.choice] || mutationExperiment.prediction_evaluation.choice_label || mutationExperiment.prediction_evaluation.choice || 'Not specified'}
              </p>
              {mutationExperiment.prediction_evaluation.rationale && (
                <p className="text-[11px] text-[#4B5563] italic">
                  &ldquo;{mutationExperiment.prediction_evaluation.rationale}&rdquo;
                </p>
              )}
            </div>

            <div className={`rounded p-3 space-y-1 border ${
              mutationExperiment.prediction_evaluation.matched === true
                ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
                : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
            }`}>
              <span className="font-bold block text-[11px]">Curriculum Feedback:</span>
              <p className="text-xs leading-relaxed">
                {mutationExperiment.prediction_evaluation.feedback}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================
          STAGE 10: ACTIVE LEARNING REFLECTION
      =================================================================== */}
      {mutationExperiment && mutationExperiment.reflection && (
        <section className="bg-[#FFFFFF] rounded-lg border border-[#E5E7EB] p-5 shadow-sm space-y-3">
          <div className="border-b border-[#E5E7EB] pb-2 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-[#FF6500] uppercase tracking-wider block">
                STAGE 10 · ACTIVE LEARNING REFLECTION
              </span>
              <h3 className="text-xs font-bold text-[#111827]">
                {mutationExperiment.reflection.question}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowModelAnswer((v) => !v)}
              className="text-xs text-[#FF6500] hover:underline font-bold cursor-pointer"
            >
              {showModelAnswer ? 'Hide scientific model answer' : 'Show scientific model answer'}
            </button>
          </div>

          <p className="text-[11px] text-[#4B5563]">
            Record your reasoning in your own words. Saving this experiment will preserve your hypothesis, outcome, and reflection in the Lab Notebook.
          </p>

          <textarea
            value={reflectionInput}
            onChange={(e) => setReflectionInput(e.target.value)}
            placeholder="Type your explanation here (e.g. why the reading frame shifted or why codon degeneracy preserved the amino acid)..."
            rows={3}
            className="w-full bg-[#FFFFFF] border border-[#D1D5DB] rounded p-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#FF6500]"
          />

          {showModelAnswer && (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded p-3 text-xs text-[#166534] space-y-1">
              <span className="font-bold block text-[11px]">Scientific Model Explanation:</span>
              <p className="text-[11px] leading-relaxed">
                {mutationExperiment.reflection.model_answer}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TacticalButton
                type="button"
                variant="accent"
                size="sm"
                arrow={true}
                onClick={handleSaveToNotebook}
                disabled={isDraftModified}
              >
                SAVE TO LAB NOTEBOOK ↗
              </TacticalButton>
              {isDraftModified && (
                <span className="text-[11px] text-[#B45309]">
                  Run experiment to evaluate modified draft before saving.
                </span>
              )}
            </div>

            {onResetToReference && (
              <TacticalButton
                type="button"
                variant="outline"
                size="sm"
                arrow={false}
                onClick={onResetToReference}
              >
                RESET TO UNMUTATED REFERENCE
              </TacticalButton>
            )}
          </div>
        </section>
      )}

      {/* ===================================================================
          STAGE C: INTRODUCE A MUTATION (INTERACTIVE EDITOR)
      =================================================================== */}
      <section className="bg-[#FFFFFF] rounded-lg border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="border-b border-[#E5E7EB] pb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[11px] font-bold text-[#FF6500] uppercase tracking-wider block">
              STAGE C · MUTATION WORKBENCH
            </span>
            <h3 className="text-sm font-bold text-[#111827]">
              Introduce or Modify a Mutation
            </h3>
          </div>
          <span className="text-xs text-[#6B7280] font-mono">
            Length: {currentEditedSequence.length} bp
          </span>
        </div>

        {editorError && (
          <div className="bg-[#FEF2F2] border border-[#F87171] rounded p-2.5 text-xs text-[#991B1B]">
            {editorError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Mutation Type */}
          <div>
            <label className="text-[11px] font-bold text-[#111827] block mb-1">
              Mutation Type:
            </label>
            <select
              value={mutType}
              onChange={(e) => setMutType(e.target.value as any)}
              className="w-full bg-[#FFFFFF] border border-[#D1D5DB] rounded p-2 text-xs text-[#111827] focus:outline-none focus:border-[#FF6500]"
            >
              <option value="substitution">Substitution</option>
              <option value="insertion">Insertion</option>
              <option value="deletion">Deletion</option>
            </select>
          </div>

          {/* Position (1-based) */}
          <div>
            <label className="text-[11px] font-bold text-[#111827] block mb-1">
              1-Based Position:
            </label>
            <input
              type="number"
              min={1}
              max={currentEditedSequence.length + (mutType === 'insertion' ? 1 : 0)}
              value={editPos}
              onChange={(e) => setEditPos(parseInt(e.target.value) || 1)}
              className="w-full bg-[#FFFFFF] border border-[#D1D5DB] rounded p-2 text-xs text-[#111827] focus:outline-none focus:border-[#FF6500]"
            />
          </div>

          {/* New Bases or Deletion Length */}
          {mutType !== 'deletion' ? (
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#111827] block mb-1">
                {mutType === 'substitution' ? 'New Base (A, T, G, C):' : 'Inserted Sequence (A, T, G, C):'}
              </label>
              <input
                type="text"
                value={newBases}
                onChange={(e) => setNewBases(e.target.value.toUpperCase())}
                placeholder={mutType === 'substitution' ? 'e.g. A' : 'e.g. GCC'}
                className="w-full bg-[#FFFFFF] border border-[#D1D5DB] rounded p-2 text-xs font-mono text-[#111827] focus:outline-none focus:border-[#FF6500]"
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#111827] block mb-1">
                Deletion Length (bp):
              </label>
              <input
                type="number"
                min={1}
                max={currentEditedSequence.length - editPos + 1}
                value={delLength}
                onChange={(e) => setDelLength(parseInt(e.target.value) || 1)}
                className="w-full bg-[#FFFFFF] border border-[#D1D5DB] rounded p-2 text-xs text-[#111827] focus:outline-none focus:border-[#FF6500]"
              />
            </div>
          )}
        </div>

        {/* Live Edit Preview */}
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3 text-xs flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[11px] font-bold text-[#6B7280] block">Action Preview:</span>
            <span className={`font-mono text-xs ${editPreview.isValid ? 'text-[#111827] font-bold' : 'text-[#DC2626]'}`}>
              {editPreview.message}
            </span>
          </div>
          <TacticalButton
            type="button"
            variant="outline"
            size="sm"
            arrow={false}
            onClick={handleExecuteEdit}
            disabled={!editPreview.isValid}
          >
            APPLY TO DRAFT SEQUENCE
          </TacticalButton>
        </div>
      </section>
    </div>
  );
};

