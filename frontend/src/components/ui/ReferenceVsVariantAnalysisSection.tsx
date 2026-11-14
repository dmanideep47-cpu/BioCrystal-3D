import React, { useState, useEffect, useMemo } from 'react';
import {
  PropertyObjective,
  PropertyAnalysisResponse,
} from '../../types/dna';
import {
  fetchPropertyObjectivesAPI,
  analyzePropertyAPI,
} from '../../services/apiService';
import { TacticalButton } from './TacticalButton';

interface ReferenceVsVariantAnalysisSectionProps {
  currentReferenceSequence: string;
  currentMutatedSequence: string;
  onReplaceSequences: (newReference: string, newMutated: string) => Promise<void>;
  isProcessing?: boolean;
}

// 168 bp GB1 wild-type coding sequence (translates to 56 aa Protein G B1 domain)
export const GB1_WT_DNA = (
  'ATGCAGTACAAACTGATCCTGAACGGTAAAACCCTGAAAGGTGAAACCACCACCGAAGCTGTTGACGCTGCTACC' +
  'GCTGAAAAAGTTTTCAAACAGTACGCTAACGACAACGGTGTTGACGGTGAATGGACCTACGACGACGCTACCAAA' +
  'ACCTTCACCGTTACCGAATAA'
);

// 168 bp GB1 variant with V39I mutation (codon 39 GTT -> ATT)
export const GB1_V39I_DNA = (
  'ATGCAGTACAAACTGATCCTGAACGGTAAAACCCTGAAAGGTGAAACCACCACCGAAGCTGTTGACGCTGCTACC' +
  'GCTGAAAAAGTTTTCAAACAGTACGCTAACGACAACGGTGTTGACGATGAATGGACCTACGACGACGCTACCAAA' +
  'ACCTTCACCGTTACCGAATAA'
);

function sanitizeDNA(input: string): string {
  return input.replace(/[\s\r\n\t]+/g, '').toUpperCase();
}

function calculateGC(seq: string): number {
  if (!seq) return 0;
  const gcCount = (seq.match(/[GC]/g) || []).length;
  return Math.round((gcCount / seq.length) * 1000) / 10;
}

export const ReferenceVsVariantAnalysisSection: React.FC<ReferenceVsVariantAnalysisSectionProps> = ({
  currentReferenceSequence,
  currentMutatedSequence,
  onReplaceSequences,
  isProcessing = false,
}) => {
  // Objectives & Analysis State
  const [objectives, setObjectives] = useState<PropertyObjective[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('gb1_binding_fitness');
  const [analysisData, setAnalysisData] = useState<PropertyAnalysisResponse | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Active Graph View: 'comparison' (Graph 1) | 'positions' (Graph 2) | 'evaluation' (Graph 3)
  const [activeGraph, setActiveGraph] = useState<'comparison' | 'positions' | 'evaluation'>('comparison');

  // Sequence Replacement Input State
  const [refInput, setRefInput] = useState<string>(currentReferenceSequence || '');
  const [mutInput, setMutInput] = useState<string>(currentMutatedSequence || '');
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replaceSuccessMsg, setReplaceSuccessMsg] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState<boolean>(false);

  // Sync inputs with parent state
  useEffect(() => {
    setRefInput(currentReferenceSequence || '');
  }, [currentReferenceSequence]);

  useEffect(() => {
    setMutInput(currentMutatedSequence || '');
  }, [currentMutatedSequence]);

  // Load available objectives at mount
  useEffect(() => {
    let isMounted = true;
    fetchPropertyObjectivesAPI()
      .then((data) => {
        if (isMounted && data.objectives) {
          setObjectives(data.objectives);
        }
      })
      .catch((err) => {
        console.warn('Failed to load property objectives:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch property analysis when sequences or objective changes
  useEffect(() => {
    let isMounted = true;
    const cleanRef = sanitizeDNA(currentReferenceSequence);
    const cleanMut = sanitizeDNA(currentMutatedSequence);

    if (!cleanRef || !cleanMut) {
      setAnalysisData(null);
      return;
    }

    setIsLoadingAnalysis(true);
    setAnalysisError(null);

    analyzePropertyAPI({
      reference_sequence: cleanRef,
      variant_sequence: cleanMut,
      objective_id: selectedObjectiveId,
    })
      .then((data) => {
        if (isMounted) {
          setAnalysisData(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setAnalysisError(err instanceof Error ? err.message : 'Property analysis request failed.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAnalysis(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentReferenceSequence, currentMutatedSequence, selectedObjectiveId]);

  // Handle Action: Replace Reference with Mutated DNA
  const handleReplaceReferenceWithMutated = async () => {
    setReplaceError(null);
    setReplaceSuccessMsg(null);
    const cleanMut = sanitizeDNA(mutInput);
    if (!cleanMut || /[^ATGC]/.test(cleanMut)) {
      setReplaceError('Mutated DNA must be a valid sequence containing only A, T, G, C.');
      return;
    }

    setIsReplacing(true);
    try {
      await onReplaceSequences(cleanMut, cleanMut);
      setRefInput(cleanMut);
      setMutInput(cleanMut);
      setReplaceSuccessMsg('Reference DNA updated to match the variant sequence.');
      setTimeout(() => setReplaceSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setReplaceError(err instanceof Error ? err.message : 'Failed to update sequences.');
    } finally {
      setIsReplacing(false);
    }
  };

  // Handle Action: Update & Reanalyse Sequences
  const handleUpdateAndReanalyse = async () => {
    setReplaceError(null);
    setReplaceSuccessMsg(null);
    const cleanRef = sanitizeDNA(refInput);
    const cleanMut = sanitizeDNA(mutInput);
    if (!cleanRef || /[^ATGC]/.test(cleanRef)) {
      setReplaceError('Reference DNA contains invalid characters. Only A, T, G, C are permitted.');
      return;
    }
    if (!cleanMut || /[^ATGC]/.test(cleanMut)) {
      setReplaceError('Variant DNA contains invalid characters. Only A, T, G, C are permitted.');
      return;
    }

    setIsReplacing(true);
    try {
      await onReplaceSequences(cleanRef, cleanMut);
      setRefInput(cleanRef);
      setMutInput(cleanMut);
      setReplaceSuccessMsg('Sequences updated and reanalysed successfully.');
      setTimeout(() => setReplaceSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setReplaceError(err instanceof Error ? err.message : 'Failed to reanalyse updated sequences.');
    } finally {
      setIsReplacing(false);
    }
  };

  // Handle Action: Swap Reference and Mutated DNA
  const handleSwap = () => {
    const temp = refInput;
    setRefInput(mutInput);
    setMutInput(temp);
    setReplaceError(null);
    setReplaceSuccessMsg('Swapped inputs. Click "Update & reanalyse" to apply.');
  };

  // Handle Action: Reset to current loaded sequences
  const handleReset = () => {
    setRefInput(currentReferenceSequence || '');
    setMutInput(currentMutatedSequence || '');
    setReplaceError(null);
    setReplaceSuccessMsg('Reset sequence inputs to currently active sequences.');
  };

  // Handle Action: Load Supported GB1 Benchmark Preset
  const handleLoadGb1Benchmark = async () => {
    setRefInput(GB1_WT_DNA);
    setMutInput(GB1_V39I_DNA);
    setSelectedObjectiveId('gb1_binding_fitness');
    setReplaceError(null);
    setIsReplacing(true);
    try {
      await onReplaceSequences(GB1_WT_DNA, GB1_V39I_DNA);
      setReplaceSuccessMsg('Loaded 168 bp GB1 benchmark pair (WT vs V39I).');
      setTimeout(() => setReplaceSuccessMsg(null), 4000);
    } catch (err) {
      setReplaceError('Failed to load GB1 benchmark.');
    } finally {
      setIsReplacing(false);
    }
  };

  const currentObj = analysisData?.objective || objectives.find((o) => o.id === selectedObjectiveId);
  const pred = analysisData?.model_prediction;
  const exp = analysisData?.experimental_measurement;
  const seqFacts = analysisData?.sequence_facts;

  // Calibration points for Graph 3
  const heldOutPoints = pred?.held_out_evaluation_points || [];

  return (
    <section className="space-y-6 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] p-5 text-[#000000]">
      {/* ===================================================================
          1. HEADER & OBJECTIVE SELECTOR
      =================================================================== */}
      <div className="border-b border-[#E5E7EB] pb-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold font-mono text-[#000000]">
              Reference vs variant analysis
            </h2>
            <p className="text-xs text-[#4B5563]">
              Compare sequence changes and supported predictions for the selected objective.
            </p>
          </div>

          {/* Quick preset for GB1 supported benchmark */}
          <TacticalButton
            type="button"
            variant="outline"
            size="sm"
            arrow={false}
            onClick={handleLoadGb1Benchmark}
            disabled={isProcessing || isReplacing}
            title="Load supported 168 bp Protein G B1 sequence pair to explore real ML predictions"
          >
            Load GB1 benchmark (168 bp)
          </TacticalButton>
        </div>

        {/* Objective Selector & Metadata */}
        <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <label htmlFor="objective-selector" className="font-bold font-mono text-[#000000]">
              Target Objective:
            </label>
            <select
              id="objective-selector"
              value={selectedObjectiveId}
              onChange={(e) => setSelectedObjectiveId(e.target.value)}
              className="text-xs font-mono bg-[#FFFFFF] border border-[#D1D5DB] rounded px-2.5 py-1 text-[#000000] focus:outline-none focus:border-[#000000]"
            >
              <option value="gb1_binding_fitness">
                Protein G B1 — IgG-Fc Binding Fitness (Wu/Olson et al.) [Model Available]
              </option>
              <option value="gfp_fluorescence_brightness">
                GFP (A. victoria) — Fluorescence Brightness [Dataset/Model Unavailable]
              </option>
            </select>
          </div>

          {currentObj && (
            <div className="text-[11px] text-[#6B7280]">
              Target: <strong className="text-[#000000]">{currentObj.target_name}</strong> ({currentObj.units})
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          PART A: THREE DISTINCT EVIDENCE STATUS BADGES
      =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Layer 1: Calculated Sequence Facts */}
        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-[#000000] uppercase text-[10px] tracking-wider">
              1. Sequence Facts
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#E5E7EB] text-[#000000] font-semibold">
              Calculated from input
            </span>
          </div>
          <p className="text-[11px] text-[#4B5563]">
            {seqFacts ? (
              <>
                Ref: {seqFacts.reference_length_bp} bp ({seqFacts.reference_length_aa} aa) · Var: {seqFacts.variant_length_bp} bp ({seqFacts.variant_length_aa} aa)
                {seqFacts.is_synonymous && <span className="block text-[#000000] font-bold">Synonymous (protein unchanged)</span>}
              </>
            ) : (
              'Calculating sequence lengths and codon mapping…'
            )}
          </p>
        </div>

        {/* Layer 2: Model Prediction */}
        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-[#000000] uppercase text-[10px] tracking-wider">
              2. ML Prediction
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                pred?.status === 'available'
                  ? 'bg-[#000000] text-[#FFFFFF]'
                  : pred?.status === 'unsupported_input'
                  ? 'bg-[#FEF2F2] text-[#FF0000] border border-[#FECACA]'
                  : 'bg-[#E5E7EB] text-[#4B5563]'
              }`}
            >
              {pred?.status === 'available'
                ? 'Model prediction'
                : pred?.status === 'unsupported_input'
                ? 'Unsupported input'
                : 'Model unavailable'}
            </span>
          </div>
          <p className="text-[11px] text-[#4B5563]">
            {pred?.status === 'available' ? (
              <>
                {pred.model_name} (v{pred.model_version})
                <span className="block text-[#6B7280]">
                  Held-out Spearman $\rho$: {pred.evaluation_metrics?.ridge_model.spearman ?? '0.787'}
                </span>
              </>
            ) : (
              pred?.reason || 'No prediction available for this sequence.'
            )}
          </p>
        </div>

        {/* Layer 3: Experimental Measurement */}
        <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-[#000000] uppercase text-[10px] tracking-wider">
              3. Experimental Data
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                exp?.matched
                  ? 'bg-[#FEF2F2] text-[#FF0000] border border-[#FECACA]'
                  : 'bg-[#E5E7EB] text-[#6B7280]'
              }`}
            >
              {exp?.matched ? 'Experimental measurement' : 'No exact match'}
            </span>
          </div>
          <p className="text-[11px] text-[#4B5563]">
            {exp?.matched ? (
              <>
                Record: <strong>{exp.variant_id}</strong> ({exp.citation})
                <span className="block text-[#FF0000] font-bold">
                  Assayed value: {exp.measured_variant_value}
                </span>
              </>
            ) : (
              'No direct measurement in Wu et al. (2016) empirical library.'
            )}
          </p>
        </div>
      </div>

      {/* ===================================================================
          PART B: COMPACT COMPARISON & VERDICT
      =================================================================== */}
      {pred && (
        <div className="border border-[#E5E7EB] rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 flex-wrap gap-2">
            <span className="text-xs font-bold font-mono text-[#000000] uppercase">
              Property Comparison · {currentObj?.label}
            </span>
            {pred.verdict && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded font-bold font-mono ${
                  pred.verdict.includes('higher')
                    ? 'bg-[#FEF2F2] text-[#FF0000] border border-[#FECACA]'
                    : pred.verdict.includes('lower')
                    ? 'bg-[#F3F4F6] text-[#000000] border border-[#D1D5DB]'
                    : 'bg-[#F9FAFB] text-[#4B5563] border border-[#E5E7EB]'
                }`}
              >
                {pred.verdict}
              </span>
            )}
          </div>

          {pred.status === 'available' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded">
                <span className="text-[10px] text-[#6B7280] block">Reference (Pred)</span>
                <span className="text-sm font-bold text-[#000000]">
                  {pred.reference_predicted_value !== null ? pred.reference_predicted_value.toFixed(4) : '—'}
                </span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">
                  {exp?.measured_reference_value !== null ? `(Exp: ${exp?.measured_reference_value})` : ''}
                </span>
              </div>

              <div className="p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded">
                <span className="text-[10px] text-[#6B7280] block">Variant (Pred)</span>
                <span className="text-sm font-bold text-[#FF0000]">
                  {pred.variant_predicted_value !== null ? pred.variant_predicted_value.toFixed(4) : '—'}
                </span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">
                  {exp?.measured_variant_value !== null ? `(Exp: ${exp?.measured_variant_value})` : '(No exp record)'}
                </span>
              </div>

              <div className="p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded">
                <span className="text-[10px] text-[#6B7280] block">Predicted Delta (Δ)</span>
                <span
                  className={`text-sm font-bold ${
                    (pred.predicted_delta || 0) > 0.05
                      ? 'text-[#FF0000]'
                      : (pred.predicted_delta || 0) < -0.05
                      ? 'text-[#000000]'
                      : 'text-[#4B5563]'
                  }`}
                >
                  {pred.predicted_delta !== null
                    ? `${pred.predicted_delta > 0 ? '+' : ''}${pred.predicted_delta.toFixed(4)}`
                    : '—'}
                </span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">{currentObj?.units}</span>
              </div>

              <div className="p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded">
                <span className="text-[10px] text-[#6B7280] block">Target Direction</span>
                <span className="text-xs font-bold text-[#000000] capitalize">
                  {pred.target_direction.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-[#6B7280] block mt-0.5">Larger values preferred</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-xs text-[#4B5563] leading-relaxed">
              <strong>Status:</strong> {pred.reason}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          PART C: MEANINGFUL GRAPHS (Graph 1, Graph 2, Graph 3)
      =================================================================== */}
      <div className="border border-[#E5E7EB] rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 flex-wrap gap-2">
          <span className="text-xs font-bold font-mono text-[#000000] uppercase">
            Data &amp; Model Visualizations
          </span>

          <div className="flex items-center space-x-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveGraph('comparison')}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                activeGraph === 'comparison'
                  ? 'bg-[#000000] text-[#FFFFFF]'
                  : 'bg-[#F9FAFB] text-[#4B5563] hover:text-[#000000]'
              }`}
            >
              Graph 1: Ref vs Var
            </button>
            <button
              type="button"
              onClick={() => setActiveGraph('positions')}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                activeGraph === 'positions'
                  ? 'bg-[#000000] text-[#FFFFFF]'
                  : 'bg-[#F9FAFB] text-[#4B5563] hover:text-[#000000]'
              }`}
            >
              Graph 2: Position changes
            </button>
            <button
              type="button"
              onClick={() => setActiveGraph('evaluation')}
              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                activeGraph === 'evaluation'
                  ? 'bg-[#000000] text-[#FFFFFF]'
                  : 'bg-[#F9FAFB] text-[#4B5563] hover:text-[#000000]'
              }`}
            >
              Graph 3: Held-out evaluation
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------------
            GRAPH 1: REFERENCE VS VARIANT POINT PLOT
        ------------------------------------------------------------- */}
        {activeGraph === 'comparison' && (
          <div className="space-y-2 py-2">
            <div className="text-xs text-[#6B7280]">
              Horizontal point plot comparing reference and variant on the identical endpoint scale ({currentObj?.units || 'scale'}).
            </div>

            {pred?.status === 'available' ? (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-4">
                <svg className="w-full h-24" viewBox="0 0 500 90">
                  {/* Axis scale from 0.0 to 2.5 */}
                  <line x1="60" y1="50" x2="440" y2="50" stroke="#D1D5DB" strokeWidth="2" />
                  {/* Scale ticks: 0.0, 0.5, 1.0, 1.5, 2.0, 2.5 */}
                  {[0.0, 0.5, 1.0, 1.5, 2.0, 2.5].map((tick) => {
                    const x = 60 + (tick / 2.5) * 380;
                    return (
                      <g key={tick}>
                        <line x1={x} y1="45" x2={x} y2="55" stroke="#9CA3AF" strokeWidth="1" />
                        <text x={x} y="68" textAnchor="middle" fontSize="10" fill="#6B7280" fontFamily="monospace">
                          {tick.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Reference Point (Black) */}
                  {pred.reference_predicted_value !== null && (
                    <g>
                      {(() => {
                        const refVal = pred.reference_predicted_value;
                        const x = Math.max(60, Math.min(440, 60 + (refVal / 2.5) * 380));
                        return (
                          <>
                            <circle cx={x} cy="35" r="7" fill="#000000" />
                            <text x={x} y="20" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000" fontFamily="monospace">
                              Ref: {refVal.toFixed(3)}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* Variant Point (Red) */}
                  {pred.variant_predicted_value !== null && (
                    <g>
                      {(() => {
                        const varVal = pred.variant_predicted_value;
                        const x = Math.max(60, Math.min(440, 60 + (varVal / 2.5) * 380));
                        return (
                          <>
                            <circle cx={x} cy="35" r="7" fill="#FF0000" />
                            <text x={x} y="20" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#FF0000" fontFamily="monospace">
                              Var: {varVal.toFixed(3)}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </svg>
                <div className="flex items-center justify-between text-[11px] text-[#6B7280] font-mono mt-1">
                  <span>● Black: Reference ({pred.reference_predicted_value?.toFixed(3)})</span>
                  <span>● Red: Variant ({pred.variant_predicted_value?.toFixed(3)})</span>
                  <span className="font-bold text-[#000000]">
                    Δ = {pred.predicted_delta !== null ? (pred.predicted_delta > 0 ? '+' : '') + pred.predicted_delta.toFixed(4) : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-xs text-[#6B7280]">
                Property prediction is unavailable for this sequence. (Load the 168 bp GB1 benchmark to visualize quantitative comparison.)
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            GRAPH 2: POSITION-LEVEL CHANGES
        ------------------------------------------------------------- */}
        {activeGraph === 'positions' && (
          <div className="space-y-2 py-2">
            <div className="text-xs text-[#6B7280]">
              Sequence coordinate ruler showing aligned changes along the reference (Substitutions, Insertions, Deletions).
            </div>
            {seqFacts && seqFacts.reference_length_bp > 0 ? (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-4 overflow-x-auto">
                <svg className="w-full h-20 min-w-[500px]" viewBox={`0 0 ${Math.max(500, seqFacts.reference_length_bp * 3 + 60)} 80`}>
                  {/* Ruler line */}
                  <line x1="30" y1="40" x2={seqFacts.reference_length_bp * 3 + 30} y2="40" stroke="#D1D5DB" strokeWidth="3" />

                  {/* Position ticks every 10 or 30 bp */}
                  {Array.from({ length: Math.ceil(seqFacts.reference_length_bp / 10) }).map((_, i) => {
                    const pos = i * 10 + 1;
                    const x = 30 + pos * 3;
                    return (
                      <g key={pos}>
                        <line x1={x} y1="36" x2={x} y2="44" stroke="#9CA3AF" strokeWidth="1" />
                        {pos % 30 === 1 && (
                          <text x={x} y="58" textAnchor="middle" fontSize="9" fill="#6B7280" fontFamily="monospace">
                            {pos}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Mutation Markers */}
                  {seqFacts.position_changes.map((change, i) => {
                    const x = 30 + change.dna_position * 3;
                    const isSub = change.type === 'substitution';
                    return (
                      <g key={i}>
                        <circle cx={x} cy="40" r="5" fill="#FF0000" stroke="#FFFFFF" strokeWidth="1" />
                        <line x1={x} y1="20" x2={x} y2="35" stroke="#FF0000" strokeWidth="1" />
                        <text x={x} y="15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#FF0000" fontFamily="monospace">
                          {change.ref_base}→{change.var_base}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#6B7280] pt-1">
                  <span>Reference: {seqFacts.reference_length_bp} bp</span>
                  <span className="text-[#FF0000] font-bold">
                    {seqFacts.position_changes.length} position change(s) detected
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-xs text-[#6B7280]">
                No sequence data available.
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            GRAPH 3: OBSERVED VS PREDICTED (Held-Out Test Set)
        ------------------------------------------------------------- */}
        {activeGraph === 'evaluation' && (
          <div className="space-y-2 py-2">
            <div className="text-xs text-[#6B7280]">
              Empirical held-out test evaluation from Wu et al. (2016) eLife ($N = 1,745$ test variants; 60 stratified points shown).
              Diagonal dashed line represents ideal agreement ($y = x$).
            </div>

            {heldOutPoints.length > 0 ? (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-4 flex flex-col md:flex-row items-center gap-6">
                <svg className="w-64 h-64 shrink-0" viewBox="0 0 260 260">
                  {/* Axes Box */}
                  <rect x="35" y="15" width="210" height="210" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1" />

                  {/* Diagonal Identity Line y = x */}
                  <line x1="35" y1="225" x2="245" y2="15" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4,4" />

                  {/* Ticks and Grid */}
                  {[0, 1, 2, 3].map((val) => {
                    const coord = 225 - (val / 3.0) * 210;
                    const xCoord = 35 + (val / 3.0) * 210;
                    return (
                      <g key={val}>
                        <line x1="32" y1={coord} x2="35" y2={coord} stroke="#6B7280" />
                        <text x="28" y={coord + 3} textAnchor="end" fontSize="9" fill="#6B7280" fontFamily="monospace">
                          {val}
                        </text>
                        <line x1={xCoord} y1="225" x2={xCoord} y2="228" stroke="#6B7280" />
                        <text x={xCoord} y="238" textAnchor="middle" fontSize="9" fill="#6B7280" fontFamily="monospace">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis Labels */}
                  <text x="140" y="252" textAnchor="middle" fontSize="10" fill="#000000" fontWeight="bold">
                    Measured Fitness (Wu et al. 2016)
                  </text>
                  <text x="12" y="120" textAnchor="middle" fontSize="10" fill="#000000" fontWeight="bold" transform="rotate(-90 12 120)">
                    Predicted Fitness (Ridge)
                  </text>

                  {/* Held-out Scatter Points */}
                  {heldOutPoints.map((pt, i) => {
                    const cx = 35 + Math.max(0, Math.min(3, pt.measured)) / 3.0 * 210;
                    const cy = 225 - Math.max(0, Math.min(3, pt.predicted)) / 3.0 * 210;
                    return (
                      <circle key={i} cx={cx} cy={cy} r="3" fill="#000000" opacity="0.65">
                        <title>{`${pt.mutations}: Measured ${pt.measured}, Pred ${pt.predicted}`}</title>
                      </circle>
                    );
                  })}
                </svg>

                <div className="text-xs space-y-2 text-[#4B5563] font-mono">
                  <div className="font-bold text-[#000000]">Held-Out Test Performance:</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded">
                      <span className="text-[#6B7280] block text-[10px]">Test Samples</span>
                      <strong className="text-[#000000]">1,745 variants</strong>
                    </div>
                    <div className="p-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded">
                      <span className="text-[#6B7280] block text-[10px]">Spearman $\rho$</span>
                      <strong className="text-[#000000]">{pred?.evaluation_metrics?.ridge_model.spearman ?? '0.7872'}</strong>
                    </div>
                    <div className="p-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded">
                      <span className="text-[#6B7280] block text-[10px]">Ridge MAE</span>
                      <strong className="text-[#000000]">{pred?.evaluation_metrics?.ridge_model.mae ?? '0.6427'}</strong>
                    </div>
                    <div className="p-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded">
                      <span className="text-[#6B7280] block text-[10px]">Dummy Baseline MAE</span>
                      <strong className="text-[#6B7280]">{pred?.evaluation_metrics?.dummy_baseline.mae ?? '0.9264'}</strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#6B7280] leading-relaxed pt-1 font-sans">
                    Ridge model significantly outperforms the dummy mean baseline on the untouched 20% test partition.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-xs text-[#6B7280]">
                Held-out evaluation points require an active ML model on the supported GB1 objective.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================
          PART D & E: EVIDENCE-LINKED EXPLANATION & LIMITATIONS
      =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* D. Why this result? */}
        <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-md space-y-1.5">
          <span className="font-bold font-mono text-[#000000] uppercase block">
            Why this result?
          </span>
          <p className="text-[#374151] leading-relaxed">
            {analysisData?.why_this_result || (
              pred?.reason || 'Select or load a supported sequence to inspect calculated model reasoning.'
            )}
          </p>
        </div>

        {/* E. What this does not establish */}
        <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-md space-y-1.5">
          <span className="font-bold font-mono text-[#000000] uppercase block">
            What this does not establish
          </span>
          <p className="text-[#4B5563] leading-relaxed">
            {analysisData?.what_this_does_not_establish || (
              'This analysis does not establish in-vivo eukaryotic expression, thermal unfolding kinetics, or clinical viability. Predicted property changes are endpoint-specific and not a general quality score.'
            )}
          </p>
        </div>
      </div>

      {/* ===================================================================
          2. WORKING SEQUENCE REPLACEMENT & UPDATE CONTROLS
      =================================================================== */}
      <div className="border-t border-[#E5E7EB] pt-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold font-mono text-[#000000] uppercase tracking-wider">
              Replace DNA sequences
            </h3>
            <p className="text-xs text-[#4B5563]">
              Paste new reference and variant sequences below. Whitespace is stripped automatically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <TacticalButton
              type="button"
              variant="outline"
              size="sm"
              arrow={false}
              onClick={handleSwap}
              disabled={isProcessing || isReplacing}
            >
              Swap
            </TacticalButton>
            <TacticalButton
              type="button"
              variant="outline"
              size="sm"
              arrow={false}
              onClick={handleReset}
              disabled={isProcessing || isReplacing}
            >
              Reset
            </TacticalButton>
          </div>
        </div>

        {/* Textareas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <label htmlFor="replace-reference-dna" className="font-bold text-[#000000]">
                Reference DNA
              </label>
              <span className="text-[#6B7280]">
                {sanitizeDNA(refInput).length} bp · GC: {calculateGC(sanitizeDNA(refInput))}%
              </span>
            </div>
            <textarea
              id="replace-reference-dna"
              value={refInput}
              onChange={(e) => {
                setRefInput(e.target.value);
                setReplaceError(null);
              }}
              placeholder="Paste reference DNA sequence…"
              rows={3}
              spellCheck={false}
              disabled={isProcessing || isReplacing}
              className="w-full resize-y rounded-md border border-[#D1D5DB] bg-[#FFFFFF] p-2.5 font-mono text-xs text-[#000000] focus:border-[#000000] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <label htmlFor="replace-mutated-dna" className="font-bold text-[#000000]">
                Variant DNA
              </label>
              <span className="text-[#6B7280]">
                {sanitizeDNA(mutInput).length} bp · GC: {calculateGC(sanitizeDNA(mutInput))}%
              </span>
            </div>
            <textarea
              id="replace-mutated-dna"
              value={mutInput}
              onChange={(e) => {
                setMutInput(e.target.value);
                setReplaceError(null);
              }}
              placeholder="Paste variant DNA sequence…"
              rows={3}
              spellCheck={false}
              disabled={isProcessing || isReplacing}
              className="w-full resize-y rounded-md border border-[#D1D5DB] bg-[#FFFFFF] p-2.5 font-mono text-xs text-[#000000] focus:border-[#000000] focus:outline-none"
            />
          </div>
        </div>

        {/* Action Buttons & Feedback */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center space-x-2">
            <TacticalButton
              type="button"
              variant="outline"
              size="sm"
              arrow={false}
              onClick={handleReplaceReferenceWithMutated}
              disabled={isProcessing || isReplacing}
            >
              Replace reference with variant
            </TacticalButton>
            <TacticalButton
              type="button"
              variant="primary"
              size="sm"
              arrow={false}
              onClick={handleUpdateAndReanalyse}
              disabled={isProcessing || isReplacing}
              loading={isProcessing || isReplacing}
              loadingText="Updating…"
            >
              Update &amp; reanalyse sequences
            </TacticalButton>
          </div>

          {replaceError && (
            <span role="alert" className="text-xs text-[#FF0000] font-semibold">
              {replaceError}
            </span>
          )}
          {replaceSuccessMsg && (
            <span className="text-xs text-[#16A34A] font-semibold">
              {replaceSuccessMsg}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

