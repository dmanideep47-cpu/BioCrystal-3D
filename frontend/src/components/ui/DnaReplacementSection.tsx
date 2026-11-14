import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlignmentMutation } from '../../types/dna';
import { TacticalButton } from './TacticalButton';
import './DnaReplacementSection.css';

interface DnaReplacementSectionProps {
  currentReferenceSequence: string;
  currentMutatedSequence: string;
  onReplaceSequences: (newReference: string, newMutated: string) => Promise<void>;
  onSelectMutation?: (mutation: AlignmentMutation) => void;
  isProcessing?: boolean;
}

interface AminoAcidPropertyEntry {
  mutation_label: string;
  protein_position: number;
  reference_aa: string;
  variant_aa: string;
  hydropathy: { reference: number; variant: number };
  molecular_mass_da: { reference: number; variant: number };
  sidechain_charge_ph74: { reference: number; variant: number };
  polarity: { reference: string; variant: string };
}

interface ModelSiteScore {
  mutation_label: string;
  score_log_ratio: number;
}

interface VariantIntelligence {
  integrated_explanation?: string;
  nucleotide_comparison?: { events?: AlignmentMutation[] };
  protein_interpretation?: {
    status?: string;
    reference_protein_product?: string;
    variant_protein_product?: string;
  };
  biochemical_comparison?: { entries?: AminoAcidPropertyEntry[] };
  ml_scoring?: {
    model_name?: string;
    model_checkpoint?: string;
    site_scores?: ModelSiteScore[];
    status?: string;
    reason?: string;
    scoring_formula?: string;
  };
  layer_statuses?: Record<string, string>;
}

interface ComparisonAnalysis {
  alignment?: { mutations?: AlignmentMutation[] };
  variant_intelligence?: VariantIntelligence | null;
}

interface CompositionPoint {
  base: string;
  referencePercent: number;
  variantPercent: number;
  referenceCount: number;
  variantCount: number;
}

interface MutationPlotPoint {
  x: number;
  y: number;
  type: AlignmentMutation['type'];
  referencePosition: number;
  observedPosition: number;
  referenceBases: string;
  variantBases: string;
  description: string;
  mutation: AlignmentMutation;
}

interface ScientificTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    payload?: Record<string, unknown>;
  }>;
  label?: number | string;
}

const CHART_COLORS = {
  reference: '#718096',
  variant: '#B86F58',
  sage: '#718B78',
  blue: '#5D7F9E',
  grid: '#E5E7EB',
};

const EMPTY_PROPERTY_ENTRIES: AminoAcidPropertyEntry[] = [];

function getComposition(seq: string): CompositionPoint[] {
  const length = seq.length;
  const counts: Record<string, number> = { A: 0, T: 0, G: 0, C: 0 };
  for (const nucleotide of seq) {
    counts[nucleotide] = (counts[nucleotide] || 0) + 1;
  }

  return ['A', 'T', 'G', 'C'].map((base) => {
    const referenceCount = counts[base];
    return {
      base,
      referencePercent: length ? (referenceCount / length) * 100 : 0,
      variantPercent: 0,
      referenceCount,
      variantCount: 0,
    };
  });
}

function getCompositionComparison(reference: string, variant: string): CompositionPoint[] {
  const referenceData = getComposition(reference);
  const variantCounts: Record<string, number> = { A: 0, T: 0, G: 0, C: 0 };
  for (const nucleotide of variant) {
    variantCounts[nucleotide] = (variantCounts[nucleotide] || 0) + 1;
  }

  return referenceData.map((item) => {
    const variantCount = variantCounts[item.base];
    return {
      ...item,
      variantPercent: variant.length ? (variantCount / variant.length) * 100 : 0,
      variantCount,
    };
  });
}

function getGcAtStats(sequence: string) {
  const gcCount = (sequence.match(/[GC]/g) || []).length;
  const atCount = (sequence.match(/[AT]/g) || []).length;
  return {
    gc: sequence.length ? (gcCount / sequence.length) * 100 : 0,
    at: sequence.length ? (atCount / sequence.length) * 100 : 0,
  };
}

function formatSigned(value: number, suffix = ''): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

function getMutationDescription(mutation: AlignmentMutation): string {
  const ref = mutation.reference_bases || mutation.original_base || '-';
  const variant = mutation.observed_bases || mutation.observed_base || '-';
  if (mutation.type === 'insertion') {
    return `${variant} inserted after reference position ${Math.max(mutation.reference_position - 1, 0)}`;
  }
  if (mutation.type === 'deletion') {
    return `${ref} deleted from reference position ${mutation.reference_position}`;
  }
  return `${ref} → ${variant} at reference position ${mutation.reference_position}`;
}

function ScientificTooltip({ active, payload, label }: ScientificTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bc-scientific-tooltip">
      {label !== undefined && <div className="bc-scientific-tooltip-title">{label}</div>}
      {payload.map((item, index) => {
        const detail = item.payload || {};
        const name = item.name || 'Value';
        let value = String(item.value ?? '');

        if (typeof detail.referenceCount === 'number' && typeof detail.variantCount === 'number') {
          const count = name.toLowerCase().includes('reference')
            ? detail.referenceCount
            : detail.variantCount;
          value = `${Number(item.value).toFixed(2)}% (${count} nt)`;
        } else if (typeof item.value === 'number') {
          value = item.value.toFixed(2);
        }

        return (
          <div className="bc-scientific-tooltip-row" key={`${name}-${index}`}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}
/**
 * Sanitizes input sequence by removing whitespace, line breaks, tabs,
 * and converting all letters to uppercase.
 */
function sanitizeDNA(input: string): string {
  return input.replace(/[\s\r\n\t]+/g, '').toUpperCase();
}

/**
 * Validates that sequence is non-empty and contains only canonical DNA bases (A, T, G, C).
 */
function validateSequence(seq: string, label: string): { isValid: boolean; error: string | null; cleaned: string } {
  const cleaned = sanitizeDNA(seq);
  if (!cleaned) {
    return {
      isValid: false,
      error: `${label} is required. Please provide a valid DNA sequence.`,
      cleaned: '',
    };
  }
  const invalidChars = cleaned.match(/[^ATGC]/g);
  if (invalidChars) {
    const unique = Array.from(new Set(invalidChars)).slice(0, 6).join(', ');
    return {
      isValid: false,
      error: `${label} contains invalid character(s): [${unique}]. Only canonical DNA bases (A, T, G, C) are permitted.`,
      cleaned,
    };
  }
  return { isValid: true, error: null, cleaned };
}

function calculateGC(seq: string): number {
  if (!seq) return 0;
  const gcCount = (seq.match(/[GC]/g) || []).length;
  return Math.round((gcCount / seq.length) * 1000) / 10;
}

function getSequenceSummary(reference: string, observed: string) {
  const refSeq = sanitizeDNA(reference);
  const obsSeq = sanitizeDNA(observed);
  const maxLen = Math.max(refSeq.length, obsSeq.length);
  const sharedLen = Math.min(refSeq.length, obsSeq.length);

  let matches = 0;
  let substitutions = 0;
  let transitions = 0;
  let transversions = 0;
  let insertions = 0;
  let deletions = 0;

  for (let index = 0; index < sharedLen; index += 1) {
    const refBase = refSeq[index];
    const obsBase = obsSeq[index];

    if (refBase === obsBase) {
      matches += 1;
      continue;
    }

    substitutions += 1;

    const isTransition =
      (refBase === 'A' && obsBase === 'G') ||
      (refBase === 'G' && obsBase === 'A') ||
      (refBase === 'C' && obsBase === 'T') ||
      (refBase === 'T' && obsBase === 'C');

    if (isTransition) {
      transitions += 1;
    } else {
      transversions += 1;
    }
  }

  if (refSeq.length > obsSeq.length) {
    deletions = refSeq.length - obsSeq.length;
  } else if (obsSeq.length > refSeq.length) {
    insertions = obsSeq.length - refSeq.length;
  }

  const totalDifferences = substitutions + insertions + deletions;
  const identity = maxLen === 0 ? 0 : (matches / maxLen) * 100;

  return {
    matches,
    substitutions,
    insertions,
    deletions,
    transitions,
    transversions,
    totalDifferences,
    identity: Math.round(identity * 10) / 10,
    refGc: calculateGC(refSeq),
    obsGc: calculateGC(obsSeq),
    refAt: 100 - calculateGC(refSeq),
    obsAt: 100 - calculateGC(obsSeq),
  };
}

export const DnaReplacementSection: React.FC<DnaReplacementSectionProps> = ({
  currentReferenceSequence,
  currentMutatedSequence,
  onReplaceSequences,
  onSelectMutation,
  isProcessing = false,
}) => {
  const [refInput, setRefInput] = useState<string>(currentReferenceSequence || '');
  const [mutInput, setMutInput] = useState<string>(currentMutatedSequence || '');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Sync inputs with parent state when external props change
  useEffect(() => {
    setRefInput(currentReferenceSequence || '');
  }, [currentReferenceSequence]);

  useEffect(() => {
    setMutInput(currentMutatedSequence || '');
  }, [currentMutatedSequence]);

  const sanitizedRef = sanitizeDNA(refInput);
  const sanitizedMut = sanitizeDNA(mutInput);
  const sequenceSummary = getSequenceSummary(sanitizedRef, sanitizedMut);
  const hasCodingContext = sanitizedRef.length > 0 && sanitizedMut.length > 0 && sanitizedRef.length % 3 === 0 && sanitizedMut.length % 3 === 0;

  const [analysisResult, setAnalysisResult] = useState<ComparisonAnalysis | null>(null);
  const [analysisFailure, setAnalysisFailure] = useState<{ pairKey: string; message: string } | null>(null);
  const [analysisLoadingKey, setAnalysisLoadingKey] = useState<string | null>(null);
  const [analyzedPairKey, setAnalyzedPairKey] = useState<string | null>(null);
  const currentPairKey = `${sanitizedRef}:${sanitizedMut}`;
  const isAnalyzing = analysisLoadingKey === currentPairKey;
  const analysisError = analysisFailure?.pairKey === currentPairKey ? analysisFailure.message : null;

  useEffect(() => {
    const refSeq = sanitizeDNA(refInput);
    const mutSeq = sanitizeDNA(mutInput);

    if (!refSeq || !mutSeq || /[^ATGC]/.test(refSeq) || /[^ATGC]/.test(mutSeq)) {
      return;
    }

    let isMounted = true;
    const pairKey = `${refSeq}:${mutSeq}`;
    setAnalysisLoadingKey(pairKey);

    fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_sequence: refSeq,
        observed_sequence: mutSeq,
        reading_frame: 0,
        table_id: 1,
        gene: 'DNA',
        is_coding: true,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as { detail?: string };
          throw new Error(errorBody.detail || `Analysis failed with HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (isMounted) {
          setAnalysisResult(data as ComparisonAnalysis);
          setAnalyzedPairKey(pairKey);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setAnalysisFailure({
            pairKey,
            message: err instanceof Error ? err.message : 'Failed to retrieve variant intelligence summary.',
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setAnalysisLoadingKey((loadingKey) => loadingKey === pairKey ? null : loadingKey);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refInput, mutInput]);

  const isAnalysisCurrent = analyzedPairKey === currentPairKey;
  const variantIntelligence = isAnalysisCurrent ? analysisResult?.variant_intelligence : null;
  const compositionData = useMemo(
    () => getCompositionComparison(sanitizedRef, sanitizedMut),
    [sanitizedRef, sanitizedMut]
  );
  const refGcAt = useMemo(() => getGcAtStats(sanitizedRef), [sanitizedRef]);
  const mutGcAt = useMemo(() => getGcAtStats(sanitizedMut), [sanitizedMut]);
  const gcAtData = [
    { baseContent: 'GC', reference: refGcAt.gc, variant: mutGcAt.gc },
    { baseContent: 'AT', reference: refGcAt.at, variant: mutGcAt.at },
  ];
  const mutationPoints = useMemo<MutationPlotPoint[]>(() => {
    const mutations = isAnalysisCurrent ? analysisResult?.alignment?.mutations || [] : [];
    const laneByType: Record<AlignmentMutation['type'], number> = {
      substitution: 3,
      insertion: 2,
      deletion: 1,
    };

    return mutations.map((mutation) => ({
      x: mutation.reference_position,
      y: laneByType[mutation.type],
      type: mutation.type,
      referencePosition: mutation.reference_position,
      observedPosition: mutation.observed_position,
      referenceBases: mutation.reference_bases || mutation.original_base || '-',
      variantBases: mutation.observed_bases || mutation.observed_base || '-',
      description: getMutationDescription(mutation),
      mutation,
    }));
  }, [analysisResult, isAnalysisCurrent]);
  const propertyEntries = variantIntelligence?.biochemical_comparison?.entries ?? EMPTY_PROPERTY_ENTRIES;
  const propertyChartData = propertyEntries.map((entry) => ({
    mutation: entry.mutation_label,
    reference: entry.hydropathy.reference,
    variant: entry.hydropathy.variant,
    chargeReference: entry.sidechain_charge_ph74.reference,
    chargeVariant: entry.sidechain_charge_ph74.variant,
    massReference: entry.molecular_mass_da.reference,
    massVariant: entry.molecular_mass_da.variant,
  }));
  const polarityData = useMemo(() => {
    const categories = ['nonpolar', 'polar uncharged', 'basic positive', 'acidic negative'];
    const normalizePolarity = (value: string) => value.replace(/_/g, ' ');
    return categories.map((category) => ({
      category,
      reference: propertyEntries.filter(
        (entry) => normalizePolarity(entry.polarity.reference) === category
      ).length,
      variant: propertyEntries.filter(
        (entry) => normalizePolarity(entry.polarity.variant) === category
      ).length,
    }));
  }, [propertyEntries]);
  const mlScoring = variantIntelligence?.ml_scoring;
  const modelScores = (
    mlScoring?.status === 'available' && mlScoring.model_name
      ? mlScoring.site_scores || []
      : []
  ).filter((score) => Number.isFinite(score.score_log_ratio));
  const maxScoreMagnitude = Math.max(
    0.1,
    ...modelScores.map((score) => Math.abs(score.score_log_ratio))
  );
  const scoreChartData = modelScores.map((score) => ({
    mutation: score.mutation_label,
    positiveScore: Math.max(score.score_log_ratio, 0),
    negativeScore: Math.min(score.score_log_ratio, 0),
    score: score.score_log_ratio,
  }));
  const positiveScoreCount = modelScores.filter((score) => score.score_log_ratio > 0.05).length;
  const negativeScoreCount = modelScores.filter((score) => score.score_log_ratio < -0.05).length;
  const neutralScoreCount = modelScores.length - positiveScoreCount - negativeScoreCount;
  const modelPreference =
    modelScores.length === 0
      ? null
      : positiveScoreCount === modelScores.length
        ? 'The model favors the mutated amino acid at all scored substitution sites.'
        : negativeScoreCount === modelScores.length
          ? 'The model favors the reference amino acid at all scored substitution sites.'
          : positiveScoreCount > 0 && negativeScoreCount > 0
            ? 'The model shows mixed site-wise preferences across the scored substitutions.'
            : positiveScoreCount > negativeScoreCount
              ? `The model favors the mutated amino acid at ${positiveScoreCount} of ${modelScores.length} scored sites.`
              : negativeScoreCount > positiveScoreCount
                ? `The model favors the reference amino acid at ${negativeScoreCount} of ${modelScores.length} scored sites.`
                : `The model shows little separation at ${neutralScoreCount} scored site${neutralScoreCount === 1 ? '' : 's'}.`;
  const modelPreferenceDirection =
    positiveScoreCount > 0 && negativeScoreCount === 0
      ? 'variant'
      : negativeScoreCount > 0 && positiveScoreCount === 0
        ? 'reference'
        : positiveScoreCount > 0 && negativeScoreCount > 0
          ? 'mixed'
          : 'neutral';
  const canSelectMutation = Boolean(
    onSelectMutation &&
    sanitizedRef === sanitizeDNA(currentReferenceSequence) &&
    sanitizedMut === sanitizeDNA(currentMutatedSequence)
  );
  const validSequencePair = Boolean(
    sanitizedRef &&
    sanitizedMut &&
    !/[^ATGC]/.test(sanitizedRef) &&
    !/[^ATGC]/.test(sanitizedMut)
  );
  const proteinInterpretation = variantIntelligence?.protein_interpretation;

  // Handle Action 1: Replace Reference with Mutated DNA
  const handleReplaceReferenceWithMutated = async () => {
    setActionError(null);
    setSuccessMsg(null);

    const mutValidation = validateSequence(mutInput, 'Mutated DNA');
    if (!mutValidation.isValid) {
      setActionError(mutValidation.error);
      return;
    }

    const newRef = mutValidation.cleaned;
    const newMut = mutValidation.cleaned;

    setIsBusy(true);
    try {
      await onReplaceSequences(newRef, newMut);
      setRefInput(newRef);
      setMutInput(newMut);
      setSuccessMsg('Reference DNA updated to match the mutated sequence.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to replace DNA sequence.');
    } finally {
      setIsBusy(false);
    }
  };

  // Handle Action 2: Update & Reanalyse Sequences
  const handleUpdateAndReanalyse = async () => {
    setActionError(null);
    setSuccessMsg(null);

    const refValidation = validateSequence(refInput, 'Reference DNA');
    if (!refValidation.isValid) {
      setActionError(refValidation.error);
      return;
    }

    const mutValidation = validateSequence(mutInput, 'Mutated DNA');
    if (!mutValidation.isValid) {
      setActionError(mutValidation.error);
      return;
    }

    setIsBusy(true);
    try {
      await onReplaceSequences(refValidation.cleaned, mutValidation.cleaned);
      setRefInput(refValidation.cleaned);
      setMutInput(mutValidation.cleaned);
      setSuccessMsg('Sequences updated and reanalysed successfully.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Reanalysis with updated sequences failed.');
    } finally {
      setIsBusy(false);
    }
  };

  // Handle Action 3: Swap Reference and Mutated DNA
  const handleSwap = () => {
    const temp = refInput;
    setRefInput(mutInput);
    setMutInput(temp);
    setActionError(null);
    setSuccessMsg('Swapped reference and mutated DNA inputs. Select “Update & reanalyse sequences” to apply.');
  };

  // Handle Action 4: Reset to current loaded sequences
  const handleReset = () => {
    setRefInput(currentReferenceSequence || '');
    setMutInput(currentMutatedSequence || '');
    setActionError(null);
    setSuccessMsg('Reset sequence inputs to currently active sequences.');
  };

  const busy = isProcessing || isBusy;

  return (
    <section className="bc-results-card bc-dna-replacement-card space-y-6 rounded-none border border-[#E5E5E5] bg-white p-5 text-[#171717] shadow-xs">
      {/* ===================================================================
          1. EDUCATIONAL DNA EXPLANATION SECTION (BEFORE REPLACEMENT ACTION)
      =================================================================== */}
      <div className="bc-dna-explanation-block space-y-4 border-b border-[#E5E5E5] pb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#171717] font-mono uppercase tracking-wider">
            About DNA and sequence changes
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#737373]">
            The comparison below evaluates nucleotide-level differences, codon context, and the limits of computational interpretation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 pt-1 text-xs md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-none border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F766E]">
              Input validation
            </h3>
            <p className="mt-2 leading-relaxed text-[#737373]">
              DNA sequences are checked for emptiness, non-canonical bases, and ambiguous symbols before any protein or structural interpretation.
            </p>
          </div>

          <div className="rounded-none border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F766E]">
              Nucleotide comparison
            </h3>
            <p className="mt-2 leading-relaxed text-[#737373]">
              Matches, substitutions, insertions, deletions, and transition/transversion counts are measured against the reference sequence.
            </p>
          </div>

          <div className="rounded-none border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F766E]">
              Codon / protein context
            </h3>
            <p className="mt-2 leading-relaxed text-[#737373]">
              When the sequence is a valid coding segment, protein translation and codon changes can be interpreted under the NCBI standard genetic code.
            </p>
          </div>

          <div className="rounded-none border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0F766E]">
              Model interpretation
            </h3>
            <p className="mt-2 leading-relaxed text-[#737373]">
              A protein model can indicate whether a substitution is more or less favoured, but it does not prove improved or reduced biological function.
            </p>
          </div>
        </div>

        <div className="rounded-none border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs leading-relaxed text-[#171717]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-[#171717]">Current comparison summary:</span>
            <span><strong>{sequenceSummary.identity}%</strong> identity</span>
            <span><strong>{sequenceSummary.matches}</strong> matching bases</span>
            <span><strong>{sequenceSummary.substitutions}</strong> substitutions</span>
            <span><strong>{sequenceSummary.insertions}</strong> insertions</span>
            <span><strong>{sequenceSummary.deletions}</strong> deletions</span>
          </div>
          <div className="mt-2">
            {hasCodingContext
              ? 'Coding-sequence interpretation is available for this pair, using the selected reading frame and strand context to guide protein-level assessment.'
              : 'Protein-level interpretation requires a valid coding context, a known reading frame, and sequence orientation information; without that, only nucleotide-level comparison is available.'}
          </div>
        </div>

        <div className="bc-analysis-chart-grid" aria-label="Sequence analysis graphs">
          <article className="bc-analysis-chart-card">
            <header className="bc-analysis-chart-header">
              <h3 className="bc-analysis-chart-title">1. DNA Nucleotide Composition</h3>
              <p>Reference and mutated base percentages; hover for the exact base count and percentage.</p>
            </header>
            {validSequencePair ? (
              <div className="bc-chart-canvas" role="img" aria-label="Grouped comparison of A, T, G and C percentages">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={compositionData} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="base"
                      tickLine={false}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                      label={{ value: 'Nucleotide', position: 'insideBottom', offset: -16 }}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickFormatter={(value: number) => `${value}%`}
                      tickLine={false}
                      axisLine={false}
                      label={{ value: 'Sequence composition (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<ScientificTooltip />} />
                    <Legend />
                    <Bar dataKey="referencePercent" name="Reference" fill={CHART_COLORS.reference} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="variantPercent" name="Mutated" fill={CHART_COLORS.variant} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="bc-chart-unavailable">Enter two valid, non-empty DNA sequences to calculate nucleotide composition.</p>
            )}
          </article>

          <article className="bc-analysis-chart-card">
            <header className="bc-analysis-chart-header">
              <h3 className="bc-analysis-chart-title">2. GC / AT Content Comparison</h3>
              <p>
                Mutated minus reference: GC {formatSigned(mutGcAt.gc - refGcAt.gc, ' pp')} ·
                {' '}AT {formatSigned(mutGcAt.at - refGcAt.at, ' pp')}
              </p>
            </header>
            {validSequencePair ? (
              <div className="bc-chart-canvas" role="img" aria-label="Grouped comparison of GC and AT percentages">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={gcAtData} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="baseContent"
                      tickLine={false}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                      label={{ value: 'Base content', position: 'insideBottom', offset: -16 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      tickLine={false}
                      axisLine={false}
                      label={{ value: 'Sequence composition (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<ScientificTooltip />} />
                    <Legend />
                    <Bar dataKey="reference" name="Reference" fill={CHART_COLORS.reference} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="variant" name="Mutated" fill={CHART_COLORS.variant} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="bc-chart-unavailable">GC and AT percentages are unavailable until both inputs are valid DNA sequences.</p>
            )}
          </article>

          <article className="bc-analysis-chart-card">
            <header className="bc-analysis-chart-header">
              <h3 className="bc-analysis-chart-title">3. Mutation Position Map</h3>
              <p>
                Aligned mutation coordinates from the sequence comparison.
                {canSelectMutation ? ' Click a point to select it in the alignment.' : ' Submit this sequence pair to enable alignment selection.'}
              </p>
            </header>
            {isAnalyzing && !isAnalysisCurrent ? (
              <p className="bc-chart-unavailable" role="status">Aligning the current sequence pair…</p>
            ) : mutationPoints.length ? (
              <div className="bc-chart-canvas" role="img" aria-label="Mutation locations by reference coordinate and mutation class">
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 8, right: 18, left: 8, bottom: 28 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[1, Math.max(sanitizedRef.length, 1)]}
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                      label={{ value: 'Reference coordinate (bp; insertion gap)', position: 'insideBottom', offset: -16 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[0.5, 3.5]}
                      ticks={[1, 2, 3]}
                      tickFormatter={(value: number) => ({ 1: 'Deletion', 2: 'Insertion', 3: 'Substitution' }[value] || '')}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                      label={{ value: 'Mutation class', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(_value, _name, item) => {
                        const point = item.payload as MutationPlotPoint;
                        return [
                          `${point.description} · observed position ${point.observedPosition}`,
                          point.type,
                        ];
                      }}
                      labelFormatter={(label) => `Reference coordinate ${label} bp`}
                      contentStyle={{ fontFamily: '"Courier New", monospace', fontSize: 11 }}
                      labelStyle={{ fontFamily: '"Courier New", monospace', fontWeight: 700 }}
                      itemStyle={{ fontFamily: '"Courier New", monospace' }}
                    />
                    <Legend />
                    {(['substitution', 'insertion', 'deletion'] as const).map((type) => (
                      <Scatter
                        key={type}
                        name={type.charAt(0).toUpperCase() + type.slice(1)}
                        data={mutationPoints.filter((point) => point.type === type)}
                        dataKey="y"
                        fill={
                          type === 'substitution'
                            ? CHART_COLORS.variant
                            : type === 'insertion'
                              ? CHART_COLORS.sage
                              : CHART_COLORS.blue
                        }
                        shape={type === 'substitution' ? 'circle' : type === 'insertion' ? 'triangle' : 'square'}
                        onClick={(point) => {
                          const mutation = (point.payload as MutationPlotPoint | undefined)?.mutation;
                          if (canSelectMutation && mutation) onSelectMutation?.(mutation);
                        }}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="bc-chart-unavailable">
                {isAnalysisCurrent ? 'No nucleotide differences were detected for this sequence pair.' : 'Mutation positions will appear after sequence comparison completes.'}
              </p>
            )}
          </article>

          <article className="bc-analysis-chart-card">
            <header className="bc-analysis-chart-header">
              <h3 className="bc-analysis-chart-title">4. Amino-Acid Property Changes</h3>
              <p>
                Per-substitution values calculated from translated residues: Kyte–Doolittle hydropathy, formal side-chain charge at pH 7.4, and monoisotopic residue mass.
              </p>
            </header>
            {proteinInterpretation?.status === 'available' && propertyChartData.length ? (
              <>
                <div className="bc-property-chart-grid">
                  <div className="bc-property-chart">
                    <h4 className="bc-analysis-chart-title">Hydropathy (Kyte–Doolittle)</h4>
                    <ResponsiveContainer width="100%" height={Math.max(190, Math.min(360, propertyChartData.length * 28 + 54))}>
                      <BarChart data={propertyChartData} layout="vertical" margin={{ top: 4, right: 8, left: 12, bottom: 22 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={['auto', 'auto']} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} label={{ value: 'Hydropathy index', position: 'insideBottom', offset: -14 }} />
                        <YAxis type="category" dataKey="mutation" width={58} tickLine={false} axisLine={false} />
                        <Tooltip content={<ScientificTooltip />} />
                        <Legend />
                        <Bar dataKey="reference" name="Reference" fill={CHART_COLORS.reference} barSize={8} />
                        <Bar dataKey="variant" name="Mutated" fill={CHART_COLORS.variant} barSize={8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bc-property-chart">
                    <h4 className="bc-analysis-chart-title">Side-chain charge (pH 7.4)</h4>
                    <ResponsiveContainer width="100%" height={Math.max(190, Math.min(360, propertyChartData.length * 28 + 54))}>
                      <BarChart data={propertyChartData} layout="vertical" margin={{ top: 4, right: 8, left: 12, bottom: 22 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[-1, 1]} ticks={[-1, 0, 1]} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} label={{ value: 'Formal side-chain charge', position: 'insideBottom', offset: -14 }} />
                        <YAxis type="category" dataKey="mutation" width={58} tickLine={false} axisLine={false} />
                        <Tooltip content={<ScientificTooltip />} />
                        <Legend />
                        <Bar dataKey="chargeReference" name="Reference" fill={CHART_COLORS.reference} barSize={8} />
                        <Bar dataKey="chargeVariant" name="Mutated" fill={CHART_COLORS.variant} barSize={8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bc-property-chart">
                    <h4 className="bc-analysis-chart-title">Molecular mass (Da)</h4>
                    <ResponsiveContainer width="100%" height={Math.max(190, Math.min(360, propertyChartData.length * 28 + 54))}>
                      <BarChart data={propertyChartData} layout="vertical" margin={{ top: 4, right: 8, left: 12, bottom: 22 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 'auto']} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} label={{ value: 'Monoisotopic residue mass (Da)', position: 'insideBottom', offset: -14 }} />
                        <YAxis type="category" dataKey="mutation" width={58} tickLine={false} axisLine={false} />
                        <Tooltip content={<ScientificTooltip />} />
                        <Legend />
                        <Bar dataKey="massReference" name="Reference" fill={CHART_COLORS.reference} barSize={8} />
                        <Bar dataKey="massVariant" name="Mutated" fill={CHART_COLORS.variant} barSize={8} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bc-property-chart">
                    <h4 className="bc-analysis-chart-title">Polarity class at changed positions</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={polarityData} margin={{ top: 4, right: 8, left: 4, bottom: 24 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="category" interval={0} angle={-15} textAnchor="end" height={55} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} label={{ value: 'Substitution count', angle: -90, position: 'insideLeft' }} />
                        <Tooltip content={<ScientificTooltip />} />
                        <Legend />
                        <Bar dataKey="reference" name="Reference" fill={CHART_COLORS.reference} />
                        <Bar dataKey="variant" name="Mutated" fill={CHART_COLORS.variant} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="bc-chart-footnote">
                  Polarity is qualitative; this plot counts reference and mutated residues in each documented class. Residue mass uses monoisotopic residue masses. Values describe biochemical differences, not functional outcomes.
                </p>
              </>
            ) : (
              <p className="bc-chart-unavailable">
                {proteinInterpretation?.status === 'available'
                  ? 'Translation is available, but this pair has no eligible amino-acid substitutions for property comparison.'
                  : 'Amino-acid property graphs are unavailable because a coding translation or biochemical substitution analysis was not returned.'}
              </p>
            )}
          </article>

          <article className="bc-analysis-chart-card">
            <header className="bc-analysis-chart-header">
              <h3 className="bc-analysis-chart-title">5. ML Mutation Compatibility Scores</h3>
              <p>
                {mlScoring?.model_name
                  ? `Model: ${mlScoring.model_name}. These scores compare amino-acid likelihood in the reference context.`
                  : 'Model-derived sequence-compatibility scores are not measured biological improvement or functional evidence.'}
              </p>
            </header>
            {modelScores.length > 0 && modelPreference ? (
              <>
                <div className="bc-model-verdict" data-direction={modelPreferenceDirection} role="status">
                  <span className="bc-model-verdict-label">Relative model readout</span>
                  <strong>{modelPreference}</strong>
                  <span>
                    Positive scores favor the variant residue; negative scores favor the reference residue. A small absolute score (≤0.05) is treated as close by this model.
                  </span>
                </div>
                <div className="bc-chart-canvas" role="img" aria-label={`Horizontal ${mlScoring?.model_name || 'protein model'} mutation scores centered on zero`}>
                <ResponsiveContainer width="100%" height={Math.max(220, Math.min(380, scoreChartData.length * 34 + 70))}>
                  <BarChart data={scoreChartData} layout="vertical" margin={{ top: 8, right: 18, left: 10, bottom: 28 }}>
                    <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[-maxScoreMagnitude, maxScoreMagnitude]}
                      tickLine={false}
                      axisLine={{ stroke: CHART_COLORS.grid }}
                      label={{ value: 'Variant − reference log-probability ratio', position: 'insideBottom', offset: -16 }}
                    />
                    <YAxis type="category" dataKey="mutation" width={72} tickLine={false} axisLine={false} />
                    <ReferenceLine x={0} stroke="#374151" strokeWidth={1.5} />
                    <Tooltip
                      content={<ScientificTooltip />}
                      formatter={(value) => [Number(value).toFixed(4), 'Model score']}
                    />
                    <Legend />
                    <Bar dataKey="positiveScore" name="Variant-favoured score" fill={CHART_COLORS.sage} />
                    <Bar dataKey="negativeScore" name="Reference-favoured score" fill={CHART_COLORS.variant} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="bc-chart-unavailable">
                {isAnalysisCurrent
                  ? mlScoring?.reason || (mlScoring?.status === 'not_applicable'
                    ? 'No model score is applicable to this pair (for example, synonymous changes leave the protein unchanged).'
                    : `No genuine per-mutation model scores were returned${mlScoring?.model_name ? ` by ${mlScoring.model_name}` : ''}. No scores are substituted or inferred.`)
                  : 'Model scores will appear only when the current sequence analysis returns genuine per-mutation inference results.'}
              </p>
            )}
            <p className="bc-chart-footnote">
              A model preference is not a verdict that either DNA sequence or protein is biologically “better.” These scores do not measure function, fitness, disease risk or clinical outcome; use an objective-specific validated predictor and experimental evidence for those claims.
            </p>
          </article>
        </div>

        {isAnalysisCurrent && variantIntelligence ? (
          <div className="rounded-none border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs text-[#171717]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-[#171717]">Integrated variant intelligence:</span>
              {Object.entries(variantIntelligence.layer_statuses || {}).map(([key, value]) => (
                <span
                  key={key}
                  className={`rounded-none border px-2 py-0.5 font-medium ${
                    value === 'available'
                      ? 'border-[#CCFBF1] bg-[#F0FDFA] text-[#0F766E]'
                      : value === 'not_applicable'
                        ? 'border-[#E5E5E5] bg-[#FFFFFF] text-[#737373]'
                        : value === 'unsupported_input'
                          ? 'border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]'
                          : value === 'failed'
                            ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                            : 'border-[#D8D2EB] bg-[#EFECF7] text-[#8175AA]'
                  }`}
                >
                  {key.replace('_', ' ')}: {String(value)}
                </span>
              ))}
            </div>

            <div className="font-medium text-[#171717]">
              {(isAnalysisCurrent && variantIntelligence?.integrated_explanation) || 'No integrated explanation available.'}
            </div>
          </div>
        ) : null}

        {analysisError && (
          <div className="rounded-none border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
            {analysisError}
          </div>
        )}

        <div className="border-t border-[#E5E5E5] pt-3 text-xs leading-relaxed text-[#737373]">
          <strong className="font-semibold text-[#171717]">Responsible interpretation:</strong>{' '}
          Sequence differences can suggest a protein-language-model preference or a physicochemical change, but they do not establish a biological outcome by themselves.
        </div>
      </div>

      {/* ===================================================================
          2. REFERENCE DNA & MUTATED DNA REPLACEMENT CONTROLS
      =================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#171717] font-mono uppercase tracking-wider">
              Replace DNA sequences
            </h3>
            <p className="mt-1 text-xs text-[#737373]">
              Provide or paste sequences. Whitespace and line breaks are automatically removed and bases converted to uppercase.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <TacticalButton
              type="button"
              variant="outline"
              size="sm"
              arrow={false}
              onClick={handleSwap}
              disabled={busy}
            >
              Swap
            </TacticalButton>
            <TacticalButton
              type="button"
              variant="outline"
              size="sm"
              arrow={false}
              onClick={handleReset}
              disabled={busy}
            >
              Reset
            </TacticalButton>
          </div>
        </div>

        {/* Input Textareas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Reference DNA Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="replace-reference-dna" className="text-xs font-semibold text-[#171717]">
                Reference DNA
              </label>
              <span className="text-xs tabular-nums text-[#737373]">
                {sanitizedRef.length} bp · GC: {calculateGC(sanitizedRef)}% · {Math.floor(sanitizedRef.length / 3)} codons
              </span>
            </div>
            <textarea
              id="replace-reference-dna"
              value={refInput}
              onChange={(e) => {
                setRefInput(e.target.value);
                setActionError(null);
              }}
              placeholder="Paste reference DNA sequence (A, T, G, C)…"
              rows={4}
              spellCheck={false}
              disabled={busy}
              className="w-full resize-y rounded-none border border-[#E5E5E5] bg-white p-3 font-mono text-xs leading-relaxed text-[#171717] placeholder-[#A3A3A3] focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] disabled:opacity-70"
            />
          </div>

          {/* Mutated DNA Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="replace-mutated-dna" className="text-xs font-semibold text-[#171717]">
                Mutated DNA
              </label>
              <span className="text-xs tabular-nums text-[#737373]">
                {sanitizedMut.length} bp · GC: {calculateGC(sanitizedMut)}% · {Math.floor(sanitizedMut.length / 3)} codons
              </span>
            </div>
            <textarea
              id="replace-mutated-dna"
              value={mutInput}
              onChange={(e) => {
                setMutInput(e.target.value);
                setActionError(null);
              }}
              placeholder="Paste mutated DNA sequence (A, T, G, C)…"
              rows={4}
              spellCheck={false}
              disabled={busy}
              className="w-full resize-y rounded-none border border-[#E5E5E5] bg-white p-3 font-mono text-xs leading-relaxed text-[#171717] placeholder-[#A3A3A3] focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] disabled:opacity-70"
            />
          </div>
        </div>

        {/* Feedback Alert Messages */}
        {actionError && (
          <div className="flex items-start gap-2.5 rounded-none border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#DC2626]" role="alert">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold text-[#DC2626]">Validation error</strong>
              <p className="mt-0.5">{actionError}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 rounded-none border border-[#CCFBF1] bg-[#F0FDFA] p-3 text-xs text-[#0F766E]" role="status">
            <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold text-[#0F766E]">Sequence updated</strong>
              <p className="mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap pt-1">
          {/* Primary Action 1: Replace Reference with Mutated DNA */}
          <TacticalButton
            type="button"
            variant="accent"
            size="md"
            arrow={false}
            onClick={handleReplaceReferenceWithMutated}
            disabled={busy || !sanitizedMut}
            loading={busy || isAnalyzing}
            loadingText={isAnalyzing ? 'Analysing…' : 'Processing…'}
          >
            Replace reference with mutated DNA
          </TacticalButton>

          {/* Primary Action 2: Update & Reanalyse Sequences */}
          <TacticalButton
            type="button"
            variant="outline"
            size="md"
            arrow={false}
            onClick={handleUpdateAndReanalyse}
            disabled={busy || !sanitizedRef || !sanitizedMut}
            loading={busy || isAnalyzing}
            loadingText={isAnalyzing ? 'Analysing…' : 'Reanalysing…'}
          >
            Update &amp; reanalyse sequences
          </TacticalButton>
        </div>
      </div>
    </section>
  );
};
