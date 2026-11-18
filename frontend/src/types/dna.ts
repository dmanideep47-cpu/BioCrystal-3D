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
  mutation_type?: string;
  // For insertions this is the 1-based alignment gap coordinate, not a reference base position.
  reference_position: number;
  reference_left_position?: number | null;
  reference_right_position?: number | null;
  reference_end_position?: number | null;
  observed_position: number;
  original_base: string;
  observed_base: string;
  reference_bases?: string;
  observed_bases?: string;
  affected_codon_index?: number;
  reference_codon?: string | null;
  original_codon?: string | null;
  observed_codon?: string | null;
  original_amino_acid?: AminoAcidInfo;
  observed_amino_acid?: AminoAcidInfo;
  amino_acid_change?: string;
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
  score: number;
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
  structure_mapping?: StructureMappingResult;
}

export interface AnalysisContext {
  organism: string;
  gene: string;
  accession: string;
  sequenceType: 'coding' | 'non_coding' | 'unknown';
  strandOrientation: 'forward' | 'reverse_complement' | 'unknown';
  readingFrame: 0 | 1 | 2 | -1;
  geneticCode: GeneticCodeTable;
}

export interface AnalysisOptions {
  detectDifferences: boolean;
  referenceGuided: boolean;
  codingConsequence: boolean;
  structuralMapping: boolean;
  generateReport: boolean;
}

export interface StructureDisplayResidue {
  mutation_ref_pos: number;
  mutation_type: string;
  dna_variant: string;
  chain: string;
  residue_number: number;
  original_residue: string;
  mutated_residue: string;
  pdb_residue?: string;
  is_gap_context?: boolean;
  is_updated?: boolean;
}

export interface MappedResidue extends StructureDisplayResidue {
  pdb_residue: string;
  pdb_matches_observed_residue: boolean;
  structural_region: string;
  mapping_confidence: string;
  is_mapped: boolean;
  limitation: string;
}

export interface DnaStructureResidue extends StructureDisplayResidue {
  observed_position: number;
  mapping_confidence: string;
  is_mapped: boolean;
  limitation: string;
}

export interface StructureProvenance {
  database: string;
  pdb_id: string;
  organism: string;
  title: string;
  method: string;
  resolution: string;
  chain: string;
  experimental_status: string;
  model_type: string;
  disclaimer: string;
}

export interface StructureMappingResult {
  mapped: boolean;
  pdb_id: string | null;
  chain: string | null;
  status: string;
  reason?: string | null;
  mappings: MappedResidue[];
  provenance: StructureProvenance | null;
}

export interface DnaStructureResult {
  mapped: boolean;
  structure_type: 'idealized_dna_duplex';
  pdb_id: string;
  chain: string;
  status: string;
  reason?: string | null;
  mappings: DnaStructureResidue[];
  metrics?: Record<string, number | string>;
  pdb_data: string;
  provenance: StructureProvenance;
}

export interface DnaThermodynamics {
  model: string;
  delta_h_kcal_mol: number;
  delta_s_cal_mol_k: number;
  delta_s_1m_cal_mol_k: number;
  delta_g_37_kcal_mol: number;
  melting_temperature_c: number;
  mutant_delta_g_37_kcal_mol?: number;
  mutant_melting_temp_c?: number;
  total_mismatch_destabilization_ddg?: number;
  salt_conditions: {
    na_molar: number;
    mg_molar: number;
    na_effective_molar: number;
    strand_molar: number;
  };
  is_self_complementary: boolean;
  mismatch_breakdown?: Array<{
    position: number;
    variant: string;
    penalty_ddg_kcal_mol: number;
    mismatch_type: string;
    estimated_delta_tm_c: number;
  }>;
}

export interface DnaMorphometrics {
  duplex_type: string;
  base_pairs: number;
  helical_turns: number;
  helical_rise_angstrom: number;
  helical_twist_deg: number;
  helical_pitch_angstrom: number;
  contour_length_angstrom: number;
  contour_length_nm: number;
  persistence_length_nm: number;
  duplex_diameter_angstrom: number;
  major_groove_width_angstrom: number;
  major_groove_depth_angstrom: number;
  minor_groove_width_angstrom: number;
  minor_groove_depth_angstrom: number;
  average_flexibility_index: number;
}

export interface DnaSpectroscopicProfile {
  gc_percent: number;
  at_percent: number;
  molecular_weight_single_strand_da: number;
  molecular_weight_duplex_da: number;
  molecular_weight_duplex_kda: number;
  molar_extinction_260_m_cm: number;
  a260_conversion_ug_ml: number;
  total_negative_formal_charge: number;
  linear_charge_density_e_per_a: number;
}

export interface DnaSwissRadarScores {
  thermostability: number;
  stacking_enthalpy: number;
  duplex_rigidity: number;
  groove_accessibility: number;
  gc_polarity_balance: number;
  duplex_fidelity: number;
  biocrystal_dna_index: number;
}

export interface SingleDnaBiophysics {
  thermodynamics: DnaThermodynamics;
  morphometrics: DnaMorphometrics;
  spectroscopic_profile: DnaSpectroscopicProfile;
  swiss_radar_scores: DnaSwissRadarScores;
}

export interface ComparativeDnaBiophysics extends SingleDnaBiophysics {
  reference: SingleDnaBiophysics;
  variant: SingleDnaBiophysics;
  step_energy_profiles?: {
    reference: Array<{ position: number; step: string; dg: number; dh: number }>;
    variant: Array<{ position: number; step: string; dg: number; dh: number }>;
  };
  deltas: {
    delta_tm_celsius: number;
    delta_dg_37_kcal_mol: number;
    delta_dh_kcal_mol: number;
    delta_gc_percent: number;
    delta_mw_da: number;
    score_delta: number;
  };
  verdict: {
    status: 'superior' | 'iso_stable' | 'destabilized';
    badge: string;
    description: string;
  };
}

export interface FullAnalysisResult {
  reference_validation: SequenceValidationResult;
  observed_validation: SequenceValidationResult;
  alignment: {
    alignment_score: number;
    identity_percent: number;
    mutation_count: number;
    mutations: AlignmentMutation[];
    aligned_reference: string;
    aligned_observed: string;
    method?: string;
    scoring?: {
      match: number;
      mismatch: number;
      gap_open: number;
      gap_extend: number;
    };
    normalization?: string;
  };
  structure_mapping: StructureMappingResult;
  dna_structure?: DnaStructureResult;
  dna_biophysics?: ComparativeDnaBiophysics;
  variant_intelligence?: any;
  pdb_data?: string | null;
  structure_error?: string | null;
  metadata?: {
    reference_hash: string;
    variant_hash: string;
    mutation_classification: string;
    codon_change: string | null;
    amino_acid_change: string | null;
    pdb_available: boolean;
    pdb_id: string | null;
    structure_provenance_type: 'experimental_pdb' | 'canonical_dna' | 'unavailable';
    primary_interpretation: string;
  };
  mutation_impact_summary?: MutationImpactSummary;
  fasta_metadata?: FastaSequenceItem | null;
}

export interface FastaSequenceItem {
  id: string;
  header: string;
  sequence: string;
  length: number;
  gc_percent: number;
}

export interface FastaParseResult {
  valid: boolean;
  sequences: FastaSequenceItem[];
  error: string | null;
}

export interface MutationImpactItem {
  index: number;
  mutation_type: string;
  mutation_notation: string;
  codon_position: number | null;
  codon_change: string;
  amino_acid_change: string;
  consequence: string;
  consequence_label: string;
  creates_premature_stop: boolean;
  changes_protein_length: boolean;
  pdb_available: boolean;
  pdb_id: string | null;
  structure_provenance: string;
  primary_interpretation: string;
}

export interface MutationImpactSummary {
  has_mutations: boolean;
  total_mutations: number;
  primary_interpretation: string;
  items: MutationImpactItem[];
}

export interface VariantComparisonRow {
  variant_label: string;
  mutation_type: string;
  mutation_notation: string;
  codon_change: string;
  amino_acid_change: string;
  mutation_consequence: string;
  protein_mw_change: string;
  gravy_score_change: string;
  net_charge_change: string;
  gc_content_change: string;
  melting_temp_change: string;
  pdb_availability: string;
  primary_interpretation: string;
}

export interface VariantComparisonResult {
  reference_length: number;
  gene?: string | null;
  conclusion: string;
  variant_a: {
    name: string;
    sequence: string;
    impact_summary: MutationImpactSummary;
    telemetry: {
      mw_delta: number;
      gravy_delta: number;
      charge_delta: number;
      gc_delta: number;
      tm_delta: number;
    };
    pdb_id?: string | null;
    pdb_available: boolean;
  };
  variant_b: {
    name: string;
    sequence: string;
    impact_summary: MutationImpactSummary;
    telemetry: {
      mw_delta: number;
      gravy_delta: number;
      charge_delta: number;
      gc_delta: number;
      tm_delta: number;
    };
    pdb_id?: string | null;
    pdb_available: boolean;
  };
  rows: VariantComparisonRow[];
}

export interface CorrectionRecommendationResult {
  observed_sequence: string;
  reference_sequence?: string | null;
  reading_frame: string;
  total_candidates: number;
  strategies_used: string[];
  candidates: CorrectionCandidate[];
  safeguards_notice: string;
}

export type BackendStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'ERROR';

export interface SequenceEditRecord {
  id: string;
  timestamp: string;
  position: number;
  oldBases: string;
  newBases: string;
  action: string;
  reason?: string;
}

export interface BackendHealthResponse {
  status: 'healthy' | 'degraded' | string;
  service: string;
  version: string;
  biopython_version?: string;
}

export interface StudentPrediction {
  choice: 'no_change' | 'one_aa_change' | 'early_stop' | 'frameshift' | 'inframe_indel' | 'not_sure' | string;
  choice_label?: string;
  rationale?: string;
  matched?: boolean | null;
  status?: 'correct' | 'diverged' | 'not_sure' | 'not_evaluated' | string;
  feedback?: string;
}

export interface CodonComparisonItem {
  codon_index: number;
  ref_codon: string;
  var_codon: string;
  ref_aa: string;
  var_aa: string;
  is_changed: boolean;
}

export interface MutationExperimentResult {
  success: boolean;
  errors?: string[];
  reference_sequence: string;
  variant_sequence: string;
  reading_frame: number;
  genetic_code: string;
  reference_length: number;
  variant_length: number;
  reference_codons: string[];
  variant_codons: string[];
  reference_codon_count: number;
  variant_codon_count: number;
  reference_trailing_bases: string;
  variant_trailing_bases: string;
  reference_translation: string;
  variant_translation: string;
  reference_protein_product: string;
  variant_protein_product: string;
  reference_first_stop_position: number | null;
  variant_first_stop_position: number | null;
  first_affected_codon: number | null;
  start_codon_changed: boolean;
  mutation_category: string;
  category_label: string;
  explanation: string;
  notes: string[];
  prediction_evaluation?: {
    choice: string;
    choice_label?: string;
    rationale?: string;
    matched: boolean | null;
    status?: 'correct' | 'diverged' | 'not_sure' | 'not_evaluated' | string;
    feedback: string;
  };
  reflection: {
    question: string;
    model_answer: string;
  };
  codon_comparison: CodonComparisonItem[];
}

export interface SavedExperiment {
  id: string;
  timestamp: string;
  mode: 'guided' | 'custom';
  fixtureTitle?: string;
  referenceSequence: string;
  variantSequence: string;
  referenceProvenance: string;
  mutationOperation: string;
  coordinates: string;
  translationAssumptions: string[];
  prediction?: StudentPrediction;
  result: MutationExperimentResult;
  studentReflection?: string;
}

export interface PropertyObjective {
  id: string;
  label: string;
  protein: string;
  assay: string;
  target_name: string;
  units: string;
  target_direction: 'higher_is_better' | 'lower_is_better';
  supported_types: string;
  experimental_context: string;
  status: 'available' | 'unavailable';
  model_name?: string;
  model_version?: string;
  reason?: string;
}

export interface SequenceFacts {
  evidence_label: string;
  reference_length_bp: number;
  variant_length_bp: number;
  reference_gc_percent: number;
  variant_gc_percent: number;
  reference_protein: string;
  variant_protein: string;
  reference_length_aa: number;
  variant_length_aa: number;
  first_stop_position_ref: number | null;
  first_stop_position_var: number | null;
  is_identical: boolean;
  is_synonymous: boolean;
  amino_acid_substitutions: Array<{
    position: number;
    ref_aa: string;
    var_aa: string;
    mutation: string;
  }>;
  position_changes: Array<{
    dna_position: number;
    ref_base: string;
    var_base: string;
    type: 'substitution' | 'insertion' | 'deletion';
    codon_index: number;
  }>;
}

export interface ModelPredictionResult {
  evidence_label: string;
  objective_id: string;
  target_name: string;
  target_units: string;
  target_direction: string;
  model_name: string;
  model_version: string;
  prediction_timestamp: string;
  status: 'available' | 'unavailable' | 'unsupported_input' | 'failed';
  applicability: string;
  reference_predicted_value: number | null;
  variant_predicted_value: number | null;
  predicted_delta: number | null;
  verdict: string | null;
  reason: string | null;
  uncertainty_status: string;
  evaluation_metrics?: {
    dummy_baseline: { mae: number; rmse: number; r2: number; spearman: number | null };
    ridge_model: { mae: number; rmse: number; r2: number; spearman: number };
  } | null;
  held_out_evaluation_points?: Array<{
    variant_id: string;
    mutations: string;
    measured: number;
    predicted: number;
  }>;
}

export interface ExperimentalMeasurementResult {
  evidence_label: string;
  matched: boolean;
  dataset_id: string;
  citation: string;
  assay_context: string;
  measured_reference_value: number | null;
  measured_variant_value: number | null;
  measured_delta: number | null;
  variant_id?: string | null;
  mutations?: string | null;
  reason?: string | null;
}

export interface PropertyAnalysisResponse {
  objective: PropertyObjective;
  supported_objectives: PropertyObjective[];
  sequence_facts: SequenceFacts;
  model_prediction: ModelPredictionResult;
  experimental_measurement: ExperimentalMeasurementResult;
  why_this_result: string;
  what_this_does_not_establish: string;
  analysis_timestamp: string;
}

