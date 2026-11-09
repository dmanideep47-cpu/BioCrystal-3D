import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  Dna,
  Eye,
  FileText,
  FlaskConical,
  GitCompare,
  Microscope,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

import './App.css';

import { LandingPage } from './components/ui/LandingPage';
import { NucleotideDetailPanel } from './components/ui/NucleotideDetailPanel';
import { BottomSequenceViewer } from './components/ui/BottomSequenceViewer';
import { DNAScene } from './components/3d/DNAScene';
import { ComparisonView } from './components/3d/ComparisonView';
import { SequenceInputPanel } from './components/ui/SequenceInputPanel';
import { MutationControlPanel } from './components/ui/MutationControlPanel';
import { SequenceExplorerView } from './components/ui/SequenceExplorerView';
import { ReportView } from './components/ui/ReportView';
import { IntelligentMutationAnalysis } from './components/ui/IntelligentMutationAnalysis';
import type { ActiveTab } from './components/ui/SidebarNav';
import type {
  VisualizationMode,
  QualityPreset,
  MutationType,
  MutationDiff,
  ReferenceSequence,
  NucleotideItem,
} from './types/dna';
import {
  REFERENCE_SEQUENCES,
  validateDNASequence,
  buildNucleotideItems,
  simulateMutation,
} from './services/bioinformatics';

type NavigationItem = {
  id: ActiveTab;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'Workspace' | 'Analysis';
  tag?: string;
};

const NAVIGATION: NavigationItem[] = [
  { id: 'viewer', label: 'Molecular viewer', description: 'Explore the 3D structure', icon: Dna, group: 'Workspace', tag: '3D' },
  { id: 'mutation-lab', label: 'Mutation lab', description: 'Edit a nucleotide sequence', icon: FlaskConical, group: 'Workspace' },
  { id: 'comparison', label: 'Sequence comparison', description: 'Compare reference and variant', icon: GitCompare, group: 'Workspace' },
  { id: 'intelligent-analysis', label: 'Intelligent analysis', description: 'Review mutation insights', icon: Sparkles, group: 'Workspace', tag: 'AI' },
  { id: 'sequence-explorer', label: 'Sequence explorer', description: 'Inspect individual positions', icon: Microscope, group: 'Analysis' },
  { id: 'reference-data', label: 'Reference library', description: 'Load or enter a sequence', icon: Database, group: 'Analysis' },
  { id: 'analysis-report', label: 'Research report', description: 'Review analysis output', icon: FileText, group: 'Analysis' },
];

const TAB_TITLES: Record<ActiveTab, string> = {
  viewer: 'Molecular viewer',
  'mutation-lab': 'Mutation lab',
  comparison: 'Sequence comparison',
  'intelligent-analysis': 'Intelligent analysis',
  'sequence-explorer': 'Sequence explorer',
  'reference-data': 'Reference library',
  'analysis-report': 'Research report',
};

const TAB_DESCRIPTIONS: Record<ActiveTab, string> = {
  viewer: 'A clear view of your molecular model, sequence and selected nucleotide.',
  'mutation-lab': 'Introduce a controlled change and inspect how the sequence responds.',
  comparison: 'Read the original and modified sequences side by side.',
  'intelligent-analysis': 'Use the analysis workspace to examine a sequence and its possible effects.',
  'sequence-explorer': 'Move through the sequence one position at a time.',
  'reference-data': 'Start with a reference sequence or enter your own DNA sequence.',
  'analysis-report': 'Bring the current sequence and mutation details together in one report.',
};

const BASES = [
  { base: 'A', name: 'Adenine', color: 'base-a', pairs: 'T' },
  { base: 'T', name: 'Thymine', color: 'base-t', pairs: 'A' },
  { base: 'C', name: 'Cytosine', color: 'base-c', pairs: 'G' },
  { base: 'G', name: 'Guanine', color: 'base-g', pairs: 'C' },
];

export function App() {
  const [workspaceLaunched, setWorkspaceLaunched] = useState(false);

  const [originalSequence, setOriginalSequence] = useState<string>('ATGGCTACTGGTTAA');
  const [mutatedSequence, setMutatedSequence] = useState<string>('ATGGCTACTGGTTAA');
  const [activeDiff, setActiveDiff] = useState<MutationDiff | null>(null);
  const [analysisSequenceApplied, setAnalysisSequenceApplied] = useState(false);
  const [analysisBaselineSequence, setAnalysisBaselineSequence] = useState<string>('');
  const [analysisMutationPositions, setAnalysisMutationPositions] = useState<number[]>([]);
  const [analysisBaselineMutationPositions, setAnalysisBaselineMutationPositions] = useState<number[]>([]);
  const [activeReference, setActiveReference] = useState<ReferenceSequence | null>(
    REFERENCE_SEQUENCES[0] ?? null,
  );
  const [referenceSeqText, setReferenceSeqText] = useState<string>('ATGGCTACTGGTTAA');

  const [selectedPosition, setSelectedPosition] = useState<number | null>(9);
  const [selectedStrand, setSelectedStrand] = useState<'coding' | 'complementary' | null>('coding');
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('viewer');

  const visualizationMode: VisualizationMode = 'ball-and-stick';
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('medium');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [resetCameraTrigger, setResetCameraTrigger] = useState<number>(0);

  const validation = useMemo(
    () => validateDNASequence(activeDiff || analysisSequenceApplied ? mutatedSequence : originalSequence),
    [activeDiff, analysisSequenceApplied, mutatedSequence, originalSequence],
  );

  const mutatedPositions = useMemo(() => {
    const positions = new Set<number>(analysisMutationPositions);
    if (activeDiff) positions.add(activeDiff.position);
    return positions;
  }, [activeDiff, analysisMutationPositions]);

  const sequenceToDisplay = activeDiff || analysisSequenceApplied ? mutatedSequence : originalSequence;
  const comparisonBaselineSequence = analysisSequenceApplied
    ? analysisBaselineSequence
    : originalSequence;

  const nucleotideItems = useMemo(
    () => buildNucleotideItems(
      sequenceToDisplay,
      selectedStrand || 'coding',
      mutatedPositions,
      comparisonBaselineSequence,
    ),
    [sequenceToDisplay, selectedStrand, mutatedPositions, comparisonBaselineSequence],
  );

  const selectedItem: NucleotideItem | null = useMemo(() => {
    if (selectedPosition === null) return null;
    return nucleotideItems.find((item) => item.position === selectedPosition) ?? null;
  }, [nucleotideItems, selectedPosition]);

  const handleUpdateSequence = (newSequence: string) => {
    setOriginalSequence(newSequence);
    setMutatedSequence(newSequence);
    setReferenceSeqText(newSequence);
    setActiveDiff(null);
    setAnalysisSequenceApplied(false);
    setAnalysisBaselineSequence('');
    setAnalysisMutationPositions([]);
    setAnalysisBaselineMutationPositions([]);
    setSelectedPosition(newSequence.length > 0 ? 1 : null);
    setSelectedStrand('coding');
  };

  const handleSelectReference = (reference: ReferenceSequence) => {
    setActiveReference(reference);
    setOriginalSequence(reference.sequence);
    setMutatedSequence(reference.sequence);
    setReferenceSeqText(reference.sequence);
    setActiveDiff(null);
    setAnalysisSequenceApplied(false);
    setAnalysisBaselineSequence('');
    setAnalysisMutationPositions([]);
    setAnalysisBaselineMutationPositions([]);
    setSelectedPosition(reference.id === 'demo-initial' ? 9 : 1);
    setSelectedStrand('coding');
  };

  const handleSelectNucleotide = (
    position: number,
    strand: 'coding' | 'complementary',
  ) => {
    setSelectedPosition(position);
    setSelectedStrand(strand);
  };

  const handleApplyMutation = (type: MutationType, position: number, bases: string) => {
    const { mutatedSeq, diff } = simulateMutation(originalSequence, type, position, bases);
    setMutatedSequence(mutatedSeq);
    setActiveDiff(diff);
    setAnalysisSequenceApplied(false);
    setAnalysisBaselineSequence('');
    setAnalysisMutationPositions([]);
    setAnalysisBaselineMutationPositions([]);
    setSelectedPosition(position);
    setSelectedStrand('coding');
  };

  const handleResetMutation = () => {
    setMutatedSequence(originalSequence);
    setActiveDiff(null);
    setAnalysisSequenceApplied(false);
    setAnalysisBaselineSequence('');
    setAnalysisMutationPositions([]);
    setAnalysisBaselineMutationPositions([]);
  };

  const handleApplyAnalysisSequence = (
    newSequence: string,
    referenceSequence?: string,
    changedPositions: number[] = [],
    beforeChangedPositions: number[] = [],
    baselineSequence?: string,
  ) => {
    // Keep the reference, observed input and proposed working sequence separate.
    if (referenceSequence) {
      setReferenceSeqText(referenceSequence);
      if (activeReference && activeReference.sequence !== referenceSequence.replace(/\s+/g, '').toUpperCase()) {
        setActiveReference(null);
      }
    }
    setAnalysisBaselineSequence(baselineSequence || originalSequence);
    setAnalysisMutationPositions(
      changedPositions.filter((position) => Number.isInteger(position) && position > 0 && position <= newSequence.length),
    );
    setAnalysisBaselineMutationPositions(
      beforeChangedPositions.filter((position) => Number.isInteger(position) && position > 0 && position <= (baselineSequence || originalSequence).length),
    );
    setAnalysisSequenceApplied(true);
    setMutatedSequence(newSequence);
    setActiveDiff(null);
    if (changedPositions.length > 0) {
      setSelectedPosition(changedPositions[0]);
      setSelectedStrand('coding');
    }
  };

  const handleResetCamera = () => setResetCameraTrigger((previous) => previous + 1);

  if (!workspaceLaunched) {
    return <LandingPage onLaunch={() => setWorkspaceLaunched(true)} />;
  }

  const activeNavigation = NAVIGATION.find((item) => item.id === activeTab);

  return (
    <div className="bc-app">
      <header className="bc-topbar">
        <a className="bc-brand" href="#workspace-top" aria-label="BioCrystal 3D workspace home">
          <span className="bc-brand-mark"><Dna size={21} strokeWidth={2.1} /></span>
          <span className="bc-brand-copy">
            <strong>BIOCRYSTAL<span>3D</span></strong>
            <small>MOLECULAR ANALYSIS WORKSPACE</small>
          </span>
        </a>

        <div className="bc-topbar-center" aria-label="Workspace location">
          <span>LABORATORY</span>
          <ChevronRight size={13} />
          <strong>{TAB_TITLES[activeTab]}</strong>
        </div>

        <div className="bc-topbar-actions">
          <span className="bc-system-status"><i /> LOCAL SESSION</span>
          <button className="bc-topbar-button bc-topbar-button-light" type="button" onClick={() => setActiveTab('analysis-report')}>
            <FileText size={15} />
            <span>Open report</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      </header>

      <div className="bc-layout" id="workspace-top">
        <aside className="bc-sidebar">
          <div className="bc-project-card">
            <div className="bc-sidebar-label">CURRENT PROJECT</div>
            <div className="bc-project-row">
              <span className="bc-project-icon"><Dna size={17} /></span>
              <div className="bc-project-copy">
                <strong>DNA sequence study</strong>
                <span>Untitled experiment</span>
              </div>
              <CircleDot size={13} className="bc-project-dot" />
            </div>
          </div>

          <nav className="bc-sidebar-nav" aria-label="Workspace navigation">
            <div className="bc-sidebar-group">
              <span className="bc-sidebar-label">WORKSPACE</span>
              {NAVIGATION.filter((item) => item.group === 'Workspace').map(({ id, label, description, icon: Icon, tag }) => {
                const active = activeTab === id;
                return (
                  <button
                    className={`bc-nav-item ${active ? 'is-active' : ''}`}
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={active ? 'page' : undefined}
                    title={description}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {tag && <em>{tag}</em>}
                  </button>
                );
              })}
            </div>

            <div className="bc-sidebar-group">
              <span className="bc-sidebar-label">ANALYSIS TOOLS</span>
              {NAVIGATION.filter((item) => item.group === 'Analysis').map(({ id, label, description, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    className={`bc-nav-item ${active ? 'is-active' : ''}`}
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={active ? 'page' : undefined}
                    title={description}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="bc-sidebar-bottom">
            <div className="bc-local-note">
              <ShieldCheck size={16} />
              <div><strong>Workspace ready</strong><span>Sequence tools available</span></div>
            </div>
            <div className="bc-sidebar-version">BIOCRYSTAL 3D <span>•</span> RESEARCH BUILD</div>
          </div>
        </aside>

        <main className="bc-main">
          <nav className="bc-mobile-nav" aria-label="Mobile workspace navigation">
            {NAVIGATION.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setActiveTab(id)}
                className={activeTab === id ? 'is-active' : ''}
                aria-current={activeTab === id ? 'page' : undefined}
              >
                <Icon size={15} /><span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="bc-main-inner">
            <section className="bc-page-heading">
              <div className="bc-heading-copy">
                <div className="bc-eyebrow"><span>01</span> / MOLECULAR WORKSPACE</div>
                <h1>{TAB_TITLES[activeTab]}<span>.</span></h1>
                <p>{TAB_DESCRIPTIONS[activeTab]}</p>
              </div>
              <div className="bc-heading-meta">
                <div className="bc-session-tag"><span className="bc-status-indicator" /> SESSION ACTIVE</div>
                <span className="bc-session-id">SESSION / BC-01</span>
              </div>
            </section>

            <section className="bc-metrics" aria-label="Sequence summary">
              <article className="bc-metric-card">
                <span className="bc-metric-label">SEQUENCE LENGTH</span>
                <div className="bc-metric-value">{originalSequence.length}<small> bp</small></div>
                <span className="bc-metric-foot">Base pairs in reference</span>
              </article>
              <article className="bc-metric-card">
                <span className="bc-metric-label">GC CONTENT</span>
                <div className="bc-metric-value">{validation.gcPercent.toFixed(1)}<small>%</small></div>
                <span className="bc-metric-foot">Reference sequence</span>
              </article>
              <article className="bc-metric-card">
                <span className="bc-metric-label">SEQUENCE STATE</span>
                <div className="bc-metric-state">
                  <i className={activeDiff ? 'is-warning' : 'is-ready'} />
                  {activeDiff ? 'Variant applied' : 'Reference state'}
                </div>
                <span className="bc-metric-foot">{activeDiff ? 'One active mutation record' : 'No active mutation'}</span>
              </article>
              <article className="bc-metric-card bc-metric-accent">
                <span className="bc-metric-label">SELECTED POSITION</span>
                <div className="bc-metric-value">{selectedPosition ?? '—'}<small> / {sequenceToDisplay.length || 0}</small></div>
                <span className="bc-metric-foot">{selectedStrand === 'complementary' ? 'Complementary strand' : 'Coding strand'}</span>
              </article>
            </section>

            {activeTab === 'viewer' && (
              <>
                <section className="bc-section-block">
                  <div className="bc-section-heading">
                    <div>
                      <div className="bc-eyebrow">STRUCTURE / 3D VIEW</div>
                      <h2>Explore the molecule</h2>
                      <p>Rotate the model, inspect a position, and move between strands.</p>
                    </div>
                    <div className="bc-view-controls">
                      <label className="bc-select-control">
                        <span>RENDER QUALITY</span>
                        <select
                          value={qualityPreset}
                          onChange={(event) => setQualityPreset(event.target.value as QualityPreset)}
                          aria-label="3D render quality"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className={`bc-control-button ${autoRotate ? 'is-active' : ''}`}
                        onClick={() => setAutoRotate((value) => !value)}
                        aria-pressed={autoRotate}
                      >
                        <Activity size={15} /> {autoRotate ? 'Rotation on' : 'Auto rotate'}
                      </button>
                      <button type="button" className="bc-icon-button" onClick={handleResetCamera} aria-label="Reset camera" title="Reset camera">
                        <RotateCcw size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="bc-viewer-card">
                    <div className="bc-viewer-topline">
                      <div className="bc-viewer-topline-left">
                        <span className="bc-live-dot" />
                        <strong>{activeDiff ? 'MODIFIED DNA MODEL' : 'B-DNA MOLECULAR MODEL'}</strong>
                        <span className="bc-viewer-divider">/</span>
                        <span>{sequenceToDisplay.length} BASE PAIRS</span>
                      </div>
                      <span className="bc-viewer-coordinate">VIEW 01 / INTERACTIVE</span>
                    </div>

                    <div className="bc-viewer-layout">
                      <div className="bc-scene-column">
                        <div className="bc-scene-labels">
                          <span>MOLECULAR STRUCTURE</span>
                          {activeDiff && <span className="bc-variant-label">POSITION {activeDiff.position} MODIFIED</span>}
                        </div>
                        <div className="bc-scene-wrap">
                          <div className="bc-scene-grid" />
                          <div className="bc-scene-hint"><Eye size={13} /> DRAG TO ORBIT <span>·</span> SCROLL TO ZOOM</div>
                          <DNAScene
                            sequence={sequenceToDisplay}
                            visualizationMode={visualizationMode}
                            selectedPosition={selectedPosition}
                            selectedStrand={selectedStrand}
                            mutatedPositions={mutatedPositions}
                            qualityPreset={qualityPreset}
                            onSelectNucleotide={handleSelectNucleotide}
                            hoveredPosition={hoveredPosition}
                            setHoveredPosition={setHoveredPosition}
                            autoRotate={autoRotate}
                            autoRotateSpeed={0.8}
                            resetCameraTrigger={resetCameraTrigger}
                          />
                        </div>
                        <div className="bc-viewer-footnote">
                          <span>MODEL ENGINE <strong>THREE.JS</strong></span>
                          <span>RENDER MODE <strong>{String(visualizationMode).replace(/-/g, ' ').toUpperCase()}</strong></span>
                        </div>
                      </div>

                      <aside className="bc-inspector">
                        <div className="bc-inspector-heading">
                          <div><span className="bc-eyebrow">DETAIL PANEL</span><h3>Nucleotide inspector</h3></div>
                          <span className="bc-inspector-live">LIVE</span>
                        </div>
                        <p className="bc-inspector-intro">Select a base in the model or sequence track to inspect its details.</p>
                        <div className="bc-inspector-content">
                          <NucleotideDetailPanel
                            selectedItem={selectedItem}
                            onInitiateMutation={(position, base) => handleApplyMutation('substitution', position, base)}
                            onClearSelection={() => setSelectedPosition(null)}
                            onNavigatePosition={(position) => setSelectedPosition(position)}
                            sequenceLength={sequenceToDisplay.length}
                          />
                        </div>
                      </aside>
                    </div>
                  </div>
                </section>

                <section className="bc-section-block bc-sequence-section">
                  <div className="bc-section-heading bc-sequence-heading">
                    <div>
                      <div className="bc-eyebrow">SEQUENCE / BASE-PAIR MAP</div>
                      <h2>Sequence track</h2>
                      <p>Select any nucleotide to synchronize the model and inspector.</p>
                    </div>
                    <div className="bc-sequence-meta">
                      <span>{sequenceToDisplay.length} POSITIONS</span>
                      <span>{activeDiff ? 'VARIANT OVERLAY ON' : 'REFERENCE SEQUENCE'}</span>
                    </div>
                  </div>
                  <div className="bc-sequence-card">
                    <div className="bc-sequence-card-top">
                      <span>CODING & COMPLEMENTARY STRANDS</span>
                      <span>SELECTED: {selectedPosition ?? 'NONE'}</span>
                    </div>
                    <div className="bc-sequence-content">
                      <BottomSequenceViewer
                        sequence={sequenceToDisplay}
                        selectedPosition={selectedPosition}
                        selectedStrand={selectedStrand}
                        onSelectNucleotide={handleSelectNucleotide}
                        mutatedPositions={mutatedPositions}
                        originalSequence={comparisonBaselineSequence}
                      />
                    </div>
                  </div>
                </section>

                <section className="bc-lower-grid">
                  <article className="bc-info-card">
                    <div className="bc-info-card-head"><span className="bc-eyebrow">BASE-PAIR KEY</span><Dna size={17} /></div>
                    <h3>Four bases. Two pairs.</h3>
                    <p>Use the color key to identify each nucleotide in the sequence and molecular view.</p>
                    <div className="bc-base-legend">
                      {BASES.map((item) => (
                        <div className="bc-base-item" key={item.base}>
                          <span className={`bc-base-swatch ${item.color}`}>{item.base}</span>
                          <span><strong>{item.name}</strong><small>Pairs with {item.pairs}</small></span>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="bc-info-card bc-info-card-dark">
                    <div className="bc-info-card-head"><span className="bc-eyebrow">SESSION SNAPSHOT</span><Activity size={17} /></div>
                    <h3>{activeDiff ? 'A variant is active.' : 'Reference sequence loaded.'}</h3>
                    <p>{activeDiff ? `A mutation is currently applied at position ${activeDiff.position}. Open the mutation lab or comparison view to review it.` : 'Your current sequence is ready for inspection. You can apply a mutation or load another reference from the tools.'}</p>
                    <div className="bc-session-actions">
                      <button type="button" onClick={() => setActiveTab('mutation-lab')}>Open mutation lab <ArrowUpRight size={14} /></button>
                      <button type="button" onClick={() => setActiveTab('comparison')}>Compare sequence <ArrowUpRight size={14} /></button>
                    </div>
                  </article>
                </section>
              </>
            )}

            {activeTab === 'mutation-lab' && (
              <section className="bc-module-section">
                <div className="bc-module-callout"><FlaskConical size={19} /><div><strong>Controlled sequence editing</strong><span>Apply a mutation to the current reference. The molecular viewer and comparison module will use the updated state.</span></div></div>
                <div className="bc-module-card"><MutationControlPanel originalSequence={originalSequence} activeDiff={activeDiff} onApplyMutation={handleApplyMutation} onResetMutation={handleResetMutation} onNavigatePosition={(position) => setSelectedPosition(position)} selectedPosition={selectedPosition} /></div>
              </section>
            )}

            {activeTab === 'comparison' && (
              <section className="bc-module-section">
                <div className="bc-module-callout"><GitCompare size={19} /><div><strong>Reference vs. modified sequence</strong><span>Compare the original sequence with the currently applied mutation.</span></div></div>
                <div className="bc-module-card"><ComparisonView originalSequence={comparisonBaselineSequence} mutatedSequence={mutatedSequence} mutationDiff={activeDiff} mutatedPositions={mutatedPositions} baselineMutatedPositions={new Set(analysisBaselineMutationPositions)} isCandidateComparison={analysisSequenceApplied} visualizationMode={visualizationMode} qualityPreset={qualityPreset} selectedPosition={selectedPosition} selectedStrand={selectedStrand} onSelectNucleotide={handleSelectNucleotide} hoveredPosition={hoveredPosition} setHoveredPosition={setHoveredPosition} autoRotate={autoRotate} autoRotateSpeed={0.8} /></div>
              </section>
            )}

            {activeTab === 'intelligent-analysis' && (
              <section className="bc-module-section">
                <div className="bc-module-callout"><Sparkles size={19} /><div><strong>Sequence intelligence</strong><span>Submit a sequence for analysis, then transfer a selected result to the viewer or comparison workspace.</span></div></div>
                <div className="bc-module-card"><IntelligentMutationAnalysis currentSequence={sequenceToDisplay} referenceSequence={referenceSeqText || originalSequence} onApplySequence={handleApplyAnalysisSequence} onSelectPosition={(position) => { setSelectedPosition(position); setSelectedStrand('coding'); }} onNavigateTo3D={() => setActiveTab('viewer')} onNavigateToComparison={() => setActiveTab('comparison')} /></div>
              </section>
            )}

            {activeTab === 'sequence-explorer' && (
              <section className="bc-module-section">
                <div className="bc-module-callout"><Microscope size={19} /><div><strong>Position-by-position inspection</strong><span>Choose a nucleotide position to synchronize it with the 3D molecular viewer.</span></div></div>
                <div className="bc-module-card"><SequenceExplorerView sequence={sequenceToDisplay} validation={validation} mutatedPositions={mutatedPositions} onSelectPosition={(position) => { setSelectedPosition(position); setActiveTab('viewer'); }} /></div>
              </section>
            )}

            {activeTab === 'reference-data' && (
              <section className="bc-module-section">
                <div className="bc-module-callout"><Database size={19} /><div><strong>Reference sequence library</strong><span>Load a supported reference or enter a DNA sequence to begin a new analysis.</span></div></div>
                <div className="bc-module-card"><SequenceInputPanel currentSequence={originalSequence} onUpdateSequence={handleUpdateSequence} validation={validation} onSelectReference={(reference) => { handleSelectReference(reference); setActiveTab('viewer'); }} /></div>
              </section>
            )}

            {activeTab === 'analysis-report' && (
              <section className="bc-module-section">
                <div className="bc-module-callout"><FileText size={19} /><div><strong>Research output</strong><span>Review the current sequence, validation summary and mutation details.</span></div></div>
                <div className="bc-module-card"><ReportView originalSequence={originalSequence} mutatedSequence={mutatedSequence} mutationDiff={activeDiff} validation={validation} referenceSeq={activeReference} /></div>
              </section>
            )}

            <footer className="bc-page-footer">
              <div className="bc-footer-brand"><span className="bc-brand-mark"><Dna size={16} /></span><strong>BIOCRYSTAL 3D</strong></div>
              <span>INTERACTIVE DNA MUTATION ANALYZER</span>
              <span className="bc-footer-right">RESEARCH WORKSPACE <span>·</span> LOCAL SESSION</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
