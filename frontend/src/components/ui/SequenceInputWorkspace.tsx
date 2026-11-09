import React, { useState, useId } from 'react';
import {
  Upload,
  AlertTriangle,
  Database,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import {
  AnalysisContext,
  AnalysisOptions,
  SequenceValidationResult,
  BackendStatus,
} from '../../types/dna';
import { validateDNASequence, REFERENCE_SEQUENCES } from '../../services/bioinformatics';

interface SequenceInputWorkspaceProps {
  onAnalyze: (params: {
    referenceSequence: string;
    observedSequence: string;
    context: AnalysisContext;
    options: AnalysisOptions;
  }) => Promise<void>;
  isAnalyzing: boolean;
  analysisStageText: string;
  analysisError: string | null;
  onClearError: () => void;
  backendStatus?: BackendStatus;
  onRetryBackend?: () => void;
  initialMutatedSequence?: string;
  initialReferenceId?: string;
}

export const SequenceInputWorkspace: React.FC<SequenceInputWorkspaceProps> = ({
  onAnalyze,
  isAnalyzing,
  analysisStageText,
  analysisError,
  onClearError,
  initialMutatedSequence = '',
  initialReferenceId = 'human-kras-g12c',
}) => {
  const mutatedFileInputId = useId();
  const customRefFileInputId = useId();

  // Selected Reference Preset
  const [selectedRefId, setSelectedRefId] = useState<string>(initialReferenceId);
  const [isCustomRef, setIsCustomRef] = useState<boolean>(false);
  const [customRefSequence, setCustomRefSequence] = useState<string>('');
  const [customRefGene, setCustomRefGene] = useState<string>('CUSTOM');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  // Active preset reference lookup
  const activePreset = REFERENCE_SEQUENCES.find((r) => r.id === selectedRefId) || REFERENCE_SEQUENCES[0];

  // Effective Reference Sequence
  const effectiveRefSequence = isCustomRef ? customRefSequence : activePreset.sequence;
  const effectiveGene = isCustomRef ? customRefGene : activePreset.geneSymbol;
  const effectiveAccession = isCustomRef ? 'CUSTOM_REF' : (activePreset.accessionNumber || 'NCBI_REF');
  const effectiveOrganism = isCustomRef ? 'User Specified' : (activePreset.organism || 'Homo sapiens');

  // Dominant Mutated DNA Input
  const [mutatedRawInput, setMutatedRawInput] = useState<string>(initialMutatedSequence);
  const [mutatedSource, setMutatedSource] = useState<string>(
    initialMutatedSequence ? 'Restored Sequence' : 'Empty'
  );

  // Analysis Context & Options
  const [context, setContext] = useState<AnalysisContext>({
    organism: effectiveOrganism,
    gene: effectiveGene,
    accession: effectiveAccession,
    sequenceType: 'coding',
    strandOrientation: 'forward',
    readingFrame: 0,
    geneticCode: 'standard',
  });

  const [options, _setOptions] = useState<AnalysisOptions>({
    detectDifferences: true,
    referenceGuided: true,
    codingConsequence: true,
    structuralMapping: true,
    generateReport: true,
  });

  // Client-Side Live IUPAC Validations
  const refValidation: SequenceValidationResult = validateDNASequence(effectiveRefSequence);
  const mutatedValidation: SequenceValidationResult = validateDNASequence(mutatedRawInput);

  const canAnalyze =
    refValidation.isValid &&
    mutatedValidation.isValid &&
    refValidation.length > 0 &&
    mutatedValidation.length > 0 &&
    !isAnalyzing;

  // File Upload Handler (FASTA / TXT)
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'mutated' | 'custom_ref'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (target === 'mutated') {
          setMutatedRawInput(content);
          setMutatedSource(`File: ${file.name}`);
        } else {
          setCustomRefSequence(content);
          setIsCustomRef(true);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Preset Selection Handler
  const handleSelectPreset = (id: string) => {
    if (id === 'custom') {
      setIsCustomRef(true);
    } else {
      setIsCustomRef(false);
      setSelectedRefId(id);
      const preset = REFERENCE_SEQUENCES.find((r) => r.id === id);
      if (preset) {
        setContext((prev) => ({
          ...prev,
          organism: preset.organism,
          gene: preset.geneSymbol,
          accession: preset.accessionNumber || 'NCBI_REF',
        }));
      }
    }
  };

  // Quick Load Demo Sample for the Selected Preset
  const handleLoadBenchmarkSample = (presetId: string) => {
    const preset = REFERENCE_SEQUENCES.find((r) => r.id === presetId) || activePreset;
    setIsCustomRef(false);
    setSelectedRefId(preset.id);

    // Apply the demonstration mutation to the reference sequence to form the mutated sample
    let mutantSample = preset.sequence;
    if (preset.demonstrationMutation) {
      const pos = preset.demonstrationMutation.position;
      const newBase = preset.demonstrationMutation.newBase;
      if (pos >= 1 && pos <= mutantSample.length) {
        mutantSample =
          mutantSample.slice(0, pos - 1) + newBase + mutantSample.slice(pos);
      }
    }

    setMutatedRawInput(mutantSample);
    setMutatedSource(`Benchmark: ${preset.geneSymbol} ${preset.demonstrationMutation?.newBase ? 'Sample' : ''}`);
    setContext({
      organism: preset.organism,
      gene: preset.geneSymbol,
      accession: preset.accessionNumber || 'NCBI_REF',
      sequenceType: 'coding',
      strandOrientation: 'forward',
      readingFrame: 0,
      geneticCode: 'standard',
    });
  };

  const handleCopyRef = () => {
    if (!effectiveRefSequence) return;
    navigator.clipboard.writeText(effectiveRefSequence);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAnalyze) return;

    await onAnalyze({
      referenceSequence: refValidation.cleanedSequence,
      observedSequence: mutatedValidation.cleanedSequence,
      context: {
        ...context,
        organism: effectiveOrganism,
        gene: effectiveGene,
        accession: effectiveAccession,
      },
      options,
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#090A0C] text-[#F4F4F2] font-mono select-none">
      {/* Top Breadcrumb Bar */}
      <div className="border-b border-[#2A2D33] px-6 py-3 flex items-center justify-between bg-[#111316] shrink-0">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-[#FF6500]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#F4F4F2]">
            Destination 1: Analyze
          </span>
          <span className="text-[#70757D]">/</span>
          <span className="text-[11px] text-[#A0A3AA]">
            Input Mutated DNA & Reference Comparison
          </span>
        </div>

        {/* Quick Benchmark Pills */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-[10px] text-[#70757D] mr-1 hidden md:inline">Quick Benchmarks:</span>
          <button
            type="button"
            onClick={() => handleLoadBenchmarkSample('human-kras-g12c')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer border ${
              selectedRefId === 'human-kras-g12c' && !isCustomRef
                ? 'bg-[#FF6500]/15 text-[#FF6500] border-[#FF6500]/40'
                : 'bg-[#17191D] text-[#22C7E8] border-[#2A2D33] hover:bg-[#1D2025]'
            }`}
            title="Load KRAS G12C oncogenic target benchmark (c.34G>T, PDB: 6OIM)"
          >
            KRAS G12C (6OIM)
          </button>
          <button
            type="button"
            onClick={() => handleLoadBenchmarkSample('human-hbb-sickle')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer border ${
              selectedRefId === 'human-hbb-sickle' && !isCustomRef
                ? 'bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/40'
                : 'bg-[#17191D] text-[#35C98A] border-[#2A2D33] hover:bg-[#1D2025]'
            }`}
            title="Load HBB sickle cell benchmark (c.17A>T, PDB: 1A3N)"
          >
            HBB HbS (1A3N)
          </button>
          <button
            type="button"
            onClick={() => handleLoadBenchmarkSample('human-tp53-codon248')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer border ${
              selectedRefId === 'human-tp53-codon248' && !isCustomRef
                ? 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/40'
                : 'bg-[#17191D] text-[#A78BFA] border-[#2A2D33] hover:bg-[#1D2025]'
            }`}
            title="Load TP53 codon 248 DNA-binding hotspot (PDB: 1TUP)"
          >
            TP53 R248W (1TUP)
          </button>
          <button
            type="button"
            onClick={() => {
              setMutatedRawInput('');
              setMutatedSource('Cleared');
            }}
            className="px-2 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#70757D] hover:text-[#F4F4F2] border border-[#2A2D33] text-[11px] transition-all cursor-pointer"
            title="Clear mutated sequence input"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Workspace Form */}
      <form onSubmit={handleSubmit} className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Error Alert */}
        {analysisError && (
          <div className="bg-[#F06464]/10 border border-[#F06464]/30 rounded-md p-3.5 flex items-start gap-3 text-xs text-[#F4F4F2]">
            <AlertTriangle className="w-4 h-4 text-[#F06464] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-[#F06464] block">Analysis Execution Failed</span>
              <p className="text-[11px] text-[#A0A3AA] mt-0.5">{analysisError}</p>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="text-[#70757D] hover:text-[#F4F4F2] text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ===================================================================
            SECTION 1: DOMINANT MUTATED DNA SEQUENCE INPUT (HERO)
        =================================================================== */}
        <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-5 shadow-lg space-y-3 relative">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#22C7E8] ring-2 ring-[#22C7E8]/20" />
              <label className="text-sm font-bold text-[#F4F4F2] uppercase tracking-wider">
                1. Mutated / Observed DNA Sequence
              </label>
              <span className="text-[11px] text-[#70757D]">(5' &rarr; 3' Target Strand)</span>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="text-[#70757D]">Source:</span>
              <span className="text-[#22C7E8] font-semibold bg-[#22C7E8]/10 px-2 py-0.5 rounded border border-[#22C7E8]/30">
                {mutatedSource}
              </span>
              <label
                htmlFor={mutatedFileInputId}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] cursor-pointer transition-all"
                title="Upload FASTA or text file"
              >
                <Upload className="w-3 h-3 text-[#22C7E8]" />
                <span className="text-[11px]">Upload FASTA</span>
              </label>
              <input
                id={mutatedFileInputId}
                type="file"
                accept=".fasta,.fa,.txt,.fna,.seq"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'mutated')}
              />
            </div>
          </div>

          <p className="text-[11px] text-[#A0A3AA]">
            Paste the observed or experimentally sequenced DNA segment. The engine will align it against the selected reference to pinpoint mutations, codon shifts, and macromolecular impacts.
          </p>

          {/* Primary Textarea */}
          <div className="relative">
            <textarea
              value={mutatedRawInput}
              onChange={(e) => {
                setMutatedRawInput(e.target.value);
                setMutatedSource('Pasted / Edited');
              }}
              placeholder="Paste mutated DNA sequence here (e.g. ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG)..."
              rows={7}
              spellCheck={false}
              className="w-full bg-[#090A0C] border border-[#2A2D33] rounded-md p-3.5 text-xs font-mono text-[#F4F4F2] placeholder-[#70757D] focus:outline-none focus:border-[#FF6500] focus:ring-1 focus:ring-[#FF6500]/50 resize-y leading-relaxed"
            />
            {mutatedRawInput.length === 0 && (
              <div className="absolute right-3 bottom-3 text-[10px] text-[#70757D] pointer-events-none">
                A, C, G, T uppercase or lowercase supported
              </div>
            )}
          </div>

          {/* Real-Time Live Validation Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
            <div className="bg-[#090A0C] rounded p-2 border border-[#2A2D33]">
              <span className="text-[10px] text-[#70757D] block">Length</span>
              <span className="font-bold text-[#F4F4F2] text-sm">
                {mutatedValidation.length} <span className="text-[10px] text-[#70757D]">bp</span>
              </span>
            </div>
            <div className="bg-[#090A0C] rounded p-2 border border-[#2A2D33]">
              <span className="text-[10px] text-[#70757D] block">GC Content</span>
              <span className="font-bold text-[#22C7E8] text-sm">
                {mutatedValidation.gcPercent.toFixed(1)}%
              </span>
            </div>
            <div className="bg-[#090A0C] rounded p-2 border border-[#2A2D33]">
              <span className="text-[10px] text-[#70757D] block">Melting Temp (Tm)</span>
              <span className="font-bold text-[#35C98A] text-sm">
                {mutatedValidation.meltingTemperature.toFixed(1)}°C
              </span>
            </div>
            <div className="bg-[#090A0C] rounded p-2 border border-[#2A2D33]">
              <span className="text-[10px] text-[#70757D] block">Mol. Weight</span>
              <span className="font-bold text-[#F4F4F2] text-sm">
                {mutatedValidation.molecularWeightKDa.toFixed(2)} <span className="text-[10px] text-[#70757D]">kDa</span>
              </span>
            </div>
            <div className="bg-[#090A0C] rounded p-2 border border-[#2A2D33]">
              <span className="text-[10px] text-[#70757D] block">IUPAC Status</span>
              {mutatedValidation.isValid ? (
                <span className="font-bold text-[#35C98A] flex items-center gap-1 text-xs mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valid
                </span>
              ) : (
                <span className="font-bold text-[#F06464] flex items-center gap-1 text-xs mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Invalid
                </span>
              )}
            </div>
          </div>

          {/* Validation Errors / Warnings */}
          {mutatedValidation.errors.length > 0 && (
            <div className="text-[11px] text-[#F06464] bg-[#F06464]/10 rounded p-2 border border-[#F06464]/30 space-y-0.5">
              {mutatedValidation.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#F06464]" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===================================================================
            SECTION 2: CLEARLY IDENTIFIED REFERENCE SEQUENCE
        =================================================================== */}
        <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#35C98A] ring-2 ring-[#35C98A]/20" />
              <label className="text-sm font-bold text-[#F4F4F2] uppercase tracking-wider">
                2. Clearly Identified Reference Sequence
              </label>
              <span className="text-[11px] text-[#70757D]">(Wild-Type Alignment Baseline)</span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <button
                type="button"
                onClick={handleCopyRef}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] cursor-pointer transition-all"
                title="Copy reference sequence to clipboard"
              >
                {copiedRef ? (
                  <>
                    <Check className="w-3 h-3 text-[#35C98A]" />
                    <span className="text-[11px] text-[#35C98A]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-[11px]">Copy Ref</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Reference Selector Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {REFERENCE_SEQUENCES.slice(0, 4).map((preset) => {
              const isSelected = !isCustomRef && selectedRefId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/40 font-bold shadow-sm'
                      : 'bg-[#17191D] text-[#A0A3AA] hover:text-[#F4F4F2] border-[#2A2D33] hover:border-[#3D424B]'
                  }`}
                >
                  <span>{preset.geneSymbol}</span>
                  {preset.pdbId && (
                    <span className="text-[10px] ml-1 text-[#70757D]">({preset.pdbId})</span>
                  )}
                </button>
              );
            })}

            {/* Custom Reference Button */}
            <button
              type="button"
              onClick={() => handleSelectPreset('custom')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                isCustomRef
                  ? 'bg-[#FF6500]/15 text-[#FF6500] border-[#FF6500]/40 font-bold shadow-sm'
                  : 'bg-[#17191D] text-[#A0A3AA] hover:text-[#F4F4F2] border-[#2A2D33] hover:border-[#3D424B]'
              }`}
            >
              Custom Reference...
            </button>
          </div>

          {/* Active Reference Metadata Card */}
          {!isCustomRef ? (
            <div className="bg-[#090A0C] rounded-md border border-[#2A2D33] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#F4F4F2]">{activePreset.name}</span>
                  <span className="text-[10px] text-[#70757D]">|</span>
                  <span className="text-[#35C98A] font-semibold">{activePreset.organism}</span>
                  <span className="text-[10px] text-[#70757D]">|</span>
                  <span className="text-[#A0A3AA]">{activePreset.accessionNumber}</span>
                </div>
                {activePreset.pdbId && (
                  <span className="text-[10px] bg-[#35C98A]/10 text-[#35C98A] px-2 py-0.5 rounded border border-[#35C98A]/30">
                    PDB Crystal: {activePreset.pdbId}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#A0A3AA] leading-relaxed">
                {activePreset.description}
              </p>

              {/* Reference Sequence Preview */}
              <div className="bg-[#111316] rounded p-2.5 border border-[#2A2D33] font-mono text-[11px] text-[#35C98A] break-all leading-relaxed select-text">
                <span className="text-[10px] text-[#70757D] block font-sans mb-1">
                  Canonical Sequence ({effectiveRefSequence.length} bp):
                </span>
                {effectiveRefSequence}
              </div>
            </div>
          ) : (
            /* Custom Reference Editor */
            <div className="bg-[#090A0C] rounded-md border border-[#2A2D33] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#FF6500]">Custom Reference Sequence</span>
                  <input
                    type="text"
                    value={customRefGene}
                    onChange={(e) => setCustomRefGene(e.target.value.toUpperCase())}
                    placeholder="Gene Symbol (e.g. EGFR)"
                    className="bg-[#111316] border border-[#2A2D33] rounded px-2 py-0.5 text-xs font-mono text-[#F4F4F2] w-28 uppercase"
                  />
                </div>
                <label
                  htmlFor={customRefFileInputId}
                  className="flex items-center space-x-1 text-xs text-[#A0A3AA] hover:text-[#F4F4F2] cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-[#FF6500]" />
                  <span>Upload Ref FASTA</span>
                </label>
                <input
                  id={customRefFileInputId}
                  type="file"
                  accept=".fasta,.fa,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'custom_ref')}
                />
              </div>

              <textarea
                value={customRefSequence}
                onChange={(e) => setCustomRefSequence(e.target.value)}
                placeholder="Paste canonical wild-type reference DNA sequence..."
                rows={4}
                className="w-full bg-[#111316] border border-[#2A2D33] rounded p-3 text-xs font-mono text-[#F4F4F2] placeholder-[#70757D] focus:outline-none focus:border-[#FF6500] resize-y"
              />

              {refValidation.errors.length > 0 && (
                <div className="text-[11px] text-[#F06464] bg-[#F06464]/10 rounded p-2 border border-[#F06464]/30">
                  {refValidation.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced Options Accordion */}
        <div className="bg-[#111316] rounded-lg border border-[#2A2D33] p-3 text-xs">
          <button
            type="button"
            onClick={() => setShowAdvancedOptions((prev) => !prev)}
            className="w-full flex items-center justify-between text-[#A0A3AA] hover:text-[#F4F4F2] cursor-pointer py-1"
          >
            <span className="font-semibold text-xs">Scientific Context & Translation Options</span>
            {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvancedOptions && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#2A2D33] mt-2 text-xs">
              <div>
                <label className="text-[10px] text-[#70757D] block mb-1">Reading Frame</label>
                <select
                  value={context.readingFrame}
                  onChange={(e) =>
                    setContext((prev) => ({
                      ...prev,
                      readingFrame: Number(e.target.value) as 0 | 1 | 2,
                    }))
                  }
                  className="w-full bg-[#090A0C] border border-[#2A2D33] rounded p-1.5 text-xs text-[#F4F4F2]"
                >
                  <option value={0}>Frame +1 (0-offset, standard)</option>
                  <option value={1}>Frame +2 (1-offset)</option>
                  <option value={2}>Frame +3 (2-offset)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#70757D] block mb-1">Genetic Code Table</label>
                <select
                  value={context.geneticCode}
                  onChange={(e) =>
                    setContext((prev) => ({
                      ...prev,
                      geneticCode: e.target.value as any,
                    }))
                  }
                  className="w-full bg-[#090A0C] border border-[#2A2D33] rounded p-1.5 text-xs text-[#F4F4F2]"
                >
                  <option value="standard">NCBI Table 1: Standard Nuclear</option>
                  <option value="vertebrate_mitochondrial">NCBI Table 2: Vertebrate Mitochondrial</option>
                  <option value="bacterial_plastid">NCBI Table 11: Bacterial / Plastid</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#70757D] block mb-1">Sequence Type</label>
                <select
                  value={context.sequenceType}
                  onChange={(e) =>
                    setContext((prev) => ({
                      ...prev,
                      sequenceType: e.target.value as any,
                    }))
                  }
                  className="w-full bg-[#090A0C] border border-[#2A2D33] rounded p-1.5 text-xs text-[#F4F4F2]"
                >
                  <option value="coding">Protein Coding (CDS)</option>
                  <option value="non_coding">Non-Coding / Promoter</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            PRIMARY CTA: FIND MUTATIONS
        =================================================================== */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!canAnalyze}
            className={`w-full py-4 px-6 rounded-lg font-mono font-bold text-sm tracking-wider uppercase transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg cursor-pointer ${
              canAnalyze
                ? 'bg-gradient-to-r from-[#FF6500] to-[#E05300] hover:from-[#FF7A1A] hover:to-[#FF6500] text-[#FFFFFF] shadow-[#FF6500]/20 hover:shadow-[#FF6500]/30 hover:scale-[1.005]'
                : 'bg-[#1D2025] text-[#70757D] border border-[#2A2D33] cursor-not-allowed opacity-50'
            }`}
          >
            {isAnalyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{analysisStageText || 'Executing Sequence Alignment...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>FIND MUTATIONS & COMPARE WITH REFERENCE</span>
              </>
            )}
          </button>

          {!canAnalyze && !isAnalyzing && (
            <p className="text-center text-[11px] text-[#70757D] mt-2">
              {mutatedRawInput.trim().length === 0
                ? 'Paste a mutated DNA sequence above or click one of the quick benchmarks to begin.'
                : !mutatedValidation.isValid
                ? 'Mutated sequence contains invalid characters. Only A, C, G, T are permitted.'
                : !refValidation.isValid
                ? 'Reference sequence is invalid.'
                : ''}
            </p>
          )}
        </div>
      </form>
    </div>
  );
};
