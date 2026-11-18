import React, { useState, useMemo, useRef } from 'react';
import { AnalysisContext, AnalysisOptions, FastaSequenceItem } from '../../types/dna';
import { TacticalButton } from './TacticalButton';
import {
  Sparkles,
  Dna,
  Activity,
  RotateCcw,
  Copy,
  Check,
  FlaskConical,
  AlertCircle,
  Upload,
  ArrowLeftRight,
  FileText,
  CheckCircle2,
  X,
} from 'lucide-react';
import { parseFastaFileAPI } from '../../services/apiService';

interface SequenceInputWorkspaceProps {
  onAnalyze: (params: {
    referenceSequence: string;
    observedSequence: string;
    context: AnalysisContext;
    options: AnalysisOptions;
  }) => Promise<void>;
  onCompareVariants?: (params: {
    referenceSequence: string;
    variantASequence: string;
    variantBSequence: string;
    variantAName?: string;
    variantBName?: string;
    context: AnalysisContext;
    options: AnalysisOptions;
  }) => Promise<void>;
  isAnalyzing: boolean;
  analysisStageText: string;
  analysisError: string | null;
  onClearError: () => void;
  initialMutatedSequence?: string;
  initialReferenceSequence?: string;
  initialAnalysisContext?: AnalysisContext;
}

const MAX_SUPPORTED_LENGTH = 10000;

interface BenchmarkPreset {
  id: string;
  name: string;
  badge: string;
  gene: string;
  accession: string;
  organism: string;
  reference: string;
  variant: string;
  description: string;
}

interface ComparisonBenchmarkPreset {
  id: string;
  name: string;
  gene: string;
  accession: string;
  pdb_id?: string;
  reference: string;
  variantA: string;
  variantAName: string;
  variantB: string;
  variantBName: string;
  description: string;
}

const COMPARISON_BENCHMARKS: ComparisonBenchmarkPreset[] = [
  {
    id: 'kras-g12d-g12v',
    name: 'KRAS G12D vs G12V',
    gene: 'KRAS',
    accession: 'NM_004985.5',
    pdb_id: '6OIM',
    reference: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG',
    variantA: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG',
    variantAName: 'KRAS G12D (c.35G>A)',
    variantB: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGTTGGCGTAGGCAAGAGTGCCTTGACG',
    variantBName: 'KRAS G12V (c.35G>T)',
    description: 'Codon 12 oncogenic hotspot comparison: Gly12Asp (polar acidic) vs Gly12Val (hydrophobic).',
  },
  {
    id: 'braf-v600e-v600k',
    name: 'BRAF V600E vs V600K',
    gene: 'BRAF',
    accession: 'NM_004333.6',
    reference: 'ATGGCGGCGCTGAGCGGTGGCGGTGGTGGTTGCTTGGTGGTGGAGATATTTGGT',
    variantA: 'ATGGCGGCGCTGAGCGGTGGCGGTGGTGGTTGCTTGGTGGTGGAGATATATGGT',
    variantAName: 'BRAF V600E',
    variantB: 'ATGGCGGCGCTGAGCGGTGGCGGTGGTGGTTGCTTGGTGGTGGAGATAAAGGGT',
    variantBName: 'BRAF V600K',
    description: 'Kinase activation domain comparison: Val600Glu vs Val600Lys.',
  },
  {
    id: 'tp53-r273h-r273c',
    name: 'TP53 R273H vs R273C',
    gene: 'TP53',
    accession: 'NM_000546.6',
    pdb_id: '1TUP',
    reference: 'ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGA',
    variantA: 'ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCACGA',
    variantAName: 'TP53 R273H',
    variantB: 'ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCATGA',
    variantBName: 'TP53 R273C',
    description: 'DNA-binding domain contact residue hotspot comparison: Arg273His vs Arg273Cys.',
  },
];

const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'kras-g12d',
    name: 'KRAS G12D Oncogene',
    badge: 'Missense Driver',
    gene: 'KRAS',
    accession: 'NM_004985.5',
    organism: 'Homo sapiens',
    reference: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG',
    variant: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG',
    description: 'c.35G>A (p.Gly12Asp) hotspot mutation in P-loop activating GTPase signaling in colorectal & pancreatic cancer.',
  },
  {
    id: 'hbb-sickle',
    name: 'HBB Sickle Cell (E6V)',
    badge: 'Monogenic HbS',
    gene: 'HBB',
    accession: 'NM_000518.5',
    organism: 'Homo sapiens',
    reference: 'ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCC',
    variant: 'ATGGTGCACCTGACTCCTGTGGAGAAGTCTGCCGTTACTGCC',
    description: 'c.20A>T (p.Glu6Val) substitution in beta-globin resulting in hydrophobic valine polymerizing under low oxygen.',
  },
  {
    id: 'brca1-indel',
    name: 'BRCA1 Exon 2 Frameshift',
    badge: 'Frameshift Deletion',
    gene: 'BRCA1',
    accession: 'NM_007294.4',
    organism: 'Homo sapiens',
    reference: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAA',
    variant: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGAA',
    description: '4-bp deletion causing downstream reading frame disruption, premature stop codon, and loss of DNA double-strand repair.',
  },
  {
    id: 'synthetic-21',
    name: 'Synthetic Oligo (c.7G>T)',
    badge: 'Reference Benchmark',
    gene: 'EDU-MAEFPK',
    accession: 'SYN-EDU-21BP',
    organism: 'Synthetic Educational Benchmark',
    reference: 'ATGGCTGAATTTCCGAAATAA',
    variant: 'ATGGCTTAATTTCCGAAATAA',
    description: 'Idealized 21-bp test duplex with single nucleotide transversion at position 7 for immediate validation.',
  },
];

function computeSequenceTelemetry(seq: string) {
  const clean = seq.replace(/[^ATGCatgc]/g, '').toUpperCase();
  const len = clean.length;
  if (!len) return { len: 0, gc: 0, at: 0, tm: 0, mwKda: 0 };
  const gcCount = (clean.match(/[GC]/g) || []).length;
  const gc = (gcCount / len) * 100;
  const tm = len < 14
    ? (clean.match(/[AT]/g) || []).length * 2 + gcCount * 4
    : 64.9 + 41 * (gcCount - 16.4) / len;
  const mwKda = (len * 650) / 1000;
  return {
    len,
    gc: Math.round(gc * 10) / 10,
    at: Math.round((100 - gc) * 10) / 10,
    tm: Math.round(tm * 10) / 10,
    mwKda: Math.round(mwKda * 10) / 10,
  };
}

export const SequenceInputWorkspace: React.FC<SequenceInputWorkspaceProps> = ({
  onAnalyze,
  onCompareVariants,
  isAnalyzing,
  analysisStageText,
  analysisError,
  onClearError,
  initialMutatedSequence = '',
  initialReferenceSequence = '',
  initialAnalysisContext,
}) => {
  const [analysisMode, setAnalysisMode] = useState<'single' | 'comparison'>('single');
  const [activePresetId, setActivePresetId] = useState<string>('synthetic-21');
  const [activeCompPresetId, setActiveCompPresetId] = useState<string>('kras-g12d-g12v');

  const [refInput, setRefInput] = useState<string>(
    initialReferenceSequence || BENCHMARK_PRESETS[3].reference
  );
  const [varInput, setVarInput] = useState<string>(
    initialMutatedSequence || BENCHMARK_PRESETS[3].variant
  );

  // Variant comparison inputs
  const [varAInput, setVarAInput] = useState<string>(COMPARISON_BENCHMARKS[0].variantA);
  const [varBInput, setVarBInput] = useState<string>(COMPARISON_BENCHMARKS[0].variantB);
  const [varAName, setVarAName] = useState<string>(COMPARISON_BENCHMARKS[0].variantAName);
  const [varBName, setVarBName] = useState<string>(COMPARISON_BENCHMARKS[0].variantBName);

  const [currentContext, setCurrentContext] = useState<AnalysisContext>(
    initialAnalysisContext || {
      organism: BENCHMARK_PRESETS[3].organism,
      gene: BENCHMARK_PRESETS[3].gene,
      accession: BENCHMARK_PRESETS[3].accession,
      sequenceType: 'coding',
      strandOrientation: 'forward',
      readingFrame: 0,
      geneticCode: 'standard',
    }
  );

  const [refError, setRefError] = useState<string | null>(null);
  const [varError, setVarError] = useState<string | null>(null);
  const [varAError, setVarAError] = useState<string | null>(null);
  const [varBError, setVarBError] = useState<string | null>(null);

  // FASTA Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFasta, setIsUploadingFasta] = useState<boolean>(false);
  const [fastaStatus, setFastaStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fastaSeqs, setFastaSeqs] = useState<FastaSequenceItem[]>([]);
  const [showFastaPicker, setShowFastaPicker] = useState<boolean>(false);
  const [selectedFastaTarget, setSelectedFastaTarget] = useState<'ref' | 'var' | 'varA' | 'varB'>('var');
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  const refTelemetry = useMemo(() => computeSequenceTelemetry(refInput), [refInput]);
  const varTelemetry = useMemo(() => computeSequenceTelemetry(varInput), [varInput]);
  const varATelemetry = useMemo(() => computeSequenceTelemetry(varAInput), [varAInput]);
  const varBTelemetry = useMemo(() => computeSequenceTelemetry(varBInput), [varBInput]);

  // Live difference summary
  const liveDiffPreview = useMemo(() => {
    const r = refInput.replace(/[^ATGCatgc]/g, '').toUpperCase();
    const v = varInput.replace(/[^ATGCatgc]/g, '').toUpperCase();
    if (!r || !v) return null;
    if (r === v) return 'Sequences are identical (0 differences)';
    let diffs = 0;
    const min = Math.min(r.length, v.length);
    for (let i = 0; i < min; i++) {
      if (r[i] !== v[i]) diffs++;
    }
    diffs += Math.abs(r.length - v.length);
    return `${diffs} detected difference${diffs === 1 ? '' : 's'} across ${min} bp aligned span`;
  }, [refInput, varInput]);

  const validateSequence = (
    raw: string,
    fieldName: 'Reference' | 'Variant' | 'Variant A' | 'Variant B'
  ): { cleaned: string; error: string | null } => {
    const strippedWhitespace = raw.replace(/\s+/g, '');

    if (!strippedWhitespace) {
      return { cleaned: '', error: `${fieldName} sequence cannot be empty.` };
    }

    const invalidCharsSet = new Set<string>();
    for (const ch of strippedWhitespace) {
      const upper = ch.toUpperCase();
      if (upper !== 'A' && upper !== 'C' && upper !== 'G' && upper !== 'T') {
        invalidCharsSet.add(ch);
      }
    }

    if (invalidCharsSet.size > 0) {
      const invalidList = Array.from(invalidCharsSet).join(', ');
      return {
        cleaned: '',
        error: `${fieldName} sequence contains unsupported character(s): ${invalidList}. Only A, C, G, T are valid.`,
      };
    }

    if (strippedWhitespace.length > MAX_SUPPORTED_LENGTH) {
      return {
        cleaned: '',
        error: `${fieldName} sequence length (${strippedWhitespace.length} bp) exceeds the supported limit of ${MAX_SUPPORTED_LENGTH.toLocaleString()} bp.`,
      };
    }

    return { cleaned: strippedWhitespace.toUpperCase(), error: null };
  };

  const handleRefChange = (val: string) => {
    setRefInput(val);
    setActivePresetId('');
    if (refError) setRefError(null);
    if (analysisError) onClearError();
  };

  const handleVarChange = (val: string) => {
    setVarInput(val);
    setActivePresetId('');
    if (varError) setVarError(null);
    if (analysisError) onClearError();
  };

  const handleVarAChange = (val: string) => {
    setVarAInput(val);
    setActiveCompPresetId('');
    if (varAError) setVarAError(null);
    if (analysisError) onClearError();
  };

  const handleVarBChange = (val: string) => {
    setVarBInput(val);
    setActiveCompPresetId('');
    if (varBError) setVarBError(null);
    if (analysisError) onClearError();
  };

  const handleClearComparisonInputs = () => {
    setRefInput('');
    setVarAInput('');
    setVarBInput('');
    setActiveCompPresetId('');
    setRefError(null);
    setVarAError(null);
    setVarBError(null);
    if (analysisError) onClearError();
  };

  const handleSelectPreset = (preset: BenchmarkPreset) => {
    setActivePresetId(preset.id);
    setRefInput(preset.reference);
    setVarInput(preset.variant);
    setCurrentContext({
      organism: preset.organism,
      gene: preset.gene,
      accession: preset.accession,
      sequenceType: 'coding',
      strandOrientation: 'forward',
      readingFrame: 0,
      geneticCode: 'standard',
    });
    setRefError(null);
    setVarError(null);
    if (analysisError) onClearError();
  };

  const handleClearInputs = () => {
    setRefInput('');
    setVarInput('');
    setActivePresetId('');
    setRefError(null);
    setVarError(null);
    if (analysisError) onClearError();
  };

  // Helper sequence transformation actions
  const handleReverseComplement = (target: 'ref' | 'var' | 'varA' | 'varB') => {
    const comp: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
    let src = '';
    if (target === 'ref') src = refInput;
    else if (target === 'var') src = varInput;
    else if (target === 'varA') src = varAInput;
    else if (target === 'varB') src = varBInput;

    const clean = src.replace(/[^ATGCatgc]/g, '').toUpperCase();
    const revComp = clean.split('').reverse().map((b) => comp[b] || b).join('');
    if (target === 'ref') setRefInput(revComp);
    else if (target === 'var') setVarInput(revComp);
    else if (target === 'varA') setVarAInput(revComp);
    else if (target === 'varB') setVarBInput(revComp);
  };

  const handleSelectComparisonPreset = (preset: ComparisonBenchmarkPreset) => {
    setActiveCompPresetId(preset.id);
    setRefInput(preset.reference);
    setVarAInput(preset.variantA);
    setVarBInput(preset.variantB);
    setVarAName(preset.variantAName);
    setVarBName(preset.variantBName);
    setCurrentContext({
      organism: 'Homo sapiens',
      gene: preset.gene,
      accession: preset.accession,
      sequenceType: 'coding',
      strandOrientation: 'forward',
      readingFrame: 0,
      geneticCode: 'standard',
    });
    setRefError(null);
    setVarAError(null);
    setVarBError(null);
    if (analysisError) onClearError();
  };

  const handleFastaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFasta(true);
    setFastaStatus(null);
    try {
      const res = await parseFastaFileAPI(file);
      if (res.valid && res.sequences.length > 0) {
        setFastaSeqs(res.sequences);
        setFastaStatus({
          type: 'success',
          message: 'FASTA sequence loaded successfully.',
        });
        if (res.sequences.length === 1) {
          const loaded = res.sequences[0];
          if (analysisMode === 'comparison') {
            setVarAInput(loaded.sequence);
            setVarAName(loaded.header.slice(0, 30) || 'Variant A');
          } else {
            setVarInput(loaded.sequence);
          }
          if (loaded.id) {
            setCurrentContext((prev) => ({
              ...prev,
              gene: loaded.id.replace(/[^A-Za-z0-9]/g, '') || prev.gene,
            }));
          }
        } else {
          setShowFastaPicker(true);
        }
      } else {
        setFastaStatus({
          type: 'error',
          message: 'Invalid FASTA format. Please upload a valid DNA FASTA file.',
        });
      }
    } catch {
      setFastaStatus({
        type: 'error',
        message: 'Invalid FASTA format. Please upload a valid DNA FASTA file.',
      });
    } finally {
      setIsUploadingFasta(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyFastaSequence = (seq: FastaSequenceItem, target: 'ref' | 'var' | 'varA' | 'varB') => {
    if (target === 'ref') setRefInput(seq.sequence);
    else if (target === 'var') setVarInput(seq.sequence);
    else if (target === 'varA') {
      setVarAInput(seq.sequence);
      setVarAName(seq.header.slice(0, 30) || 'Variant A');
    } else if (target === 'varB') {
      setVarBInput(seq.sequence);
      setVarBName(seq.header.slice(0, 30) || 'Variant B');
    }
    setFastaStatus({
      type: 'success',
      message: 'FASTA sequence loaded successfully.',
    });
    setShowFastaPicker(false);
  };

  const handleCompareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing || !onCompareVariants) return;

    const refValidation = validateSequence(refInput, 'Reference');
    const varAValidation = validateSequence(varAInput, 'Variant A');
    const varBValidation = validateSequence(varBInput, 'Variant B');

    if (refValidation.error) setRefError(refValidation.error);
    if (varAValidation.error) setVarAError(varAValidation.error);
    if (varBValidation.error) setVarBError(varBValidation.error);

    if (refValidation.error || varAValidation.error || varBValidation.error) return;

    const options: AnalysisOptions = {
      detectDifferences: true,
      referenceGuided: true,
      codingConsequence: true,
      structuralMapping: true,
      generateReport: true,
    };

    await onCompareVariants({
      referenceSequence: refValidation.cleaned,
      variantASequence: varAValidation.cleaned,
      variantBSequence: varBValidation.cleaned,
      variantAName: varAName || 'Variant A',
      variantBName: varBName || 'Variant B',
      context: currentContext,
      options,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    if (analysisMode === 'comparison') {
      await handleCompareSubmit(e);
      return;
    }

    const refValidation = validateSequence(refInput, 'Reference');
    const varValidation = validateSequence(varInput, 'Variant');

    if (refValidation.error) setRefError(refValidation.error);
    if (varValidation.error) setVarError(varValidation.error);

    if (refValidation.error || varValidation.error) return;

    const options: AnalysisOptions = {
      detectDifferences: true,
      referenceGuided: true,
      codingConsequence: true,
      structuralMapping: false,
      generateReport: true,
    };

    await onAnalyze({
      referenceSequence: refValidation.cleaned,
      observedSequence: varValidation.cleaned,
      context: currentContext,
      options,
    });
  };

  const activePreset = BENCHMARK_PRESETS.find((p) => p.id === activePresetId);
  const activeCompPreset = COMPARISON_BENCHMARKS.find((p) => p.id === activeCompPresetId);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#FAFAFA] text-[#171717] p-6 md:p-8 space-y-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Workspace Header */}
        <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-2.5">
              <FlaskConical className="w-5 h-5 text-[#0F766E]" />
              <h1 className="text-lg font-semibold text-[#171717] tracking-tight">
                DNA Sequence Analysis &amp; Biophysical Lab
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-[4px] bg-[#F0FDFA] text-[#0F766E] font-medium border border-[#CCFBF1]">
                {analysisMode === 'single' ? 'Single Variant Mode' : 'Dual Comparison Mode'}
              </span>
            </div>

            {/* Mode Toggle & FASTA Upload */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div
                className="inline-flex items-center p-1 rounded-[6px] bg-[#F5F5F5] border border-[#E5E5E5] gap-1"
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={analysisMode === 'single'}
                  onClick={() => setAnalysisMode('single')}
                  className={`px-3 py-1 rounded-[4px] text-xs transition-all duration-150 cursor-pointer border ${
                    analysisMode === 'single'
                      ? 'bg-[#FFFFFF] text-[#171717] font-semibold shadow-xs border-[#E5E5E5]'
                      : 'border-transparent text-[#737373] font-medium hover:text-[#171717]'
                  }`}
                >
                  Single Variant Analysis
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={analysisMode === 'comparison'}
                  onClick={() => setAnalysisMode('comparison')}
                  className={`px-3 py-1 rounded-[4px] text-xs transition-all duration-150 cursor-pointer border ${
                    analysisMode === 'comparison'
                      ? 'bg-[#FFFFFF] text-[#171717] font-semibold shadow-xs border-[#E5E5E5]'
                      : 'border-transparent text-[#737373] font-medium hover:text-[#171717]'
                  }`}
                >
                  Dual Variant Comparison
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFastaFileSelect}
                accept=".fasta,.fa,.txt"
                className="hidden"
              />

              <TacticalButton
                type="button"
                variant="secondary"
                size="sm"
                icon={<Upload className="w-3.5 h-3.5 text-[#0F766E]" />}
                loading={isUploadingFasta}
                loadingText="Loading FASTA…"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload FASTA (.fa, .fasta)
              </TacticalButton>
            </div>
          </div>
          <p className="text-xs text-[#737373] leading-relaxed max-w-3xl">
            {analysisMode === 'single'
              ? 'Select a verified biological benchmark or paste custom DNA sequences to perform full-duplex pairwise alignment, in-silico translation, 3D canonical B-DNA reconstruction, and SantaLucia nearest-neighbor thermodynamics.'
              : 'Compare two distinct variants against a shared reference sequence simultaneously to evaluate differential codon changes, amino-acid substitutions, molecular weight shifts, hydropathy (GRAVY), net charge, and thermodynamic profiles.'}
          </p>
        </div>

        {/* FASTA Validation Status Banner */}
        {fastaStatus && (
          <div
            role="alert"
            className={`p-3.5 rounded-[6px] text-xs flex items-center justify-between gap-3 border ${
              fastaStatus.type === 'success'
                ? 'bg-[#F0FDFA] border-[#CCFBF1] text-[#0F766E]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
            }`}
          >
            <div className="flex items-center gap-2">
              {fastaStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              )}
              <span className="font-medium">{fastaStatus.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFastaStatus(null)}
              className="text-xs text-[#737373] hover:text-[#171717] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Multi-sequence FASTA Picker Modal / Panel */}
        {showFastaPicker && fastaSeqs.length > 1 && (
          <div className="bg-[#FFFFFF] border border-[#0F766E] rounded-[8px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-[#171717] flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-[#0F766E]" />
                  Multi-Sequence FASTA Detected ({fastaSeqs.length} sequences)
                </span>
                <p className="text-[11px] text-[#737373]">
                  Select which input field to populate with each parsed sequence:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFastaPicker(false)}
                className="text-[#737373] hover:text-[#171717] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fastaSeqs.map((seq, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-[#171717] truncate">{seq.header}</div>
                    <div className="text-[11px] text-[#737373] font-mono mt-0.5">
                      {seq.length} bp · GC: {seq.gc_percent}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {analysisMode === 'single' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyFastaSequence(seq, 'ref')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#FFFFFF] border border-[#E5E5E5] hover:border-[#0F766E] text-[#171717] rounded-[4px] cursor-pointer"
                        >
                          Use as Reference
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyFastaSequence(seq, 'var')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#0F766E] text-white hover:bg-[#0D655E] rounded-[4px] cursor-pointer"
                        >
                          Use as Variant
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApplyFastaSequence(seq, 'ref')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#FFFFFF] border border-[#E5E5E5] hover:border-[#0F766E] text-[#171717] rounded-[4px] cursor-pointer"
                        >
                          Reference
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyFastaSequence(seq, 'varA')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#FFFFFF] border border-[#0F766E] text-[#0F766E] rounded-[4px] cursor-pointer"
                        >
                          Variant A
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyFastaSequence(seq, 'varB')}
                          className="px-2.5 py-1 text-xs font-medium bg-[#0F766E] text-white hover:bg-[#0D655E] rounded-[4px] cursor-pointer"
                        >
                          Variant B
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {analysisError && (
          <div
            role="alert"
            className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-xs text-[#DC2626] flex items-start justify-between gap-3"
          >
            <div className="space-y-0.5">
              <strong className="block font-semibold">Unable to Complete Analysis</strong>
              <p>{analysisError}</p>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="text-xs text-[#737373] hover:text-[#171717] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1: SINGLE VARIANT ANALYSIS                                           */}
        {/* ========================================================================= */}
        {analysisMode === 'single' ? (
          <>
            {/* Curated Benchmark Presets Bar */}
            <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#737373] font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0F766E]" />
                  Curated Biological Benchmarks
                </label>
                <span className="text-[11px] text-[#737373]">
                  Verified Hotspots &amp; Experimental Reference Models
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {BENCHMARK_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3 rounded-[6px] text-left transition-all duration-150 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#F0FDFA] border-[#0F766E] shadow-xs'
                          : 'bg-[#FAFAFA] border-[#E5E5E5] hover:border-[#0F766E] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-[#0F766E]' : 'text-[#171717]'}`}>
                          {preset.gene}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-[4px] font-medium ${
                          isSelected ? 'bg-[#0F766E] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#737373] border border-[#E5E5E5]'
                        }`}>
                          {preset.badge}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-[#171717] truncate">{preset.name}</div>
                      <div className="text-[11px] text-[#737373] truncate mt-0.5 font-mono">{preset.accession} · {preset.reference.length} bp</div>
                    </button>
                  );
                })}
              </div>

              {activePreset && (
                <div className="p-3 bg-[#F0FDFA] border border-[#CCFBF1] rounded-[6px] text-xs text-[#171717] flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold uppercase text-[10px] text-[#0F766E]">Benchmark Context:</span>
                    <p className="text-xs text-[#171717]">{activePreset.description}</p>
                  </div>
                  <span className="text-[11px] font-medium text-[#0F766E] shrink-0 font-mono">
                    {activePreset.organism}
                  </span>
                </div>
              )}
            </div>

            {/* Single Sequence Input Form */}
            <form onSubmit={handleSubmit} className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 shadow-xs space-y-6">
              <fieldset disabled={isAnalyzing} className="space-y-5">
                {/* Reference Sequence Area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="reference-dna-input" className="font-semibold text-[#171717] flex items-center gap-2">
                      <span>Reference DNA sequence (5′ → 3′)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#FAFAFA] text-[#737373] border border-[#E5E5E5] font-mono">
                        Wild-type / Canonical
                      </span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleReverseComplement('ref')}
                        className="text-[11px] text-[#737373] hover:text-[#0F766E] font-mono cursor-pointer"
                        title="Compute reverse complement of reference sequence"
                      >
                        Reverse Complement
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="reference-dna-input"
                    value={refInput}
                    onChange={(e) => handleRefChange(e.target.value)}
                    placeholder="Paste reference DNA sequence (A, C, G, T)..."
                    rows={4}
                    spellCheck={false}
                    className={`bc-sequence-mono w-full bg-[#FAFAFA] p-3 text-xs leading-relaxed text-[#171717] border rounded-[6px] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 transition-all ${
                      refError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                        : 'border-[#E5E5E5] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                    }`}
                  />

                  {refError && (
                    <p role="alert" className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {refError}
                    </p>
                  )}

                  {/* Reference Live Telemetry Strip */}
                  {refTelemetry.len > 0 && (
                    <div className="flex items-center gap-4 text-[11px] font-mono text-[#737373] bg-[#FAFAFA] p-2.5 rounded-[6px] border border-[#E5E5E5] flex-wrap">
                      <span>Length: <strong className="text-[#171717]">{refTelemetry.len} bp</strong></span>
                      <span>GC%: <strong className="text-[#15803D]">{refTelemetry.gc}%</strong></span>
                      <span>AT%: <strong className="text-[#0F766E]">{refTelemetry.at}%</strong></span>
                      <span>Duplex MW: <strong className="text-[#171717]">{refTelemetry.mwKda} kDa</strong></span>
                      <span>Est. Tm: <strong className="text-[#0F766E]">{refTelemetry.tm}°C</strong></span>
                    </div>
                  )}
                </div>

                {/* Variant Sequence Area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="variant-dna-input" className="font-semibold text-[#171717] flex items-center gap-2">
                      <span>Variant DNA sequence (5′ → 3′)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] font-mono">
                        Mutated / Candidate
                      </span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleReverseComplement('var')}
                        className="text-[11px] text-[#737373] hover:text-[#0F766E] font-mono cursor-pointer"
                        title="Compute reverse complement of variant sequence"
                      >
                        Reverse Complement
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="variant-dna-input"
                    value={varInput}
                    onChange={(e) => handleVarChange(e.target.value)}
                    placeholder="Paste variant DNA sequence (A, C, G, T)..."
                    rows={4}
                    spellCheck={false}
                    className={`bc-sequence-mono w-full bg-[#FAFAFA] p-3 text-xs leading-relaxed text-[#171717] border rounded-[6px] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 transition-all ${
                      varError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                        : 'border-[#E5E5E5] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                    }`}
                  />

                  {varError && (
                    <p role="alert" className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {varError}
                    </p>
                  )}

                  {/* Variant Live Telemetry Strip */}
                  {varTelemetry.len > 0 && (
                    <div className="flex items-center justify-between text-[11px] font-mono bg-[#FAFAFA] p-2.5 rounded-[6px] border border-[#E5E5E5] flex-wrap gap-2">
                      <div className="flex items-center gap-4 text-[#737373]">
                        <span>Length: <strong className="text-[#171717]">{varTelemetry.len} bp</strong></span>
                        <span>GC%: <strong className="text-[#15803D]">{varTelemetry.gc}%</strong></span>
                        <span>AT%: <strong className="text-[#0F766E]">{varTelemetry.at}%</strong></span>
                        <span>Duplex MW: <strong className="text-[#171717]">{varTelemetry.mwKda} kDa</strong></span>
                        <span>Est. Tm: <strong className="text-[#0F766E]">{varTelemetry.tm}°C</strong></span>
                      </div>
                      {liveDiffPreview && (
                        <span className="text-[#B45309] font-medium">
                          ✦ {liveDiffPreview}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Action Buttons Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-[#F0F0F0] flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <TacticalButton
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isAnalyzing || !refInput.trim() || !varInput.trim()}
                    loading={isAnalyzing}
                    loadingText={analysisStageText || 'Analyzing sequences…'}
                  >
                    Run Sequence Analysis
                  </TacticalButton>

                  <TacticalButton
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={isAnalyzing}
                    onClick={() => handleSelectPreset(BENCHMARK_PRESETS[0])}
                  >
                    Load KRAS G12D
                  </TacticalButton>
                </div>

                <TacticalButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isAnalyzing}
                  onClick={handleClearInputs}
                >
                  Clear sequences
                </TacticalButton>
              </div>

              {/* Translation Assumptions & Metadata Card */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171717] font-mono uppercase text-[11px]">
                    Assumptions &amp; Computational Configuration
                  </span>
                  <span className="text-[#737373] font-mono text-[10px]">NCBI Genetic Code Table 1</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-[#737373] pt-1">
                  <div className="p-2.5 bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5]">
                    <strong className="block text-[#171717] font-mono">Strand Orientation:</strong>
                    5′ to 3′ canonical coding sense strand
                  </div>
                  <div className="p-2.5 bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5]">
                    <strong className="block text-[#171717] font-mono">Reading Frame:</strong>
                    Frame 0 (Starts from coordinate 1)
                  </div>
                  <div className="p-2.5 bg-[#FFFFFF] rounded-[6px] border border-[#E5E5E5]">
                    <strong className="block text-[#171717] font-mono">Biophysical Model:</strong>
                    SantaLucia 1998 unified nearest-neighbor duplex
                  </div>
                </div>
              </div>
            </form>
          </>
        ) : (
          /* ========================================================================= */
          /* MODE 2: DUAL VARIANT COMPARISON                                           */
          /* ========================================================================= */
          <>
            {/* Comparison Presets Bar */}
            <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#737373] font-mono flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-[#0F766E]" />
                  Curated Dual-Variant Comparison Presets
                </label>
                <span className="text-[11px] text-[#737373]">
                  Side-by-side Oncogenic &amp; Biophysical Contrasts
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {COMPARISON_BENCHMARKS.map((preset) => {
                  const isSelected = activeCompPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectComparisonPreset(preset)}
                      className={`p-3 rounded-[6px] text-left transition-all duration-150 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#F0FDFA] border-[#0F766E] shadow-xs'
                          : 'bg-[#FAFAFA] border-[#E5E5E5] hover:border-[#0F766E] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-[#0F766E]' : 'text-[#171717]'}`}>
                          {preset.gene}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-[4px] font-medium bg-[#FFFFFF] text-[#737373] border border-[#E5E5E5]">
                          Comparison
                        </span>
                      </div>
                      <div className="text-xs font-medium text-[#171717] truncate">{preset.name}</div>
                      <div className="text-[11px] text-[#737373] truncate mt-0.5 font-mono">{preset.accession} · {preset.reference.length} bp</div>
                    </button>
                  );
                })}
              </div>

              {activeCompPreset && (
                <div className="p-3 bg-[#F0FDFA] border border-[#CCFBF1] rounded-[6px] text-xs text-[#171717] flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold uppercase text-[10px] text-[#0F766E]">Comparison Context:</span>
                    <p className="text-xs text-[#171717]">{activeCompPreset.description}</p>
                  </div>
                  <span className="text-[11px] font-medium text-[#0F766E] shrink-0 font-mono">
                    {activeCompPreset.gene} Hotspot
                  </span>
                </div>
              )}
            </div>

            {/* Comparison Input Form */}
            <form onSubmit={handleCompareSubmit} className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-5 shadow-xs space-y-6">
              <fieldset disabled={isAnalyzing} className="space-y-5">
                {/* Reference Sequence Area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="comp-ref-input" className="font-semibold text-[#171717] flex items-center gap-2">
                      <span>Shared Reference DNA sequence (5′ → 3′)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#FAFAFA] text-[#737373] border border-[#E5E5E5] font-mono">
                        Wild-type Baseline
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleReverseComplement('ref')}
                      className="text-[11px] text-[#737373] hover:text-[#0F766E] font-mono cursor-pointer"
                      title="Compute reverse complement of reference sequence"
                    >
                      Reverse Complement
                    </button>
                  </div>

                  <textarea
                    id="comp-ref-input"
                    value={refInput}
                    onChange={(e) => handleRefChange(e.target.value)}
                    placeholder="Paste reference DNA sequence..."
                    rows={3}
                    spellCheck={false}
                    className={`bc-sequence-mono w-full bg-[#FAFAFA] p-3 text-xs leading-relaxed text-[#171717] border rounded-[6px] focus:bg-[#FFFFFF] focus:outline-none focus:ring-1 transition-all ${
                      refError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                        : 'border-[#E5E5E5] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                    }`}
                  />
                  {refError && (
                    <p role="alert" className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {refError}
                    </p>
                  )}
                  {refTelemetry.len > 0 && (
                    <div className="flex items-center gap-4 text-[11px] font-mono text-[#737373] bg-[#FAFAFA] p-2.5 rounded-[6px] border border-[#E5E5E5] flex-wrap">
                      <span>Length: <strong className="text-[#171717]">{refTelemetry.len} bp</strong></span>
                      <span>GC%: <strong className="text-[#15803D]">{refTelemetry.gc}%</strong></span>
                      <span>Duplex MW: <strong className="text-[#171717]">{refTelemetry.mwKda} kDa</strong></span>
                      <span>Est. Tm: <strong className="text-[#0F766E]">{refTelemetry.tm}°C</strong></span>
                    </div>
                  )}
                </div>

                {/* Dual Variant Grid (Variant A & Variant B) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Variant A */}
                  <div className="space-y-2 p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0F766E]"></span>
                        <input
                          type="text"
                          value={varAName}
                          onChange={(e) => setVarAName(e.target.value)}
                          placeholder="Variant A Name"
                          className="font-semibold text-xs text-[#171717] bg-transparent border-b border-transparent hover:border-[#E5E5E5] focus:border-[#0F766E] focus:outline-none px-1 py-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReverseComplement('varA')}
                        className="text-[10px] text-[#737373] hover:text-[#0F766E] font-mono cursor-pointer"
                      >
                        RevComp
                      </button>
                    </div>

                    <textarea
                      value={varAInput}
                      onChange={(e) => handleVarAChange(e.target.value)}
                      placeholder="Paste Variant A DNA sequence..."
                      rows={4}
                      spellCheck={false}
                      className={`bc-sequence-mono w-full bg-[#FFFFFF] p-2.5 text-xs leading-relaxed text-[#171717] border rounded-[4px] focus:outline-none focus:ring-1 transition-all ${
                        varAError
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                          : 'border-[#E5E5E5] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                      }`}
                    />
                    {varAError && (
                      <p role="alert" className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {varAError}
                      </p>
                    )}
                    {varATelemetry.len > 0 && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#737373] bg-[#FFFFFF] p-2 rounded border border-[#E5E5E5]">
                        <span>{varATelemetry.len} bp · GC {varATelemetry.gc}%</span>
                        <span>Tm: {varATelemetry.tm}°C</span>
                      </div>
                    )}
                  </div>

                  {/* Variant B */}
                  <div className="space-y-2 p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px]">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]"></span>
                        <input
                          type="text"
                          value={varBName}
                          onChange={(e) => setVarBName(e.target.value)}
                          placeholder="Variant B Name"
                          className="font-semibold text-xs text-[#171717] bg-transparent border-b border-transparent hover:border-[#E5E5E5] focus:border-[#0F766E] focus:outline-none px-1 py-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReverseComplement('varB')}
                        className="text-[10px] text-[#737373] hover:text-[#0F766E] font-mono cursor-pointer"
                      >
                        RevComp
                      </button>
                    </div>

                    <textarea
                      value={varBInput}
                      onChange={(e) => handleVarBChange(e.target.value)}
                      placeholder="Paste Variant B DNA sequence..."
                      rows={4}
                      spellCheck={false}
                      className={`bc-sequence-mono w-full bg-[#FFFFFF] p-2.5 text-xs leading-relaxed text-[#171717] border rounded-[4px] focus:outline-none focus:ring-1 transition-all ${
                        varBError
                          ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20'
                          : 'border-[#E5E5E5] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                      }`}
                    />
                    {varBError && (
                      <p role="alert" className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {varBError}
                      </p>
                    )}
                    {varBTelemetry.len > 0 && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#737373] bg-[#FFFFFF] p-2 rounded border border-[#E5E5E5]">
                        <span>{varBTelemetry.len} bp · GC {varBTelemetry.gc}%</span>
                        <span>Tm: {varBTelemetry.tm}°C</span>
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Action Buttons Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-[#F0F0F0] flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <TacticalButton
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isAnalyzing || !refInput.trim() || !varAInput.trim() || !varBInput.trim()}
                    loading={isAnalyzing}
                    loadingText={analysisStageText || 'Comparing variants…'}
                  >
                    Compare Dual Variants
                  </TacticalButton>

                  <TacticalButton
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={isAnalyzing}
                    onClick={() => handleSelectComparisonPreset(COMPARISON_BENCHMARKS[0])}
                  >
                    Load KRAS G12D vs G12V
                  </TacticalButton>
                </div>

                <TacticalButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isAnalyzing}
                  onClick={handleClearComparisonInputs}
                >
                  Clear sequences
                </TacticalButton>
              </div>

              {/* Comparison Methodology Card */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#171717] font-mono uppercase text-[11px]">
                    Dual Variant Comparison Engine
                  </span>
                  <span className="text-[#737373] font-mono text-[10px]">13-Metric Differential Matrix</span>
                </div>
                <p className="text-[11px] text-[#737373] leading-relaxed">
                  Dual comparison aligns both variants against the reference, calculating molecular weight deltas (Da), hydropathy indices (GRAVY Kyte-Doolittle), formal net charges at pH 7.4, GC% deltas, and melting temperature shifts side-by-side.
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
