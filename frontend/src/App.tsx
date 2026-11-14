import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import './App.css';
import './workstation.css';

import {
  SidebarNav,
  type AppNavTab,
} from './components/ui/SidebarNav';

import { LandingPage } from './components/ui/LandingPage';
import { SequenceInputWorkspace } from './components/ui/SequenceInputWorkspace';
import { ResultsAndEditView } from './components/ui/ResultsAndEditView';
import { ReportView } from './components/ui/ReportView';
import { HelpLimitationsModal } from './components/ui/HelpLimitationsModal';
import { TacticalButton } from './components/ui/TacticalButton';
import { ScientificLoader } from './components/ui/ScientificLoader';
import { BookOpen, Plus } from 'lucide-react';

import type {
  AnalysisContext,
  AnalysisOptions,
  FullAnalysisResult,
  MutationExperimentResult,
  SequenceEditRecord,
} from './types/dna';

import {
  analyzeMutationExperimentAPI,
  compareSequencesAPI,
  fetchPdbAPI,
} from './services/apiService';

type RequestKind = 'compare' | 'reanalyse' | 'replace';

interface AnalyzeParams {
  referenceSequence: string;
  observedSequence: string;
  context: AnalysisContext;
  options: AnalysisOptions;
}

interface EditInput {
  position: number;
  oldBases: string;
  newBases: string;
  action: string;
}

interface AnalysisInput {
  reference: string;
  variant: string;
  context: AnalysisContext;
}

interface AnalysisSnapshot {
  id: string;
  version: string;
  revision: number;
  timestamp: string;
  reference: string;
  originalVariant: string;
  variant: string;
  context: AnalysisContext;
  result: FullAnalysisResult;
  experiment: MutationExperimentResult;
  pdbData: string | null;
}

interface RequestState {
  kind: RequestKind;
  message: string;
}

interface FailureState {
  kind: RequestKind;
  message: string;
}

const defaultContext = (): AnalysisContext => ({
  organism: 'Not specified',
  gene: '',
  accession: '',
  sequenceType: 'coding',
  strandOrientation: 'unknown',
  readingFrame: 0,
  geneticCode: 'standard',
});

const normalizeDNA = (value: string): string =>
  value.replace(/\s+/g, '').toUpperCase();

const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : 'Analysis failed. Please try again.';

const createId = (): string =>
  `AN-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`.toUpperCase();

function validateDNA(sequence: string, label: string): void {
  if (!sequence) {
    throw new Error(`${label} cannot be empty.`);
  }

  const invalid = [...new Set(sequence.replace(/[ATGC]/g, ''))];

  if (invalid.length) {
    throw new Error(
      `${label} contains unsupported characters: ${invalid.join(', ')}.`,
    );
  }
}

function prepareInput(input: AnalysisInput): AnalysisInput {
  const reference = normalizeDNA(input.reference);
  const variant = normalizeDNA(input.variant);

  validateDNA(reference, 'Reference DNA');
  validateDNA(variant, 'Variant DNA');

  /*
   * Preserve the existing API's supported scope.
   * Expand both API contracts before enabling other translation settings.
   */
  if (
    input.context.readingFrame !== 0 ||
    input.context.geneticCode !== 'standard'
  ) {
    throw new Error(
      'This analysis path currently supports frame 0 and the standard genetic code.',
    );
  }

  return {
    reference,
    variant,
    context: { ...input.context },
  };
}

async function executeAnalysis(input: AnalysisInput) {
  const [experiment, comparison] = await Promise.all([
    analyzeMutationExperimentAPI({
      reference_sequence: input.reference,
      variant_sequence: input.variant,
      reading_frame: input.context.readingFrame,
    }),

    compareSequencesAPI({
      reference_sequence: input.reference,
      observed_sequence: input.variant,
      reading_frame: input.context.readingFrame,
      table_id: 1,
      gene: input.context.gene || 'Unspecified',
      is_coding: input.context.sequenceType === 'coding',
    }),
  ]);

  let pdbData: string | null = null;
  let structureError: string | null = null;

  const mapping = comparison.structure_mapping;

  if (mapping?.mapped && mapping.pdb_id) {
    try {
      pdbData = await fetchPdbAPI(mapping.pdb_id);
    } catch (error) {
      structureError = errorMessage(error);
      pdbData = comparison.dna_structure?.pdb_data ?? null;
    }
  } else {
    pdbData = comparison.dna_structure?.pdb_data ?? null;
  }

  return {
    experiment,
    pdbData,
    result: {
      ...comparison,
      pdb_data: pdbData,
      structure_error: structureError,
    } as FullAnalysisResult,
  };
}

/* Loading UI uses existing neutral colours and does not add dependencies. */

function SkeletonBlock({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded bg-neutral-200 motion-safe:animate-pulse ${className}`}
    />
  );
}

function AnalysisSkeleton({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#FAFAF9] p-6 sm:p-8"
    >
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] p-6 shadow-xs">
          <ScientificLoader
            title={message || 'Processing DNA Sequence Comparison'}
            stage="Running In-Silico Pipeline"
            subtext="Performing global Needleman-Wunsch pairwise alignment, translation, thermodynamic analysis, and 3D molecular mapping…"
          />
        </div>

        <div aria-hidden="true" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="space-y-3 rounded-[8px] border border-[#E5E5E5] bg-[#FFFFFF] p-4 shadow-xs"
              >
                <SkeletonBlock className="h-3 w-20 bg-[#F5F5F5]" />
                <SkeletonBlock className="h-7 w-16 bg-[#F0FDFA]" />
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-[8px] border border-[#E5E5E5] bg-[#FFFFFF] p-5 shadow-xs">
            <SkeletonBlock className="h-4 w-48 bg-[#F5F5F5]" />
            {[0, 1, 2].map((item) => (
              <SkeletonBlock key={item} className="h-4 w-full bg-[#F5F5F5]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [launched, setLaunched] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.hash === '#lab' ||
        window.location.search.includes('lab=true') ||
        window.location.pathname.includes('/lab')
      );
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState<AppNavTab>('results');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [analysis, setAnalysis] = useState<AnalysisSnapshot | null>(null);
  const analysisRef = useRef<AnalysisSnapshot | null>(null);

  const [draft, setDraftState] = useState('');
  const draftRef = useRef('');

  const [editHistory, setEditHistory] = useState<SequenceEditRecord[]>([]);
  const historyRef = useRef<SequenceEditRecord[]>([]);

  const [pending, setPending] = useState<RequestState | null>(null);
  const pendingRef = useRef(false);

  const [failure, setFailure] = useState<FailureState | null>(null);
  const [inputVersion, setInputVersion] = useState(0);

  const generation = useRef(0);

  const setDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraftState(value);
  }, []);

  const setHistory = useCallback((value: SequenceEditRecord[]) => {
    historyRef.current = value;
    setEditHistory(value);
  }, []);

  const invalidateRequest = useCallback(() => {
    generation.current += 1;
    pendingRef.current = false;
    setPending(null);
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const runAnalysis = useCallback(
    async (
      rawInput: AnalysisInput,
      kind: RequestKind,
      previous: AnalysisSnapshot | null,
    ): Promise<boolean> => {
      if (pendingRef.current) return false;

      const requestId = ++generation.current;
      pendingRef.current = true;

      setFailure(null);
      setPending({
        kind,
        message:
          kind === 'compare'
            ? 'Comparing your sequences…'
            : 'Recalculating alignment and sequence results…',
      });

      try {
        const input = prepareInput(rawInput);
        const output = await executeAnalysis(input);

        if (requestId !== generation.current) return false;

        const startsNew = (kind === 'compare' && previous === null);

        const snapshot: AnalysisSnapshot = {
          id: startsNew || !previous ? createId() : previous.id,
          version: createId(),
          revision: startsNew || !previous ? 1 : previous.revision + 1,
          timestamp: new Date().toISOString(),
          reference: input.reference,
          variant: input.variant,
          originalVariant: startsNew || !previous
            ? input.variant
            : (previous.originalVariant || previous.variant),
          context: input.context,
          result: output.result,
          experiment: output.experiment,
          pdbData: output.pdbData,
        };

        analysisRef.current = snapshot;
        setAnalysis(snapshot);

        setDraft(input.variant);
        if (startsNew) {
          setHistory([]);
        }

        if (kind !== 'reanalyse') {
          setActiveTab('results');
        }

        return true;
      } catch (error) {
        if (requestId === generation.current) {
          setFailure({
            kind,
            message: errorMessage(error),
          });
        }

        return false;
      } finally {
        if (requestId === generation.current) {
          pendingRef.current = false;
          setPending(null);
        }
      }
    },
    [setDraft, setHistory],
  );

  const handleAnalyze = useCallback(
    async (params: AnalyzeParams): Promise<void> => {
      await runAnalysis(
        {
          reference: params.referenceSequence,
          variant: params.observedSequence,
          context: params.context,
        },
        'compare',
        null,
      );
    },
    [runAnalysis],
  );

  // Auto-initialize with verified biological benchmark if launched without prior analysis
  useEffect(() => {
    if (launched && !analysisRef.current && !pendingRef.current) {
      void runAnalysis(
        {
          reference: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG',
          variant: 'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG',
          context: {
            gene: 'KRAS',
            organism: 'Homo sapiens',
            accession: 'NM_004985.5',
            sequenceType: 'coding',
            strandOrientation: 'forward',
            readingFrame: 0,
            geneticCode: 'standard',
          },
        },
        'compare',
        null,
      );
    }
  }, [launched, runAnalysis]);

  const handleReanalyse = useCallback(async (): Promise<void> => {
    const current = analysisRef.current;
    if (!current) return;

    await runAnalysis(
      {
        reference: current.reference,
        variant: draftRef.current,
        context: current.context,
      },
      'reanalyse',
      current,
    );
  }, [runAnalysis]);

  const handleReplaceSequences = useCallback(
    async (reference: string, variant: string): Promise<void> => {
      const current = analysisRef.current;
      if (!current) return;

      // Identify modified positions between current.variant and new variant
      const oldSeq = current.variant;
      const newSeq = variant;
      const newRecords: SequenceEditRecord[] = [];
      const minLen = Math.min(oldSeq.length, newSeq.length);
      for (let i = 0; i < minLen; i++) {
        if (oldSeq[i] !== newSeq[i]) {
          newRecords.push({
            id: createId(),
            timestamp: new Date().toISOString(),
            position: i + 1,
            oldBases: oldSeq[i],
            newBases: newSeq[i],
            action: `Changed pos ${i + 1}: ${oldSeq[i]} → ${newSeq[i]}`,
            reason: 'Sequence replacement',
          });
        }
      }
      if (newRecords.length > 0) {
        setHistory([...newRecords, ...historyRef.current]);
      }

      const succeeded = await runAnalysis(
        {
          reference,
          variant,
          context: current.context,
        },
        'replace',
        current,
      );

      if (!succeeded) {
        /*
         * The parent displays the failure. Child replacement forms must not
         * assume a resolved Promise<void> means replacement succeeded.
         */
        return;
      }
    },
    [runAnalysis, setHistory],
  );

  const handleApplyEdit = useCallback(
    async (edit: EditInput): Promise<string | null> => {
      const current = analysisRef.current;

      if (!current) return 'Compare sequences before applying an edit.';
      if (pendingRef.current) return 'Please wait for analysis to finish.';

      if (!Number.isInteger(edit.position)) {
        return 'Position must be a whole number.';
      }

      const sequence = draftRef.current;
      const start = edit.position - 1;
      const oldBases = normalizeDNA(edit.oldBases);
      const newBases = normalizeDNA(edit.newBases);

      if (/[^ATGC]/.test(oldBases + newBases)) {
        return 'Use A, T, G, and C only.';
      }

      if (oldBases === newBases) {
        return 'This edit does not change the sequence.';
      }

      if (
        start < 0 ||
        start > sequence.length ||
        start + oldBases.length > sequence.length
      ) {
        return 'The selected edit is outside the variant sequence.';
      }

      if (sequence.slice(start, start + oldBases.length) !== oldBases) {
        return 'The selected bases have changed. Select the position again.';
      }

      const next =
        sequence.slice(0, start) +
        newBases +
        sequence.slice(start + oldBases.length);

      if (!next) return 'The variant sequence cannot be empty.';

      const record: SequenceEditRecord = {
        id: createId(),
        timestamp: new Date().toISOString(),
        position: edit.position,
        oldBases,
        newBases,
        action: edit.action,
        reason: 'User sequence edit',
      };

      setDraft(next);
      setHistory([record, ...historyRef.current]);

      /*
       * Pass the edited sequence explicitly.
       * Await the reanalysis request so caller knows result status.
       */
      const succeeded = await runAnalysis(
        {
          reference: current.reference,
          variant: next,
          context: current.context,
        },
        'reanalyse',
        current,
      );

      if (!succeeded) {
        return 'Reanalysis failed. Your draft has been preserved.';
      }

      return null;
    },
    [runAnalysis, setDraft, setHistory],
  );

  const handleUndoLastEdit = useCallback(() => {
    if (pendingRef.current) return;

    const last = historyRef.current[0];
    if (!last) return;

    const sequence = draftRef.current;
    const start = last.position - 1;

    if (
      sequence.slice(start, start + last.newBases.length) !==
      last.newBases
    ) {
      setFailure({
        kind: 'reanalyse',
        message: 'The draft no longer matches the edit being undone.',
      });
      return;
    }

    setDraft(
      sequence.slice(0, start) +
      last.oldBases +
      sequence.slice(start + last.newBases.length),
    );

    setHistory(historyRef.current.slice(1));
    setFailure(null);
  }, [setDraft, setHistory]);

  const handleDiscardEdits = useCallback(() => {
    if (pendingRef.current) return;

    const current = analysisRef.current;
    if (!current) return;

    setDraft(current.variant);
    setHistory([]);
    setFailure(null);
  }, [setDraft, setHistory]);

  const handleResetVariant = useCallback(async () => {
    const current = analysisRef.current;
    if (!current || pendingRef.current) return;
    setDraft(current.reference);
    await runAnalysis(
      {
        reference: current.reference,
        variant: current.reference,
        context: current.context,
      },
      'reanalyse',
      current,
    );
  }, [runAnalysis, setDraft]);

  const handleNewAnalysis = useCallback(() => {
    invalidateRequest();

    analysisRef.current = null;
    setAnalysis(null);

    setDraft('');
    setHistory([]);
    setFailure(null);
    setActiveTab('analyze');
    setInputVersion((value) => value + 1);
  }, [invalidateRequest, setDraft, setHistory]);

  const navigate = useCallback((tab: AppNavTab) => {
    if (pendingRef.current) return;
    if (tab !== 'analyze' && !analysisRef.current) return;

    setActiveTab(tab);
  }, []);

  if (!launched) {
    return (
      <LandingPage
        onLaunch={() => {
          if (typeof window !== 'undefined') {
            window.location.hash = 'lab';
          }
          setLaunched(true);
        }}
      />
    );
  }

  const hasAnalysis = analysis !== null;
  const hasPendingEdits = !!analysis && draft !== analysis.variant;

  const isAnalyzing = pending?.kind === 'compare';
  const isReanalysing = !!pending && pending.kind !== 'compare';

  const showGlobalError =
    !!failure &&
    !(activeTab === 'analyze' && failure.kind === 'compare');

  const pageLabel =
    activeTab === 'analyze'
      ? 'Analyze'
      : activeTab === 'results'
        ? 'Results & Edit'
        : 'Report';

  return (
    <div className="bc-workstation flex h-screen w-full flex-col overflow-hidden bg-white text-black">
      <header className="bc-command-bar z-30 flex h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] bg-white px-6">
        <div className="bc-command-brand flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="bc-command-wordmark whitespace-nowrap font-bold text-[14px] text-[#171717] tracking-wide">
              BIOCRYSTAL <span className="text-[#0F766E]">3D</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#F0FDFA] text-[#0F766E] font-semibold border border-[#CCFBF1]">
              v2.4
            </span>
          </div>

          <div className="h-4 w-px bg-[#E5E5E5]" />

          <span className="bc-command-section text-xs font-medium text-[#737373]">
            {pageLabel}
          </span>
        </div>

        <div className="bc-command-actions flex items-center gap-2.5">
          <TacticalButton
            type="button"
            variant="secondary"
            size="sm"
            arrow={false}
            onClick={() => setHelpOpen(true)}
            icon={<BookOpen className="w-3.5 h-3.5 text-[#176B68]" />}
          >
            Methodology
          </TacticalButton>

          {hasAnalysis && (
            <TacticalButton
              type="button"
              variant="primary"
              size="sm"
              arrow={false}
              onClick={handleNewAnalysis}
              icon={<Plus className="w-3.5 h-3.5 text-white" />}
            >
              New analysis
            </TacticalButton>
          )}
        </div>
      </header>

      <div className="bc-workspace-body relative flex min-h-0 flex-1 overflow-hidden">
        <SidebarNav
          activeTab={activeTab}
          setActiveTab={navigate}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          hasAnalysisResults={hasAnalysis}
          hasStructureMapped={analysis?.result?.structure_mapping?.mapped ?? false}
          onNewAnalysis={handleNewAnalysis}
          mutationCount={analysis?.result?.alignment?.mutation_count ?? 0}
          isModified={editHistory.length > 0}
          backendStatus="ONLINE"
          onOpenHelp={() => setHelpOpen(true)}
        />

        <main
          aria-label={pageLabel}
          aria-busy={!!pending}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#FAFAFA]"
        >
          {showGlobalError && failure && (
            <div
              role="alert"
              className="flex shrink-0 items-start justify-between gap-4 border-b border-red-500 px-5 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">Analysis was not completed.</p>
                <p className="mt-1">{failure.message}</p>
                <p className="mt-1">
                  Your draft and previous completed result were preserved.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFailure(null)}
                className="shrink-0 underline underline-offset-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'analyze' && (
            <div
              hidden={!!pending}
              className="flex min-h-0 flex-1 flex-col"
            >
              <SequenceInputWorkspace
                key={inputVersion}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                analysisStageText={pending?.message ?? ''}
                analysisError={
                  failure?.kind === 'compare' ? failure.message : null
                }
                onClearError={() => setFailure(null)}
                initialMutatedSequence={draft}
                initialReferenceSequence={analysis?.reference ?? ''}
                initialAnalysisContext={
                  analysis?.context ?? defaultContext()
                }
              />
            </div>
          )}

          {activeTab === 'results' && analysis && (
            <div
              hidden={!!pending && pending.kind === 'compare'}
              className="flex min-h-0 flex-1 flex-col"
            >
              {hasPendingEdits && (
                <div
                  role="status"
                  className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3 text-sm"
                >
                  <p>
                    Your draft has changed. Highlighting and results below
                    belong to the last completed analysis.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleReanalyse()}
                    className="rounded bg-black px-4 py-2 text-white"
                  >
                    Reanalyse edits
                  </button>
                </div>
              )}

              <ResultsAndEditView
                key={analysis.id}
                analysisResult={analysis.result}
                referenceSequence={analysis.reference}
                originalSubmittedSequence={analysis.originalVariant}
                currentEditedSequence={draft}
                lastAnalysedSequence={analysis.variant}
                editHistory={editHistory}
                onApplyEdit={handleApplyEdit}
                onUndoLastEdit={handleUndoLastEdit}
                onDiscardEdits={handleDiscardEdits}
                onReanalyse={handleReanalyse}
                onResetVariant={handleResetVariant}
                isReanalysing={isReanalysing}
                gene={analysis.context.gene}
                accession={analysis.context.accession}
                organism={analysis.context.organism}
                pdbData={analysis.pdbData}
                onNavigateToReport={() => navigate('report')}
                onReplaceSequences={handleReplaceSequences}
                mutationExperiment={analysis.experiment}
              />
            </div>
          )}

          {activeTab === 'report' && analysis && (
            <div
              hidden={!!pending}
              className="flex min-h-0 flex-1 flex-col"
            >
              {hasPendingEdits && (
                <div
                  role="status"
                  className="shrink-0 border-b border-neutral-200 px-5 py-3 text-sm"
                >
                  This report excludes draft edits that have not been
                  successfully analyzed.
                </div>
              )}

              <ReportView
                key={analysis.version}
                analysisResult={analysis.result}
                referenceSequence={analysis.reference}
                originalSubmittedSequence={analysis.originalVariant}
                currentEditedSequence={analysis.variant}
                lastAnalysedSequence={analysis.variant}
                editHistory={[]}
                revision={analysis.revision}
                analysisId={analysis.id}
                analysisTimestamp={analysis.timestamp}
                gene={analysis.context.gene}
                accession={analysis.context.accession}
                organism={analysis.context.organism}
                sequenceType={analysis.context.sequenceType}
                readingFrame={analysis.context.readingFrame}
                geneticCode={analysis.context.geneticCode}
                onReanalyse={handleReanalyse}
                isReanalysing={isReanalysing}
                currentExperiment={analysis.experiment}
                onNavigateToResults={() => navigate('results')}
                onNavigateToAnalyze={() => navigate('analyze')}
              />
            </div>
          )}

          {pending && pending.kind === 'compare' && (
            <div className="absolute inset-0 z-20 bg-white">
              <AnalysisSkeleton message={pending.message} />
            </div>
          )}
        </main>
      </div>

      <HelpLimitationsModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}

export default App;