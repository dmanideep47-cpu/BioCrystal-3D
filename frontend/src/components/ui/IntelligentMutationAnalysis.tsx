import React, { useState, useEffect, useMemo } from 'react';
import {
  Dna,
  Binary,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Download,
  Boxes,
  FileCode,
  RotateCcw,
  Sparkles,
  X,
  Sliders,
} from 'lucide-react';
import {
  AlignmentMutation,
  CorrectionCandidate,
  ExploratoryAnalysisResult,
  CompareResult,
  MutationDiff,
} from '../../types/dna';
import {
  validateDNASequence,
  compareSequences,
  annotateSequence,
  getCorrectionCandidates,
} from '../../services/bioinformatics';
import './IntelligentMutationAnalysis.css';

interface IntelligentMutationAnalysisProps {
  currentSequence: string;
  referenceSequence: string | null;
  onApplySequence: (newSeq: string, refSeq?: string, activeDiff?: MutationDiff | null) => void;
  onSelectPosition: (pos: number) => void;
  onNavigateTo3D: () => void;
  onNavigateToComparison: () => void;
}

export const IntelligentMutationAnalysis: React.FC<IntelligentMutationAnalysisProps> = ({
  currentSequence,
  referenceSequence,
  onApplySequence,
  onSelectPosition,
  onNavigateTo3D,
  onNavigateToComparison,
}) => {
  // Input sequence state
  const [obsInput, setObsInput] = useState<string>(currentSequence);
  const [refInput, setRefInput] = useState<string>(referenceSequence || 'ATGGCTACTGGTTAA');
  const [useReference, setUseReference] = useState<boolean>(true);
  const [readingFrame, setReadingFrame] = useState<number>(0); // 0, 1, 2 (+1, +2, +3)

  // Optimization constraints
  const [targetGcMin, setTargetGcMin] = useState<number>(40);
  const [targetGcMax, setTargetGcMax] = useState<number>(60);
  const [preserveProtein, setPreserveProtein] = useState<boolean>(true);

  // Analysis result state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [exploratoryResult, setExploratoryResult] = useState<ExploratoryAnalysisResult | null>(null);
  const [candidatesList, setCandidatesList] = useState<CorrectionCandidate[]>([]);
  const [selectedMutation, setSelectedMutation] = useState<AlignmentMutation | null>(null);

  // Confirmation modal state
  const [candidateToApply, setCandidateToApply] = useState<CorrectionCandidate | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Quick initial validation
  const obsValidation = useMemo(() => validateDNASequence(obsInput), [obsInput]);
  const refValidation = useMemo(() => validateDNASequence(refInput), [refInput]);

  // Execute Analysis
  const runAnalysis = async () => {
    setIsLoading(true);
    setSelectedMutation(null);
    try {
      if (useReference && refInput.trim()) {
        // MODE A: Reference-based detection
        const comp = await compareSequences(refInput.trim(), obsInput.trim(), readingFrame);
        setCompareResult(comp);
        setExploratoryResult(null);

        // Also fetch candidate recommendations
        const rec = await getCorrectionCandidates(
          obsInput.trim(),
          refInput.trim(),
          readingFrame,
          { target_gc_min: targetGcMin, target_gc_max: targetGcMax, preserve_protein: preserveProtein }
        );
        setCandidatesList(rec.candidates || []);
        if (comp.alignment.mutations.length > 0) {
          setSelectedMutation(comp.alignment.mutations[0]);
          onSelectPosition(comp.alignment.mutations[0].reference_position);
        }
      } else {
        // MODE B: Sequence-only exploratory analysis
        const expl = await annotateSequence(obsInput.trim());
        setExploratoryResult(expl);
        setCompareResult(null);

        // Also fetch candidate recommendations (synonymous alternatives)
        const rec = await getCorrectionCandidates(
          obsInput.trim(),
          undefined,
          readingFrame,
          { target_gc_min: targetGcMin, target_gc_max: targetGcMax, preserve_protein: preserveProtein }
        );
        setCandidatesList(rec.candidates || []);
      }
    } catch (err) {
      console.error('Analysis failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run on mount or sequence change
  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle FASTA upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'obs' | 'ref') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (target === 'obs') {
        setObsInput(text);
      } else {
        setRefInput(text);
      }
    };
    reader.readAsText(file);
  };

  // Confirm applying a candidate
  const handleConfirmApply = () => {
    if (!candidateToApply) return;
    const targetSeq = candidateToApply.sequence;
    const activeRef = useReference && refInput.trim() ? refInput.trim() : targetSeq;

    let activeDiff: MutationDiff | null = null;
    if (activeRef !== targetSeq && candidateToApply.edits_detail.length > 0) {
      activeDiff = {
        type: 'substitution',
        position: selectedMutation ? selectedMutation.reference_position : 1,
        originalBase: selectedMutation ? selectedMutation.original_base : 'T',
        newBase: selectedMutation ? selectedMutation.observed_base : 'G',
        originalSequence: activeRef,
        mutatedSequence: targetSeq,
        category: 'synonymous',
        categoryLabel: 'Candidate Applied',
        description: candidateToApply.rationale,
        readingFrameShift: 0,
      };
    }

    onApplySequence(targetSeq, activeRef, activeDiff);
    setObsInput(targetSeq);
    setCandidateToApply(null);
  };

  // Download PDF Report
  const handleDownloadPDF = async () => {
    try {
      setExportNotice('Generating report...');
      const payload = {
        original_sequence: obsInput.trim(),
        reference_sequence: useReference && refInput.trim() ? refInput.trim() : null,
        gc_percent: obsValidation.gcPercent,
        at_percent: obsValidation.atPercent,
        melting_temp: obsValidation.meltingTemperature,
        molecular_weight_kda: obsValidation.molecularWeightKDa,
        mutations_list: compareResult ? compareResult.alignment.mutations : null,
        candidates: candidatesList,
      };

      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BioCrystal3D_DNA_Mutation_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      setExportNotice('Report downloaded successfully!');
      setTimeout(() => setExportNotice(null), 3000);
    } catch {
      setExportNotice('Failed to generate report.');
      setTimeout(() => setExportNotice(null), 3000);
    }
  };

  return (
    <div className="ima-container">
      {/* Top Header */}
      <div className="ima-header">
        <div className="ima-title-area">
          <h2>
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Intelligent Mutation Detection & Candidate Correction Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Scientific pairwise alignment, mutation consequence classification, and multi-strategy candidate sequence optimization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exportNotice && (
            <span className="text-xs font-mono text-cyan-400 animate-pulse">{exportNotice}</span>
          )}
          <button
            onClick={handleDownloadPDF}
            className="ima-button ima-button-secondary"
            title="Download SwissADME-style Scientific PDF Report"
          >
            <Download className="w-4 h-4" /> Export Report (PDF)
          </button>
          <button
            onClick={onNavigateTo3D}
            className="ima-button ima-button-primary"
            title="Inspect current sequence and mutation in 3D"
          >
            <Boxes className="w-4 h-4" /> 3D Helix Viewer
          </button>
          <button
            onClick={onNavigateToComparison}
            className="ima-button ima-button-amber"
            title="Inspect side-by-side split screen comparison"
          >
            <GitCompare className="w-4 h-4" /> Split Comparison
          </button>
        </div>
      </div>

      {/* Grid Top: Sequence Inputs & Biophysical Overview */}
      <div className="ima-grid ima-grid-top">
        {/* Section A: Sequence Input */}
        <div className="ima-panel">
          <div className="ima-panel-header">
            <span className="ima-panel-title">
              <FileCode className="w-4 h-4 text-cyan-400" /> Section A: Sequence & Reference Input
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useReference}
                  onChange={(e) => setUseReference(e.target.checked)}
                  className="rounded text-cyan-500"
                />
                Reference Mode
              </label>
            </div>
          </div>
          <div className="ima-panel-body">
            {/* Observed Sequence */}
            <div className="ima-input-row">
              <div className="ima-label">
                <span>Observed / Variant DNA Sequence (5' &rarr; 3')</span>
                <span className="font-mono text-xs">{obsValidation.length} bp</span>
              </div>
              <textarea
                value={obsInput}
                onChange={(e) => setObsInput(e.target.value)}
                placeholder="Enter DNA sequence (e.g. ATGGCTACGGGTTAA) or upload FASTA..."
                className="ima-textarea"
                rows={3}
              />
              <div className="flex justify-between items-center text-xs text-slate-400">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setObsInput('ATGGCTACTGGTTAA')}
                    className="hover:text-cyan-400 underline cursor-pointer"
                  >
                    Sample Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setObsInput('ATGGCTACGGGTTAA')}
                    className="hover:text-amber-400 underline cursor-pointer"
                  >
                    Sample T9G
                  </button>
                </div>
                <label className="hover:text-slate-200 cursor-pointer">
                  Upload FASTA
                  <input
                    type="file"
                    accept=".fasta,.fa,.txt"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'obs')}
                  />
                </label>
              </div>
            </div>

            {/* Reference Sequence (Optional) */}
            {useReference && (
              <div className="ima-input-row">
                <div className="ima-label">
                  <span className="text-cyan-400">Reference Wild-Type Sequence (for Alignment)</span>
                  <span className="font-mono text-xs">{refValidation.length} bp</span>
                </div>
                <textarea
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="Enter reference sequence (e.g. ATGGCTACTGGTTAA)..."
                  className="ima-textarea"
                  rows={2}
                />
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => setRefInput('ATGGCTACTGGTTAA')}
                    className="hover:text-cyan-400 underline cursor-pointer"
                  >
                    Set Canonical Reference
                  </button>
                  <label className="hover:text-slate-200 cursor-pointer">
                    Upload Ref FASTA
                    <input
                      type="file"
                      accept=".fasta,.fa,.txt"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'ref')}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Reading Frame & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#252d3a]">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Reading Frame:</span>
                {[0, 1, 2].map((f) => (
                  <button
                    key={f}
                    onClick={() => setReadingFrame(f)}
                    className={`px-2 py-1 rounded font-mono text-xs ${
                      readingFrame === f
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    +{f + 1}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setObsInput('');
                    setRefInput('');
                  }}
                  className="ima-button ima-button-secondary text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
                <button
                  onClick={runAnalysis}
                  disabled={isLoading || !obsValidation.isValid}
                  className="ima-button ima-button-primary text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isLoading ? 'Analyzing...' : 'ANALYZE DNA'}
                </button>
              </div>
            </div>

            {/* Optimization Constraints */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252d3a] text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Optimization Constraints:</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-slate-300">
                  <span className="text-slate-400">Target GC:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={targetGcMin}
                    onChange={(e) => setTargetGcMin(Number(e.target.value))}
                    className="w-11 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded font-mono text-center text-xs text-cyan-300"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={targetGcMax}
                    onChange={(e) => setTargetGcMax(Number(e.target.value))}
                    className="w-11 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded font-mono text-center text-xs text-cyan-300"
                  />
                  <span>%</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preserveProtein}
                    onChange={(e) => setPreserveProtein(e.target.checked)}
                    className="rounded text-cyan-500"
                  />
                  <span>Preserve Protein</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section B: Analysis Overview */}
        <div className="ima-panel">
          <div className="ima-panel-header">
            <span className="ima-panel-title">
              <Binary className="w-4 h-4 text-cyan-400" /> Section B: Biophysical & Sequence Overview
            </span>
            <span
              className={`ima-badge ${
                useReference ? 'ima-badge-cyan' : 'ima-badge-amber'
              }`}
            >
              {useReference ? 'Reference Mode (A)' : 'Exploratory Mode (B)'}
            </span>
          </div>
          <div className="ima-panel-body space-y-3">
            <div className="ima-metrics-grid">
              <div className="ima-metric-box">
                <span className="ima-metric-label">Length</span>
                <span className="ima-metric-val">{obsValidation.length} bp</span>
              </div>
              <div className="ima-metric-box">
                <span className="ima-metric-label">GC Content</span>
                <span className="ima-metric-val">{obsValidation.gcPercent}%</span>
              </div>
              <div className="ima-metric-box">
                <span className="ima-metric-label">Melting Temp</span>
                <span className="ima-metric-val">{obsValidation.meltingTemperature} °C</span>
              </div>
              <div className="ima-metric-box">
                <span className="ima-metric-label">Est. Weight</span>
                <span className="ima-metric-val">{obsValidation.molecularWeightKDa} kDa</span>
              </div>
            </div>

            {/* Nucleotide breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono py-1.5 px-2 bg-[#090b10] rounded border border-[#202733]">
              <div>
                <span className="text-amber-400 font-bold">A:</span> {obsValidation.cleanedSequence.split('A').length - 1}
              </div>
              <div>
                <span className="text-sky-400 font-bold">T:</span> {obsValidation.cleanedSequence.split('T').length - 1}
              </div>
              <div>
                <span className="text-violet-400 font-bold">G:</span> {obsValidation.cleanedSequence.split('G').length - 1}
              </div>
              <div>
                <span className="text-emerald-400 font-bold">C:</span> {obsValidation.cleanedSequence.split('C').length - 1}
              </div>
            </div>

            {/* Status notice */}
            <div className="text-xs text-slate-400 bg-[#0d1117] p-2.5 rounded border border-[#202733] space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Validation Status: {obsValidation.isValid ? 'Valid Canonical DNA' : 'Validation Error'}
              </div>
              {compareResult && (
                <div className="text-[11px] text-cyan-300">
                  Pairwise Identity: {compareResult.alignment.identity_percent}% &bull; Detected Differences: {compareResult.alignment.mutation_count}
                </div>
              )}
              {exploratoryResult && exploratoryResult.anomalies.length > 0 && (
                <div className="text-[11px] text-amber-300">
                  Anomalies: {exploratoryResult.anomalies.join('; ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section C: Mutation Differential Table (Mode A) */}
      {compareResult && (
        <div className="ima-panel">
          <div className="ima-panel-header">
            <span className="ima-panel-title">
              <GitCompare className="w-4 h-4 text-amber-400" /> Section C: Mutation Differential Table
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {compareResult.alignment.mutation_count} Difference(s) Identified
            </span>
          </div>
          <div className="ima-panel-body p-0 ima-table-wrap">
            {compareResult.alignment.mutations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                Identical Sequences: No mutations detected relative to the reference.
              </div>
            ) : (
              <table className="ima-table">
                <thead>
                  <tr>
                    <th>Ref Pos</th>
                    <th>Obs Pos</th>
                    <th>Ref Base</th>
                    <th>Obs Base</th>
                    <th>Type</th>
                    <th>Shift</th>
                    <th>Codon Shift</th>
                    <th>Consequence</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {compareResult.alignment.mutations.map((m, idx) => {
                    const isSelected = selectedMutation?.reference_position === m.reference_position;
                    return (
                      <tr
                        key={idx}
                        className={isSelected ? 'is-selected cursor-pointer' : 'cursor-pointer'}
                        onClick={() => {
                          setSelectedMutation(m);
                          onSelectPosition(m.reference_position);
                        }}
                      >
                        <td className="font-mono font-bold text-cyan-400">#{m.reference_position}</td>
                        <td className="font-mono">#{m.observed_position}</td>
                        <td className="font-mono text-slate-200">{m.original_base}</td>
                        <td className="font-mono font-bold text-amber-400">{m.observed_base}</td>
                        <td>{m.type.toUpperCase()}</td>
                        <td>
                          {m.is_transition ? (
                            <span className="text-cyan-400 text-[10px]">Transition</span>
                          ) : m.is_transversion ? (
                            <span className="text-amber-400 text-[10px]">Transversion</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="font-mono text-slate-300">
                          {m.reference_codon && m.observed_codon
                            ? `${m.reference_codon} -> ${m.observed_codon}`
                            : '-'}
                        </td>
                        <td>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.category === 'synonymous'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : m.category === 'nonsense'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {m.category_label}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPosition(m.reference_position);
                              onNavigateTo3D();
                            }}
                            className="text-xs text-cyan-400 hover:text-cyan-200 underline"
                          >
                            View in 3D
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Section D: Selected Codon & Protein Analysis */}
      {selectedMutation && (
        <div className="ima-panel border-amber-500/30">
          <div className="ima-panel-header bg-[#181a24]">
            <span className="ima-panel-title text-amber-400">
              <Dna className="w-4 h-4" /> Section D: Codon & Amino Acid Context (Position #{selectedMutation.reference_position})
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Reading Frame +{readingFrame + 1}
            </span>
          </div>
          <div className="ima-panel-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#090b10] p-3 rounded border border-[#252d3a] space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Reference Triplet
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-bold text-slate-100">
                    {selectedMutation.reference_codon || 'N/A'}
                  </span>
                  <span className="text-sm text-cyan-300">
                    &rarr; {selectedMutation.original_amino_acid?.name} ({selectedMutation.original_amino_acid?.code3})
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Chemical Category: {selectedMutation.original_amino_acid?.category} &bull; MW: {selectedMutation.original_amino_acid?.molecularWeight} Da
                </div>
              </div>

              <div className="bg-[#090b10] p-3 rounded border border-[#252d3a] space-y-1.5">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Observed Triplet
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-bold text-amber-400">
                    {selectedMutation.observed_codon || 'N/A'}
                  </span>
                  <span className="text-sm text-amber-300">
                    &rarr; {selectedMutation.observed_amino_acid?.name} ({selectedMutation.observed_amino_acid?.code3})
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Chemical Category: {selectedMutation.observed_amino_acid?.category} &bull; MW: {selectedMutation.observed_amino_acid?.molecularWeight} Da
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-300 bg-[#12161f] p-2.5 rounded border border-[#202733]">
              <b>Consequence Assessment:</b> {selectedMutation.description}
            </div>
          </div>
        </div>
      )}

      {/* Section E: Correction Recommendations */}
      <div className="ima-panel">
        <div className="ima-panel-header">
          <span className="ima-panel-title">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Section E: Intelligent Correction Recommendations
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {candidatesList.length} Candidate Proposals
          </span>
        </div>
        <div className="ima-panel-body">
          {candidatesList.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No correction proposals required; sequence matches canonical criteria.
            </div>
          ) : (
            candidatesList.map((cand, idx) => (
              <div
                key={cand.candidate_id || idx}
                className={`ima-candidate-card ${idx === 0 ? 'is-top' : ''}`}
              >
                <div className="ima-cand-header">
                  <div>
                    <span className="ima-badge ima-badge-cyan mr-2">{cand.strategy}</span>
                    <span className="ima-cand-title">{cand.title}</span>
                  </div>
                  <span
                    className={`ima-cand-score ${
                      cand.score >= 90
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    Score: {cand.score.toFixed(1)} / 100
                  </span>
                </div>

                <div className="ima-cand-seq">{cand.sequence}</div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
                  <div className="flex items-center gap-3">
                    <span>Edits: <b className="text-slate-200">{cand.edits_count}</b></span>
                    <span>GC: <b className="text-slate-200">{cand.resulting_gc_percent}%</b></span>
                    <span>Protein Preserved: <b className={cand.protein_preserved ? 'text-emerald-400' : 'text-amber-400'}>{cand.protein_preserved ? 'Yes (100%)' : 'No'}</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCandidateToApply(cand)}
                      className="ima-button ima-button-primary text-xs py-1"
                    >
                      Apply Candidate <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 border-t border-[#1e2533] pt-2">
                  <p><b>Rationale:</b> {cand.rationale}</p>
                  <p className="text-slate-500 mt-0.5"><b>Limitation:</b> {cand.scientific_limitation}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section F: Grounded Scientific Explanations & Limitations */}
      <div className="ima-panel">
        <div className="ima-panel-header">
          <span className="ima-panel-title">
            <ShieldAlert className="w-4 h-4 text-cyan-400" /> Section F: Scientific Methodology & Safeguards
          </span>
        </div>
        <div className="ima-panel-body text-xs text-slate-400 space-y-2 leading-relaxed">
          <p>
            • <b>Pairwise Alignment:</b> Conducted using dynamic global Needleman-Wunsch programming. 
            All nucleotide differences represent positional sequence alignment deviations.
          </p>
          <p>
            • <b>Mutation Consequence Determination:</b> Mapped using NCBI Translation Table 1 (Standard Genetic Code). 
            Silent synonymous alterations preserve identical primary amino acid code; missense substitutions alter codon interpretation; 
            nonsense substitutions introduce premature STOP signals terminating polypeptide elongation.
          </p>
          <p className="text-amber-400/90 font-medium">
            • <b>Biological Safeguards:</b> BioCrystal 3D generates mathematical sequence alignment proposals. 
            No computational prediction guarantees biological efficacy or safety without clinical wet-lab experimental confirmation.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {candidateToApply && (
        <div className="ima-modal-overlay">
          <div className="ima-modal">
            <div className="flex justify-between items-center border-b border-[#252d3a] pb-2">
              <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Confirm Candidate Sequence Application
              </span>
              <button
                onClick={() => setCandidateToApply(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>You are about to replace the active workspace DNA sequence with the proposed candidate:</p>
              <div className="font-mono text-xs text-cyan-400 bg-[#05070a] p-2 rounded border border-[#202733] break-all">
                {candidateToApply.sequence}
              </div>
              <p><b>Edits:</b> {candidateToApply.edits_detail.join(', ')}</p>
              <p className="text-amber-400 text-[11px]">
                Notice: Applying this candidate will synchronize the 3D molecular double-helix scene, sequence ribbons, and reports.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#252d3a]">
              <button
                onClick={() => setCandidateToApply(null)}
                className="ima-button ima-button-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApply}
                className="ima-button ima-button-primary text-xs"
              >
                Confirm & Update Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentMutationAnalysis;
