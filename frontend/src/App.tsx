import React, { useState, useCallback } from 'react';
import './App.css';

import { LandingPage } from './components/ui/LandingPage';
import { SidebarNav, AppNavTab } from './components/ui/SidebarNav';
import { SequenceInputWorkspace } from './components/ui/SequenceInputWorkspace';
import { MolecularSurfaceViewer } from './components/3d/MolecularSurfaceViewer';
import { StructuralComparisonView } from './components/3d/StructuralComparisonView';
import { MutationNavigator } from './components/ui/MutationNavigator';
import { MutationDetailsPanel } from './components/ui/MutationDetailsPanel';
import { AlignedSequenceRibbon } from './components/ui/AlignedSequenceRibbon';
import { ReportView } from './components/ui/ReportView';
import { HelpLimitationsModal } from './components/ui/HelpLimitationsModal';

import {
  AnalysisContext,
  AnalysisOptions,
  FullAnalysisResult,
  AlignmentMutation,
} from './types/dna';
import {
  compareSequencesAPI,
  fetchPdbAPI,
  validateSequenceAPI,
} from './services/apiService';
import { validateDNASequence } from './services/bioinformatics';
import {
  Dna,
  FileText,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

export function App() {
  // Application Stage: Landing -> Stage A (Input) -> Stage B (Analysis)
  const [workspaceLaunched, setWorkspaceLaunched] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AppNavTab>('input');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Analysis Progress and Error States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStageText, setAnalysisStageText] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Analysis Data State
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
  const [selectedMutationIndex, setSelectedMutationIndex] = useState<number | null>(null);

  // Help & Limitations Modal
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Handle Real Analysis Workflow
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
        setAnalysisStageText('Validating reference and observed DNA sequences...');
        await validateSequenceAPI(params.referenceSequence);
        await validateSequenceAPI(params.observedSequence);

        setAnalysisStageText('Aligning sequences with Biopython PairwiseAligner...');
        await new Promise((r) => setTimeout(r, 200));

        setAnalysisStageText('Detecting discrete mutation events and indels...');
        await new Promise((r) => setTimeout(r, 200));

        setAnalysisStageText('Translating coding sequence in selected reading frame...');
        const result = await compareSequencesAPI({
          reference_sequence: params.referenceSequence,
          observed_sequence: params.observedSequence,
          reading_frame: params.context.readingFrame >= 0 ? params.context.readingFrame : 0,
          table_id: params.context.geneticCode === 'vertebrate_mitochondrial' ? 2 : params.context.geneticCode === 'bacterial_plastid' ? 11 : 1,
          gene: params.context.gene,
          pdb_id: params.context.accession,
          is_coding: params.context.sequenceType === 'coding',
        });

        setAnalysisStageText('Mapping variants to 3D macromolecular crystal coordinates...');
        let pdbContent: string | null = null;
        if (result.structure_mapping?.mapped && result.structure_mapping.pdb_id) {
          try {
            pdbContent = await fetchPdbAPI(result.structure_mapping.pdb_id);
          } catch (e) {
            console.warn('PDB retrieval notice:', e);
          }
        }

        setAnalysisStageText('Preparing scientific molecular workspace...');
        await new Promise((r) => setTimeout(r, 250));

        // Save complete scientific state
        setAnalysisContext(params.context);
        setAnalysisResult({
          ...result,
          pdb_data: pdbContent,
        });
        setPdbData(pdbContent);

        // Select first mutation by default if present
        if (result.alignment.mutations.length > 0) {
          setSelectedMutationIndex(0);
        } else {
          setSelectedMutationIndex(null);
        }

        setHasAnalyzed(true);
        setActiveTab('molecular');
      } catch (err: any) {
        console.error('Analysis error:', err);
        setAnalysisError(
          err.message || 'An unexpected error occurred during sequence alignment or structural mapping.'
        );
      } finally {
        setIsAnalyzing(false);
        setAnalysisStageText('');
      }
    },
    []
  );

  // New Analysis Reset
  const handleNewAnalysis = () => {
    setHasAnalyzed(false);
    setAnalysisResult(null);
    setPdbData(null);
    setSelectedMutationIndex(null);
    setActiveTab('input');
    setAnalysisError(null);
  };

  // Determine currently selected mutation and mapped residue
  const selectedMutation: AlignmentMutation | null =
    analysisResult && selectedMutationIndex !== null && analysisResult.alignment.mutations[selectedMutationIndex]
      ? analysisResult.alignment.mutations[selectedMutationIndex]
      : null;

  const mappedResidues = analysisResult?.structure_mapping?.mappings || [];
  const selectedMappedResidue =
    selectedMutation
      ? mappedResidues.find((r) => r.mutation_ref_pos === selectedMutation.reference_position) || null
      : mappedResidues.length > 0
      ? mappedResidues[0]
      : null;

  // 1. Initial State: Unlaunched -> Landing Page
  if (!workspaceLaunched) {
    return <LandingPage onLaunch={() => setWorkspaceLaunched(true)} />;
  }

  // 2. Main Workstation Shell (Stage A or Stage B)
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
                {hasAnalyzed ? `Stage B: ${analysisContext.gene} Analysis` : 'Stage A: Sequence Input'}
              </span>
              {hasAnalyzed && analysisResult && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#35C98A]/15 text-[#35C98A] border border-[#35C98A]/30">
                  {analysisResult.alignment.mutation_count} Variant(s)
                </span>
              )}
            </div>
            <p className="text-[9px] text-[#70757D] font-sans">
              Computational Biology & Macromolecular Surface Workstation
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center space-x-2 text-xs">
          {hasAnalyzed && (
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#F4F4F2] border border-[#2A2D33] transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#22C7E8]" />
              <span>Report</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#A0A3AA] hover:text-[#F4F4F2] border border-[#2A2D33] transition-all cursor-pointer"
            title="Scientific Methodology & Limitations"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {hasAnalyzed && (
            <button
              type="button"
              onClick={handleNewAnalysis}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#17191D] hover:bg-[#1D2025] text-[#35C98A] border border-[#2A2D33] transition-all cursor-pointer"
              title="Reset and start new sequence analysis"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Analysis</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar (Collapsible & Non-Obstructing) */}
        <SidebarNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'help') {
              setIsHelpOpen(true);
            } else {
              setActiveTab(tab);
            }
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          hasAnalysisResults={hasAnalyzed}
          hasStructureMapped={analysisResult?.structure_mapping?.mapped ?? false}
          onNewAnalysis={handleNewAnalysis}
          mutationCount={analysisResult?.alignment?.mutation_count ?? 0}
        />

        {/* Central Stage Workstation: Dynamic Width depending on Sidebar */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#090A0C] overflow-hidden">
          {/* =========================================================
              STAGE A: DEDICATED DNA INPUT WORKSPACE (NO 3D VIEWER)
          ========================================================= */}
          {(!hasAnalyzed || activeTab === 'input') && (
            <SequenceInputWorkspace
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              analysisStageText={analysisStageText}
              analysisError={analysisError}
              onClearError={() => setAnalysisError(null)}
            />
          )}

          {/* =========================================================
              STAGE B: MOLECULAR WORKSPACE (3D SURFACE + PANELS)
          ========================================================= */}
          {hasAnalyzed && activeTab === 'molecular' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Left Panel: Mutation Navigator */}
                <div className="w-72 shrink-0 h-full hidden md:block">
                  <MutationNavigator
                    mutations={analysisResult?.alignment?.mutations || []}
                    mappedResidues={mappedResidues}
                    selectedIndex={selectedMutationIndex}
                    onSelectMutation={(idx) => setSelectedMutationIndex(idx)}
                    isStructureMapped={analysisResult?.structure_mapping?.mapped ?? false}
                  />
                </div>

                {/* Center Panel: Real 3D Molecular Surface Viewport */}
                <div className="flex-1 min-w-0 h-full relative">
                  <MolecularSurfaceViewer
                    pdbData={pdbData}
                    mappedResidues={mappedResidues}
                    selectedResidueNumber={selectedMappedResidue?.residue_number ?? null}
                    selectedChain={selectedMappedResidue?.chain ?? 'A'}
                    provenance={analysisResult?.structure_mapping?.provenance ?? null}
                    isMapped={analysisResult?.structure_mapping?.mapped ?? false}
                    unmappedReason={analysisResult?.structure_mapping?.reason}
                    onSelectResidue={(resNum, _chain) => {
                      const foundIdx = analysisResult?.alignment?.mutations.findIndex(
                        (m) =>
                          mappedResidues.find(
                            (r) => r.mutation_ref_pos === m.reference_position && r.residue_number === resNum
                          )
                      );
                      if (foundIdx !== undefined && foundIdx >= 0) {
                        setSelectedMutationIndex(foundIdx);
                      }
                    }}
                  />
                </div>

                {/* Right Panel: Mutation Details Panel */}
                <div className="w-80 shrink-0 h-full hidden lg:block">
                  <MutationDetailsPanel
                    selectedMutation={selectedMutation}
                    mappedResidue={selectedMappedResidue}
                    analysisResult={analysisResult}
                  />
                </div>
              </div>

              {/* Bottom Dock: Aligned Sequence Comparison Ribbon */}
              <div className="h-28 shrink-0">
                <AlignedSequenceRibbon
                  alignedReference={analysisResult?.alignment?.aligned_reference || ''}
                  alignedObserved={analysisResult?.alignment?.aligned_observed || ''}
                  mutations={analysisResult?.alignment?.mutations || []}
                  selectedMutationIndex={selectedMutationIndex}
                  onSelectMutation={(idx) => setSelectedMutationIndex(idx)}
                />
              </div>
            </div>
          )}

          {/* =========================================================
              STAGE B: STRUCTURAL COMPARISON VIEW
          ========================================================= */}
          {hasAnalyzed && activeTab === 'comparison' && (
            <StructuralComparisonView
              pdbData={pdbData}
              mappedResidues={mappedResidues}
              mutations={analysisResult?.alignment?.mutations || []}
              selectedResidueNumber={selectedMappedResidue?.residue_number ?? null}
              selectedChain={selectedMappedResidue?.chain ?? 'A'}
              provenance={analysisResult?.structure_mapping?.provenance ?? null}
              isMapped={analysisResult?.structure_mapping?.mapped ?? false}
              unmappedReason={analysisResult?.structure_mapping?.reason}
            />
          )}

          {/* =========================================================
              STAGE B: SCIENTIFIC REPORT VIEW
          ========================================================= */}
          {hasAnalyzed && activeTab === 'report' && (
            <div className="flex-1 overflow-y-auto">
              <ReportView
                originalSequence={analysisResult?.reference_validation?.cleanedSequence || ''}
                mutatedSequence={analysisResult?.observed_validation?.cleanedSequence || ''}
                mutationDiff={null}
                validation={analysisResult?.reference_validation || validateDNASequence('')}
                referenceSeq={null}
                analysisResult={analysisResult}
              />
            </div>
          )}

          {/* =========================================================
              STAGE B: STANDALONE MUTATION NAVIGATOR (MOBILE/TABLET)
          ========================================================= */}
          {hasAnalyzed && activeTab === 'navigator' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="w-80 border-r border-[#2A2D33] h-full">
                <MutationNavigator
                  mutations={analysisResult?.alignment?.mutations || []}
                  mappedResidues={mappedResidues}
                  selectedIndex={selectedMutationIndex}
                  onSelectMutation={(idx) => setSelectedMutationIndex(idx)}
                  isStructureMapped={analysisResult?.structure_mapping?.mapped ?? false}
                />
              </div>
              <div className="flex-1 h-full overflow-y-auto">
                <MutationDetailsPanel
                  selectedMutation={selectedMutation}
                  mappedResidue={selectedMappedResidue}
                  analysisResult={analysisResult}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Help & Limitations Modal */}
      <HelpLimitationsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}

export default App;
