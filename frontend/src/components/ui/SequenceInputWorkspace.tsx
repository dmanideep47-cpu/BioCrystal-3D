import React, { useState, useId } from 'react';
import {
  Upload,
  Play,
  AlertTriangle,
  Dna,
  Database,
  RotateCcw,
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
}

export const SequenceInputWorkspace: React.FC<SequenceInputWorkspaceProps> = ({
  onAnalyze,
  isAnalyzing,
  analysisStageText,
  analysisError,
  onClearError,
  backendStatus = 'ONLINE',
  onRetryBackend,
}) => {
  const refFileInputId = useId();
  const obsFileInputId = useId();

  // Both sequences start completely empty as strictly mandated by user requirements
  const [refRawInput, setRefRawInput] = useState<string>('');
  const [obsRawInput, setObsRawInput] = useState<string>('');

  const [refSource, setRefSource] = useState<string>('Empty');
  const [obsSource, setObsSource] = useState<string>('Empty');

  // Analysis Context state
  const [context, setContext] = useState<AnalysisContext>({
    organism: 'Homo sapiens',
    gene: 'KRAS',
    accession: 'NM_004985.5',
    sequenceType: 'coding',
    strandOrientation: 'forward',
    readingFrame: 0,
    geneticCode: 'standard',
  });

  // Analysis Options state
  const [options, setOptions] = useState<AnalysisOptions>({
    detectDifferences: true,
    referenceGuided: true,
    codingConsequence: true,
    structuralMapping: true,
    generateReport: true,
  });

  // Live validation
  const refValidation: SequenceValidationResult = validateDNASequence(refRawInput);
  const obsValidation: SequenceValidationResult = validateDNASequence(obsRawInput);

  // File Upload Handlers (FASTA / GenBank / Text)
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'ref' | 'obs'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (target === 'ref') {
          setRefRawInput(content);
          setRefSource(`File: ${file.name}`);
        } else {
          setObsRawInput(content);
          setObsSource(`File: ${file.name}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Preset Benchmark Loaders
  const loadBenchmark = (benchmarkId: string) => {
    onClearError();
    if (benchmarkId === 'kras') {
      const kras = REFERENCE_SEQUENCES.find((s) => s.geneSymbol === 'KRAS') || REFERENCE_SEQUENCES[0];
      setRefRawInput(kras.sequence);
      // c.34G>T at position 34 (GGT -> TGT)
      const mutSeq = kras.sequence.substring(0, 33) + 'T' + kras.sequence.substring(34);
      setObsRawInput(mutSeq);
      setRefSource('Benchmark: KRAS Wild-type Exon 2');
      setObsSource('Benchmark: KRAS c.34G>T (p.Gly12Cys)');
      setContext({
        organism: 'Homo sapiens',
        gene: 'KRAS',
        accession: 'NM_004985.5',
        sequenceType: 'coding',
        strandOrientation: 'forward',
        readingFrame: 0,
        geneticCode: 'standard',
      });
    } else if (benchmarkId === 'hbb') {
      const hbb = REFERENCE_SEQUENCES.find((s) => s.geneSymbol === 'HBB')!;
      setRefRawInput(hbb.sequence);
      // Position 20 A -> T (GAG -> GTG, Glu6Val)
      const mutSeq = hbb.sequence.substring(0, 19) + 'T' + hbb.sequence.substring(20);
      setObsRawInput(mutSeq);
      setRefSource('Benchmark: Human HBB Wild-Type');
      setObsSource('Benchmark: HBB c.20A>T (p.Glu6Val)');
      setContext({
        organism: 'Homo sapiens',
        gene: 'HBB',
        accession: 'NM_000518.5',
        sequenceType: 'coding',
        strandOrientation: 'forward',
        readingFrame: 0,
        geneticCode: 'standard',
      });
    } else if (benchmarkId === 'tp53') {
      const tp53 = REFERENCE_SEQUENCES.find((s) => s.geneSymbol === 'TP53')!;
      setRefRawInput(tp53.sequence);
      // Position 8 G -> T (CGG -> CTG, Arg248Leu)
      const mutSeq = tp53.sequence.substring(0, 7) + 'T' + tp53.sequence.substring(8);
      setObsRawInput(mutSeq);
      setRefSource('Benchmark: Human TP53 Exon 7');
      setObsSource('Benchmark: TP53 c.743G>T (p.Arg248Leu)');
      setContext({
        organism: 'Homo sapiens',
        gene: 'TP53',
        accession: 'NM_000546.6',
        sequenceType: 'coding',
        strandOrientation: 'forward',
        readingFrame: 0,
        geneticCode: 'standard',
      });
    } else if (benchmarkId === 'clear') {
      setRefRawInput('');
      setObsRawInput('');
      setRefSource('Empty');
      setObsSource('Empty');
    }
  };

  const isFormValid =
    refValidation.isValid &&
    obsValidation.isValid &&
    refValidation.cleanedSequence.length > 0 &&
    obsValidation.cleanedSequence.length > 0 &&
    !isAnalyzing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    onAnalyze({
      referenceSequence: refValidation.cleanedSequence,
      observedSequence: obsValidation.cleanedSequence,
      context,
      options,
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#090A0C] overflow-y-auto select-none font-mono">
      {/* Workstation Stage A Header */}
      <div className="px-6 py-4 bg-[#111316] border-b border-[#2A2D33] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold text-[#F4F4F2] uppercase tracking-wider flex items-center gap-2">
              <Dna className="w-4 h-4 text-[#FF6500]" />
              <span>DNA Sequence Input & Analysis Setup</span>
            </h1>
            <span className="text-[10px] bg-[#1D2025] text-[#A0A3AA] px-2 py-0.5 rounded border border-[#2A2D33]">
              STAGE A: PRE-ANALYSIS
            </span>
          </div>
          <p className="text-[11px] text-[#70757D] font-sans mt-0.5">
            Input reference and observed sequences. A real macromolecular 3D workspace will be opened only after successful sequence alignment and variant identification.
          </p>
        </div>

        {/* Quick Benchmark Chips */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-[10px] text-[#70757D] mr-1 hidden sm:inline">Benchmarks:</span>
          <button
            type="button"
            onClick={() => loadBenchmark('kras')}
            className="px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#22C7E8] border border-[#2A2D33] text-[11px] transition-all cursor-pointer"
            title="Load KRAS G12C Nature / AMG 510 benchmark"
          >
            KRAS G12C (6OIM)
          </button>
          <button
            type="button"
            onClick={() => loadBenchmark('hbb')}
            className="px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#35C98A] border border-[#2A2D33] text-[11px] transition-all cursor-pointer"
            title="Load HBB Glu6Val sickle cell benchmark"
          >
            HBB Sickle Cell (1A3N)
          </button>
          <button
            type="button"
            onClick={() => loadBenchmark('tp53')}
            className="px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A78BFA] border border-[#2A2D33] text-[11px] transition-all cursor-pointer"
            title="Load TP53 codon 248 benchmark"
          >
            TP53 DNA Contact (1TUP)
          </button>
          <button
            type="button"
            onClick={() => loadBenchmark('clear')}
            className="px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#70757D] hover:text-[#F4F4F2] border border-[#2A2D33] text-[11px] transition-all cursor-pointer"
            title="Clear all fields to empty"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Setup Content */}
      <form onSubmit={handleSubmit} className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Analysis Error Banner */}
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

        {/* Dual Sequence Editors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. REFERENCE SEQUENCE */}
          <div className="bg-[#111316] rounded-md border border-[#2A2D33] p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#35C98A]" />
                <label className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
                  Reference DNA Sequence
                </label>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[#70757D]">Source:</span>
                <span className="text-[#35C98A] font-semibold bg-[#35C98A]/10 px-1.5 py-0.2 rounded border border-[#35C98A]/30">
                  {refSource}
                </span>
                <label
                  htmlFor={refFileInputId}
                  className="flex items-center gap-1 text-[#A0A3AA] hover:text-[#F4F4F2] cursor-pointer ml-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>FASTA</span>
                </label>
                <input
                  id={refFileInputId}
                  type="file"
                  accept=".fasta,.fa,.txt,.gb,.gbk"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'ref')}
                />
              </div>
            </div>

            <textarea
              value={refRawInput}
              onChange={(e) => {
                setRefRawInput(e.target.value);
                setRefSource('Pasted / Edited');
              }}
              placeholder="Paste wild-type reference DNA sequence or upload FASTA file (e.g. ATGACTGAATAT...)..."
              rows={6}
              className="w-full bg-[#090A0C] border border-[#2A2D33] rounded p-3 text-xs font-mono text-[#F4F4F2] placeholder-[#70757D] focus:outline-none focus:border-[#FF6500] resize-y"
              disabled={isAnalyzing}
            />

            {/* Reference Metrics & Validation Strip */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#2A2D33]/60 text-[#70757D]">
              <div className="flex items-center gap-3">
                <span>
                  Length:{' '}
                  <strong className={refValidation.isValid ? 'text-[#35C98A]' : 'text-[#F4F4F2]'}>
                    {refValidation.length} bp
                  </strong>
                </span>
                <span>|</span>
                <span>GC: {refValidation.gcPercent}%</span>
                <span>|</span>
                <span>Tm: {refValidation.meltingTemperature} °C</span>
              </div>

              {refValidation.invalidCharacters.length > 0 && (
                <span className="text-[#F06464] text-[10px] font-semibold">
                  Invalid: {refValidation.invalidCharacters.join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* 2. OBSERVED / MUTANT SEQUENCE */}
          <div className="bg-[#111316] rounded-md border border-[#2A2D33] p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6500]" />
                <label className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider">
                  Observed / Mutant DNA Sequence
                </label>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[#70757D]">Source:</span>
                <span className="text-[#FF6500] font-semibold bg-[#FF6500]/10 px-1.5 py-0.2 rounded border border-[#FF6500]/30">
                  {obsSource}
                </span>
                <label
                  htmlFor={obsFileInputId}
                  className="flex items-center gap-1 text-[#A0A3AA] hover:text-[#F4F4F2] cursor-pointer ml-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>FASTA</span>
                </label>
                <input
                  id={obsFileInputId}
                  type="file"
                  accept=".fasta,.fa,.txt,.gb,.gbk"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'obs')}
                />
              </div>
            </div>

            <textarea
              value={obsRawInput}
              onChange={(e) => {
                setObsRawInput(e.target.value);
                setObsSource('Pasted / Edited');
              }}
              placeholder="Paste observed DNA sequence with candidate mutations or upload FASTA..."
              rows={6}
              className="w-full bg-[#090A0C] border border-[#2A2D33] rounded p-3 text-xs font-mono text-[#F4F4F2] placeholder-[#70757D] focus:outline-none focus:border-[#FF6500] resize-y"
              disabled={isAnalyzing}
            />

            {/* Observed Metrics & Validation Strip */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#2A2D33]/60 text-[#70757D]">
              <div className="flex items-center gap-3">
                <span>
                  Length:{' '}
                  <strong className={obsValidation.isValid ? 'text-[#FF6500]' : 'text-[#F4F4F2]'}>
                    {obsValidation.length} bp
                  </strong>
                </span>
                <span>|</span>
                <span>GC: {obsValidation.gcPercent}%</span>
                <span>|</span>
                <span>Tm: {obsValidation.meltingTemperature} °C</span>
              </div>

              {obsValidation.invalidCharacters.length > 0 && (
                <span className="text-[#F06464] text-[10px] font-semibold">
                  Invalid: {obsValidation.invalidCharacters.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Biological Analysis Context Fields */}
        <div className="bg-[#111316] rounded-md border border-[#2A2D33] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#2A2D33]">
            <span className="text-xs font-bold text-[#F4F4F2] uppercase tracking-wider flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#22C7E8]" />
              <span>Biological Context & Annotation Parameters</span>
            </span>
            <span className="text-[10px] text-[#70757D]">
              Structural mapping requires confirmed coding context
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            {/* Organism */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">Organism</label>
              <input
                type="text"
                value={context.organism}
                onChange={(e) => setContext({ ...context, organism: e.target.value })}
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing}
              />
            </div>

            {/* Gene / Region */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">Gene / Region</label>
              <input
                type="text"
                value={context.gene}
                onChange={(e) => setContext({ ...context, gene: e.target.value })}
                placeholder="e.g. KRAS, HBB, TP53"
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing}
              />
            </div>

            {/* Accession / PDB ID */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">PDB Accession / ID</label>
              <input
                type="text"
                value={context.accession}
                onChange={(e) => setContext({ ...context, accession: e.target.value })}
                placeholder="e.g. 6OIM, 1A3N, 1TUP"
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing}
              />
            </div>

            {/* Sequence Type */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">Sequence Type</label>
              <select
                value={context.sequenceType}
                onChange={(e) =>
                  setContext({
                    ...context,
                    sequenceType: e.target.value as 'coding' | 'non_coding' | 'unknown',
                  })
                }
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing}
              >
                <option value="coding">Coding DNA (CDS)</option>
                <option value="non_coding">Non-coding DNA</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Strand Orientation */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">Strand Orientation</label>
              <select
                value={context.strandOrientation}
                onChange={(e) =>
                  setContext({
                    ...context,
                    strandOrientation: e.target.value as 'forward' | 'reverse_complement' | 'unknown',
                  })
                }
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing}
              >
                <option value="forward">Forward (5' &rarr; 3')</option>
                <option value="reverse_complement">Reverse Complement (3' &larr; 5')</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Reading Frame */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">Reading Frame</label>
              <select
                value={context.readingFrame}
                onChange={(e) => setContext({ ...context, readingFrame: Number(e.target.value) as any })}
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing || context.sequenceType !== 'coding'}
              >
                <option value={0}>Frame 1 (Offset 0)</option>
                <option value={1}>Frame 2 (Offset 1)</option>
                <option value={2}>Frame 3 (Offset 2)</option>
                <option value={-1}>Unknown Frame</option>
              </select>
            </div>

            {/* Genetic Code Table */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] text-[#70757D] block uppercase font-bold">Genetic Translation Table</label>
              <select
                value={context.geneticCode}
                onChange={(e) => setContext({ ...context, geneticCode: e.target.value as any })}
                className="w-full bg-[#090A0C] border border-[#2A2D33] rounded px-2.5 py-1.5 text-xs text-[#F4F4F2] focus:outline-none focus:border-[#FF6500]"
                disabled={isAnalyzing || context.sequenceType !== 'coding'}
              >
                <option value="standard">Standard Genetic Code (NCBI Table 1)</option>
                <option value="vertebrate_mitochondrial">Vertebrate Mitochondrial (NCBI Table 2)</option>
                <option value="bacterial_plastid">Bacterial & Plastid (NCBI Table 11)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Analysis Options Controls */}
        <div className="bg-[#111316] rounded-md border border-[#2A2D33] p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer text-[#F4F4F2]">
              <input
                type="checkbox"
                checked={options.detectDifferences}
                onChange={(e) => setOptions({ ...options, detectDifferences: e.target.checked })}
                className="accent-[#FF6500]"
                disabled={isAnalyzing}
              />
              <span>Detect Sequence Differences</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-[#F4F4F2]">
              <input
                type="checkbox"
                checked={options.codingConsequence}
                onChange={(e) => setOptions({ ...options, codingConsequence: e.target.checked })}
                className="accent-[#FF6500]"
                disabled={isAnalyzing || context.sequenceType !== 'coding'}
              />
              <span className={context.sequenceType !== 'coding' ? 'text-[#70757D]' : ''}>
                Codon Consequence Analysis
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-[#F4F4F2]">
              <input
                type="checkbox"
                checked={options.structuralMapping}
                onChange={(e) => setOptions({ ...options, structuralMapping: e.target.checked })}
                className="accent-[#FF6500]"
                disabled={isAnalyzing || context.sequenceType !== 'coding'}
              />
              <span className={context.sequenceType !== 'coding' ? 'text-[#70757D]' : ''}>
                3D Macromolecular Mapping
              </span>
            </label>
          </div>

          <div className="text-[11px] text-[#70757D]">
            Engine: Biopython PairwiseAligner & RCSB Structural Mapping
          </div>
        </div>

        {/* Backend Status Notice when not Online */}
        {backendStatus !== 'ONLINE' && (
          <div className="p-3 rounded-md bg-[#17191D] border border-[#F06464]/40 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
            <div className="flex items-center space-x-2 text-[#F06464]">
              <span className="w-2 h-2 rounded-full bg-[#F06464] animate-pulse shrink-0" />
              <span>
                {backendStatus === 'CONNECTING'
                  ? 'Connecting to FastAPI backend (http://127.0.0.1:8000)...'
                  : 'FastAPI backend is offline (http://127.0.0.1:8000). Start backend with run.bat or "python -m uvicorn backend.main:app".'}
              </span>
            </div>
            {onRetryBackend && backendStatus !== 'CONNECTING' && (
              <button
                type="button"
                onClick={onRetryBackend}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#1D2025] hover:bg-[#2A2D33] text-[#F4F4F2] border border-[#2A2D33] transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-[#22C7E8]" />
                <span>Retry Connection</span>
              </button>
            )}
          </div>
        )}

        {/* Primary Action Button: ANALYZE SEQUENCES */}
        <div className="pt-2 flex flex-col items-center justify-center space-y-3">
          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full max-w-md py-3.5 px-6 rounded-md font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
              isFormValid
                ? 'bg-[#FF6500] hover:bg-[#FF7A1A] text-[#090A0C] border border-[#FF8738]'
                : 'bg-[#1D2025] text-[#70757D] border border-[#2A2D33] cursor-not-allowed opacity-60'
            }`}
          >
            {isAnalyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-[#090A0C] border-t-transparent rounded-full animate-spin" />
                <span>{analysisStageText || 'Executing Analysis...'}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>ANALYZE SEQUENCES</span>
              </>
            )}
          </button>

          {!isFormValid && !isAnalyzing && (
            <p className="text-[11px] text-[#70757D] text-center">
              Please enter valid Reference and Observed DNA sequences to activate analysis.
            </p>
          )}

          {isAnalyzing && (
            <p className="text-[11px] text-[#22C7E8] text-center animate-pulse">
              {analysisStageText}
            </p>
          )}
        </div>
      </form>
    </div>
  );
};
