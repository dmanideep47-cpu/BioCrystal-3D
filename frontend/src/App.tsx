import React, { useState, useCallback, useEffect } from 'react';
import './App.css';

import { LandingPage } from './components/ui/LandingPage';
import { SidebarNav, AppNavTab } from './components/ui/SidebarNav';
import { SequenceInputWorkspace } from './components/ui/SequenceInputWorkspace';
import { ResultsAndEditView } from './components/ui/ResultsAndEditView';
import { ReportView } from './components/ui/ReportView';
import { HelpLimitationsModal } from './components/ui/HelpLimitationsModal';

import {
  AnalysisContext,
  AnalysisOptions,
  FullAnalysisResult,
  BackendStatus,
  SequenceEditRecord,
} from './types/dna';
import {
  compareSequencesAPI,
  fetchPdbAPI,
  validateSequenceAPI,
  checkBackendHealthAPI,
} from './services/apiService';
import {
  Dna,
  FileText,
  HelpCircle,
  RotateCcw,
  GitCompare,
} from 'lucide-react';

export function App() {
  // Application Stage: Landing Page -> Workstation (Analyze / Results / Report)
  const [workspaceLaunched, setWorkspaceLaunched] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Active navigation tab: strictly 'analyze' | 'results' | 'report'
  const [activeTab, setActiveTab] = useState<AppNavTab>('analyze');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Backend Health State (CONNECTING, ONLINE, OFFLINE, ERROR)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('CONNECTING');

  const refreshBackendHealth = useCallback(async () => {
    try {
      await checkBackendHealthAPI();
      setBackendStatus('ONLINE');
    } catch {
      setBackendStatus('OFFLINE');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const runCheck = async () => {
      try {
        await checkBackendHealthAPI();
        if (isMounted) setBackendStatus('ONLINE');
      } catch {
        if (isMounted) setBackendStatus('OFFLINE');
      }
    };
    runCheck();
    const intervalId = setInterval(runCheck, 25000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Analysis Progress and Error States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalysing, setIsReanalysing] = useState(false);
  const [analysisStageText, setAnalysisStageText] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // =========================================================================
  // Three-State Sequence Model & Edit History
  // =========================================================================
  const [originalSubmittedSequence, setOriginalSubmittedSequence] = useState<string>('');
  const [currentEditedSequence, setCurrentEditedSequence] = useState<string>('');
  const [lastAnalysedSequence, setLastAnalysedSequence] = useState<string>('');
  const [referenceSequence, setReferenceSequence] = useState<string>('');
  const [editHistory, setEditHistory] = useState<SequenceEditRecord[]>([]);
  const [revision, setRevision] = useState<number>(1);

  // Analysis Context & Results State
  const [analysisContext, setAnalysisContext] = useState<AnalysisContext>({
    organism: 'Homo sapiens',
    gene: 'KRAS',
    accession: 'NM_004985.5',
    sequenceType: 'coding',
    strandOrientation: 'forward',
    readingFrame: 0,
    geneticCode: 'standard',
  });

  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null);
  const [pdbData, setPdbData] = useState<string | null>(null);

  // Help & Limitations Modal
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Handle Initial Analysis Workflow (from Analyze page)
  const handleAnalyze = useCallback(
    async (params: {
      referenceSequence: string;
      observedSequence: string;
      context: AnalysisContext;
      options: AnalysisOptions;
    }) => {
      setAnalysisError(null);
      setIsAnalyzing(true);

      try {
        setAnalysisStageText('Validating reference and mutated sequences...');
        await validateSequenceAPI(params.referenceSequence);
        await validateSequenceAPI(params.observedSequence);

        setAnalysisStageText('Aligning sequences with Biopython PairwiseAligner...');
        await new Promise((r) => setTimeout(r, 200));

        setAnalysisStageText('Detecting discrete mutation events and indels...');
        const result = await compareSequencesAPI({
          reference_sequence: params.referenceSequence,
          observed_sequence: params.observedSequence,
          reading_frame: params.context.readingFrame >= 0 ? params.context.readingFrame : 0,
          table_id:
            params.context.geneticCode === 'vertebrate_mitochondrial'
              ? 2
              : params.context.geneticCode === 'bacterial_plastid'
              ? 11
              : 1,
          gene: params.context.gene,
          pdb_id: params.context.accession,
          is_coding: params.context.sequenceType === 'coding',
        });

        setAnalysisStageText('Mapping variants to macromolecular coordinates...');
        let pdbContent: string | null = null;
        if (result.structure_mapping?.mapped && result.structure_mapping.pdb_id) {
          try {
            pdbContent = await fetchPdbAPI(result.structure_mapping.pdb_id);
          } catch (e) {
            console.warn('PDB retrieval notice:', e);
          }
        }

        setAnalysisStageText('Initializing Results & Edit workstation...');
        await new Promise((r) => setTimeout(r, 200));

        // Save three-state sequence model
        setReferenceSequence(params.referenceSequence);
        setOriginalSubmittedSequence(params.observedSequence);
        setCurrentEditedSequence(params.observedSequence);
        setLastAnalysedSequence(params.observedSequence);
        setEditHistory([]);
        setRevision(1);

        setAnalysisContext(params.context);
        setAnalysisResult({
          ...result,
          pdb_data: pdbContent,
        });
        setPdbData(pdbContent);

        setHasAnalyzed(true);
        setActiveTab('results'); // Auto-transition to Destination 2
      } catch (err: any) {
        console.error('Analysis error:', err);
        setAnalysisError(
          err.message || 'An error occurred during sequence alignment or structural mapping.'
        );
      } finally {
        setIsAnalyzing(false);
        setAnalysisStageText('');
      }
    },
    []
  );

  // Apply a Single In-Memory Edit to currentEditedSequence
  const handleApplyEdit = useCallback(
    (edit: { position: number; oldBases: string; newBases: string; action: string }) => {
      const pos = edit.position; // 1-based index
      const oldSeq = currentEditedSequence;
      if (pos < 1 || pos > oldSeq.length) return;

      // Replace nucleotide base at target position
      const newSeq =
        oldSeq.slice(0, pos - 1) + edit.newBases + oldSeq.slice(pos - 1 + edit.oldBases.length);
      setCurrentEditedSequence(newSeq);

      // Add to edit history audit trail
      const newRecord: SequenceEditRecord = {
        id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        position: edit.position,
        oldBases: edit.oldBases,
        newBases: edit.newBases,
        action: edit.action,
        reason: 'User Base Edit',
      };
      setEditHistory((prev) => [newRecord, ...prev]);
    },
    [currentEditedSequence]
  );

  // Undo Last Sequence Edit
  const handleUndoLastEdit = useCallback(() => {
    if (editHistory.length === 0) return;
    const [lastEdit, ...remainingEdits] = editHistory;

    const pos = lastEdit.position;
    const cur = currentEditedSequence;
    if (pos >= 1 && pos <= cur.length + 1) {
      const revertedSeq =
        cur.slice(0, pos - 1) + lastEdit.oldBases + cur.slice(pos - 1 + lastEdit.newBases.length);
      setCurrentEditedSequence(revertedSeq);
    }
    setEditHistory(remainingEdits);
  }, [editHistory, currentEditedSequence]);

  // Discard All Pending Edits (Revert to last analysed sequence)
  const handleDiscardEdits = useCallback(() => {
    setCurrentEditedSequence(lastAnalysedSequence);
    setEditHistory([]);
  }, [lastAnalysedSequence]);

  // Reanalyse Edited Sequence (when currentEditedSequence !== lastAnalysedSequence)
  const handleReanalyse = useCallback(async () => {
    if (!analysisResult) return;
    setIsReanalysing(true);

    try {
      const result = await compareSequencesAPI({
        reference_sequence: referenceSequence,
        observed_sequence: currentEditedSequence,
        reading_frame: analysisContext.readingFrame >= 0 ? analysisContext.readingFrame : 0,
        table_id:
          analysisContext.geneticCode === 'vertebrate_mitochondrial'
            ? 2
            : analysisContext.geneticCode === 'bacterial_plastid'
            ? 11
            : 1,
        gene: analysisContext.gene,
        pdb_id: analysisContext.accession,
        is_coding: analysisContext.sequenceType === 'coding',
      });

      let pdbContent = pdbData;
      if (result.structure_mapping?.mapped && result.structure_mapping.pdb_id && !pdbContent) {
        try {
          pdbContent = await fetchPdbAPI(result.structure_mapping.pdb_id);
          setPdbData(pdbContent);
        } catch (e) {
          console.warn('PDB retrieval notice:', e);
        }
      }

      setAnalysisResult({
        ...result,
        pdb_data: pdbContent,
      });

      setLastAnalysedSequence(currentEditedSequence);
      setRevision((prev) => prev + 1);
    } catch (err: any) {
      console.error('Reanalysis error:', err);
      alert(`Reanalysis failed: ${err.message || 'Network error'}`);
    } finally {
      setIsReanalysing(false);
    }
  }, [
    analysisResult,
    referenceSequence,
    currentEditedSequence,
    analysisContext,
    pdbData,
  ]);

  // Reset to Clean Analysis (Start Over)
  const handleNewAnalysis = () => {
    setHasAnalyzed(false);
    setAnalysisResult(null);
    setPdbData(null);
    setOriginalSubmittedSequence('');
    setCurrentEditedSequence('');
    setLastAnalysedSequence('');
    setEditHistory([]);
    setRevision(1);
    setActiveTab('analyze');
    setAnalysisError(null);
  };

  const isSequenceModified = currentEditedSequence !== lastAnalysedSequence;

  // 1. Initial State: Landing Page
  if (!workspaceLaunched) {
    return <LandingPage onLaunch={() => setWorkspaceLaunched(true)} />;
  }

  // 2. Main Workstation Shell (Analyze, Results & Edit, Report)
  return (
    <div className="w-full h-screen flex flex-col bg-[#090A0C] text-[#F4F4F2] select-none overflow-hidden font-mono">
      {/* Top Application Command Bar */}
      <header className="h-14 bg-[#111316] border-b border-[#2A2D33] px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#FF6500]">
            <Dna className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#F4F4F2] tracking-wider uppercase">
                BIOCRYSTAL <span className="text-[#FF6500]">3D</span>
              </span>
              <span className="text-[10px] text-[#70757D]">/</span>
              <span className="text-[10px] text-[#A0A3AA] uppercase">
                {activeTab === 'analyze'
                  ? 'Destination 1: Analyze'
                  : activeTab === 'results'
                  ? `Destination 2: Results & Edit (${analysisContext.gene})`
                  : `Destination 3: Scientific Report`}
              </span>
              {hasAnalyzed && analysisResult && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30">
                  {analysisResult.alignment.mutation_count} Variant(s)
                </span>
              )}
              {isSequenceModified && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#F3B347]/15 text-[#F3B347] border border-[#F3B347]/30 animate-pulse">
                  Modified
                </span>
              )}
            </div>
            <p className="text-[9px] text-[#70757D] font-sans">
              Intelligent DNA Mutation Detection & Macromolecular Workstation
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Backend Status Indicator */}
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-[#17191D] border border-[#2A2D33] text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendStatus === 'ONLINE'
                  ? 'bg-[#35C98A] animate-pulse'
                  : backendStatus === 'CONNECTING'
                  ? 'bg-[#F3B347] animate-ping'
                  : 'bg-[#F06464]'
              }`}
            />
            <span
              className={`font-semibold ${
                backendStatus === 'ONLINE'
                  ? 'text-[#35C98A]'
                  : backendStatus === 'CONNECTING'
                  ? 'text-[#F3B347]'
                  : 'text-[#F06464]'
              }`}
            >
              Backend: {backendStatus}
            </span>
            {backendStatus !== 'ONLINE' && (
              <button
                type="button"
                onClick={refreshBackendHealth}
                className="p-0.5 rounded text-[#A0A3AA] hover:text-[#F4F4F2] cursor-pointer ml-0.5"
                title="Retry FastAPI health check"
              >
                <RotateCcw className="w-2.5 h-2.5 text-[#22C7E8]" />
              </button>
            )}
          </div>

          {/* Quick Tab Jump Buttons (if analyzed) */}
          {hasAnalyzed && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-all cursor-pointer border ${
                  activeTab === 'results'
                    ? 'bg-[#FF6500]/15 text-[#FF6500] border-[#FF6500]/40 font-bold'
                    : 'bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] border-[#2A2D33]'
                }`}
                title="Go to Results & Edit workspace"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Results & Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-all cursor-pointer border ${
                  activeTab === 'report'
                    ? 'bg-[#FF6500]/15 text-[#FF6500] border-[#FF6500]/40 font-bold'
                    : 'bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] border-[#2A2D33]'
                }`}
                title="Go to 4-Page Scientific PDF Report"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Report</span>
              </button>
            </>
          )}

          {/* Help Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] transition-all cursor-pointer"
            title="Scientific Methodology & Limitations"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* New Analysis Reset */}
          {hasAnalyzed && (
            <button
              type="button"
              onClick={handleNewAnalysis}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#35C98A] border border-[#2A2D33] transition-all cursor-pointer"
              title="Reset and start new analysis"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Analysis</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar (Collapsible, Exactly 3 Destinations) */}
        <SidebarNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          hasAnalysisResults={hasAnalyzed}
          hasStructureMapped={analysisResult?.structure_mapping?.mapped ?? false}
          onNewAnalysis={handleNewAnalysis}
          mutationCount={analysisResult?.alignment?.mutation_count ?? 0}
          isModified={isSequenceModified}
          backendStatus={backendStatus}
          onRetryBackend={refreshBackendHealth}
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        {/* Central Stage Workstation: Renders the active destination */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#090A0C] overflow-hidden">
          {/* =========================================================
              DESTINATION 1: ANALYZE (Sequence Input & Baseline)
          ========================================================= */}
          {(!hasAnalyzed || activeTab === 'analyze') && (
            <SequenceInputWorkspace
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              analysisStageText={analysisStageText}
              analysisError={analysisError}
              onClearError={() => setAnalysisError(null)}
              backendStatus={backendStatus}
              onRetryBackend={refreshBackendHealth}
              initialMutatedSequence={currentEditedSequence}
            />
          )}

          {/* =========================================================
              DESTINATION 2: RESULTS & EDIT (Visual Alignment & Editor)
          ========================================================= */}
          {hasAnalyzed && activeTab === 'results' && analysisResult && (
            <ResultsAndEditView
              analysisResult={analysisResult}
              referenceSequence={referenceSequence}
              originalSubmittedSequence={originalSubmittedSequence}
              currentEditedSequence={currentEditedSequence}
              lastAnalysedSequence={lastAnalysedSequence}
              editHistory={editHistory}
              onApplyEdit={handleApplyEdit}
              onUndoLastEdit={handleUndoLastEdit}
              onDiscardEdits={handleDiscardEdits}
              onReanalyse={handleReanalyse}
              isReanalysing={isReanalysing}
              gene={analysisContext.gene}
              accession={analysisContext.accession}
              organism={analysisContext.organism}
              pdbData={pdbData}
              onNavigateToReport={() => setActiveTab('report')}
            />
          )}

          {/* =========================================================
              DESTINATION 3: REPORT (4-Page SwissADME Report & CSV)
          ========================================================= */}
          {hasAnalyzed && activeTab === 'report' && analysisResult && (
            <ReportView
              analysisResult={analysisResult}
              referenceSequence={referenceSequence}
              originalSubmittedSequence={originalSubmittedSequence}
              currentEditedSequence={currentEditedSequence}
              lastAnalysedSequence={lastAnalysedSequence}
              editHistory={editHistory}
              revision={revision}
              gene={analysisContext.gene}
              accession={analysisContext.accession}
              organism={analysisContext.organism}
              onReanalyse={handleReanalyse}
              isReanalysing={isReanalysing}
            />
          )}
        </main>
      </div>

      {/* Methodology & Limitations Modal */}
      <HelpLimitationsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}

export default App;
