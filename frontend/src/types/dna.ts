export type NucleotideType = 'A' | 'T' | 'G' | 'C';
export type StrandType = 'coding' | 'complementary';
export type MutationType = 'substitution' | 'insertion' | 'deletion';

export type MutationCategory =
  | 'synonymous'
  | 'missense'
  | 'nonsense'
  | 'frameshift'
  | 'inframe_insertion'
  | 'inframe_deletion'
  | 'non_coding';

export type VisualizationMode =
  | 'surface'
  | 'ball-and-stick'
  | 'backbone'
  | 'base-pair'
  | 'educational';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export type GeneticCodeTable = 'standard' | 'vertebrate_mitochondrial' | 'bacterial_plastid';

export interface AminoAcidInfo {
  code1: string;
  code3: string;
  name: string;
  category: 'hydrophobic' | 'polar' | 'basic' | 'acidic' | 'special' | 'stop';
  molecularWeight: number; // Da
  charge: number; // at pH 7.4
  hydropathy: number; // Kyte-Doolittle scale
}

export interface CodonInfo {
  index: number; // 1-indexed codon index in reading frame
  sequence: string; // 3-letter DNA codon e.g. "ACT"
  mrnaSequence: string; // e.g. "ACU"
  startPosition: number; // 1-indexed nucleotide start position
  endPosition: number; // 1-indexed nucleotide end position
  aminoAcid: AminoAcidInfo;
  isStartCodon: boolean;
  isStopCodon: boolean;
  isMutated?: boolean;
}

export interface NucleotideItem {
  position: number; // 1-indexed
  base: NucleotideType;
  complementBase: NucleotideType;
  strand: StrandType;
  direction: "5'-to-3'" | "3'-to-5'";
  codonIndex: number;
  codonPosInTrio: 1 | 2 | 3; // position within codon (1st, 2nd, or 3rd base)
  codonSeq: string;
  mrnaCodonSeq: string;
  aminoAcid: AminoAcidInfo;
  isStartCodon: boolean;
  isStopCodon: boolean;
  isMutated: boolean;
  originalBase?: NucleotideType;
}

export interface SequenceValidationResult {
  isValid: boolean;
  cleanedSequence: string;
  originalInput: string;
  length: number;
  gcCount: number;
  atCount: number;
  gcPercent: number;
  atPercent: number;
  codonCount: number;
  isCompleteCodingSequence: boolean;
  meltingTemperature: number; // Tm in Celsius
  molecularWeightKDa: number;
  invalidCharacters: string[];
  fastaHeader?: string;
  errors: string[];
  warnings: string[];
}

export interface MutationDiff {
  type: MutationType;
  position: number; // 1-indexed
  originalBase?: string;
  newBase?: string;
  insertedBases?: string;
  deletedBases?: string;
  originalSequence: string;
  mutatedSequence: string;
  originalCodon?: string;
  mutatedCodon?: string;
  originalAminoAcid?: AminoAcidInfo;
  mutatedAminoAcid?: AminoAcidInfo;
  category: MutationCategory;
  categoryLabel: string;
  description: string;
  isTransition?: boolean;
  isTransversion?: boolean;
  readingFrameShift: number; // 0 for in-frame, 1 or 2 for frameshift
}

export interface ReferenceSequence {
  id: string;
  name: string;
  organism: string;
  geneSymbol: string;
  accessionNumber: string;
  database: 'NCBI RefSeq' | 'Ensembl' | 'RCSB PDB' | 'Educational Demonstration';
  sequence: string;
  description: string;
  demonstrationMutation?: {
    position: number;
    newBase: NucleotideType;
    rationale: string;
  };
  pdbId?: string;
}

export interface AtomCoord {
  id: string;
  name: string;
  element: 'P' | 'O' | 'C' | 'N' | 'H';
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  strand: StrandType;
  basePosition: number;
  isMutated?: boolean;
}

export interface BasePair3DGeometry {
  position: number;
  codingBase: NucleotideType;
  complementBase: NucleotideType;
  center: [number, number, number];
  rotation: [number, number, number];
  codingBackbonePos: [number, number, number];
  complementBackbonePos: [number, number, number];
  codingBasePos: [number, number, number];
  complementBasePos: [number, number, number];
  hydrogenBondPoints: Array<[[number, number, number], [number, number, number]]>;
  isMutated: boolean;
  codonIndex: number;
}

export interface AlignmentMutation {
  type: 'substitution' | 'insertion' | 'deletion';
  reference_position: number;
  observed_position: number;
  original_base: string;
  observed_base: string;
  affected_codon_index?: number;
  reference_codon?: string | null;
  observed_codon?: string | null;
  original_amino_acid?: AminoAcidInfo;
  observed_amino_acid?: AminoAcidInfo;
  category: string;
  category_label: string;
  is_transition?: boolean | null;
  is_transversion?: boolean | null;
  description: string;
}

export interface CorrectionCandidate {
  candidate_id: string;
  title: string;
  strategy: string;
  sequence: string;
  edits_count: number;
  edits_detail: string[];
  resulting_gc_percent: number;
  gc_delta: number;
  protein_sequence: string;
  protein_preserved: boolean;
  premature_stop_detected: boolean;
  constraint_violations: string[];
  /** Objective-fit metric, not a probability of biological correctness. */
  score: number;
  objective_fit_score?: number;
  score_label?: string;
  objective?: string;
  rank?: number;
  reference_identity_percent?: number | null;
  protein_matches_reference?: boolean | null;
  changed_positions?: number[];
  before_changed_positions?: number[];
  rationale: string;
  scientific_limitation: string;
}

export interface ExploratoryAnalysisResult {
  validation: SequenceValidationResult;
  composition: {
    counts: Record<string, number>;
    percentages: Record<string, number>;
    gc_percent: number;
    at_percent: number;
    gc_ratio: number;
  };
  homopolymers: Array<{
    base: string;
    length: number;
    start_position: number;
    end_position: number;
    sequence: string;
  }>;
  tandem_repeats: Array<{
    unit: string;
    unit_length: number;
    copies: number;
    start_position: number;
    end_position: number;
    pattern: string;
  }>;
  orfs: Array<{
    frame: string;
    frame_index: number;
    start_position: number;
    end_position: number;
    length_bp: number;
    length_aa: number;
    has_start_codon: boolean;
    has_stop_codon: boolean;
    nucleotide_sequence: string;
    protein_sequence: string;
  }>;
  reading_frames: Array<{
    frame_label: string;
    frame_index: number;
    codons: CodonInfo[];
    codon_count: number;
    stop_count: number;
    has_internal_stop: boolean;
    protein_string: string;
  }>;
  anomalies: string[];
  limitations_notice: string;
}

export interface CompareResult {
  reference_validation: SequenceValidationResult;
  observed_validation: SequenceValidationResult;
  alignment: {
    alignment_score: number;
    identity_percent: number;
    mutation_count: number;
    mutations: AlignmentMutation[];
    aligned_reference: string;
    aligned_observed: string;
  };
}

export interface CorrectionRecommendationResult {
  observed_sequence: string;
  reference_sequence?: string | null;
  reading_frame: string;
  total_candidates: number;
  strategies_used: string[];
  candidates: CorrectionCandidate[];
  recommendation_status?: string;
  recommendation_notice?: string;
  ranking_basis?: string;
  safeguards_notice: string;
}


