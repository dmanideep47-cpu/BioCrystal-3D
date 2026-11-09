import {
  NucleotideType,
  SequenceValidationResult,
  CodonInfo,
  AminoAcidInfo,
  MutationDiff,
  MutationType,
  ReferenceSequence,
  NucleotideItem,
  GeneticCodeTable,
  AlignmentMutation,
  CorrectionCandidate,
  ExploratoryAnalysisResult,
  CompareResult,
  CorrectionRecommendationResult,
} from '../types/dna';

// Standard 20 amino acids + Stop
export const AMINO_ACIDS: Record<string, AminoAcidInfo> = {
  A: { code1: 'A', code3: 'Ala', name: 'Alanine', category: 'hydrophobic', molecularWeight: 89.09, charge: 0, hydropathy: 1.8 },
  R: { code1: 'R', code3: 'Arg', name: 'Arginine', category: 'basic', molecularWeight: 174.20, charge: 1, hydropathy: -4.5 },
  N: { code1: 'N', code3: 'Asn', name: 'Asparagine', category: 'polar', molecularWeight: 132.12, charge: 0, hydropathy: -3.5 },
  D: { code1: 'D', code3: 'Asp', name: 'Aspartic Acid', category: 'acidic', molecularWeight: 133.10, charge: -1, hydropathy: -3.5 },
  C: { code1: 'C', code3: 'Cys', name: 'Cysteine', category: 'special', molecularWeight: 121.16, charge: 0, hydropathy: 2.5 },
  Q: { code1: 'Q', code3: 'Gln', name: 'Glutamine', category: 'polar', molecularWeight: 146.15, charge: 0, hydropathy: -3.5 },
  E: { code1: 'E', code3: 'Glu', name: 'Glutamic Acid', category: 'acidic', molecularWeight: 147.13, charge: -1, hydropathy: -3.5 },
  G: { code1: 'G', code3: 'Gly', name: 'Glycine', category: 'special', molecularWeight: 75.07, charge: 0, hydropathy: -0.4 },
  H: { code1: 'H', code3: 'His', name: 'Histidine', category: 'basic', molecularWeight: 155.16, charge: 0.1, hydropathy: -3.2 },
  I: { code1: 'I', code3: 'Ile', name: 'Isoleucine', category: 'hydrophobic', molecularWeight: 131.17, charge: 0, hydropathy: 4.5 },
  L: { code1: 'L', code3: 'Leu', name: 'Leucine', category: 'hydrophobic', molecularWeight: 131.17, charge: 0, hydropathy: 3.8 },
  K: { code1: 'K', code3: 'Lys', name: 'Lysine', category: 'basic', molecularWeight: 146.19, charge: 1, hydropathy: -3.9 },
  M: { code1: 'M', code3: 'Met', name: 'Methionine', category: 'hydrophobic', molecularWeight: 149.21, charge: 0, hydropathy: 1.9 },
  F: { code1: 'F', code3: 'Phe', name: 'Phenylalanine', category: 'hydrophobic', molecularWeight: 165.19, charge: 0, hydropathy: 2.8 },
  P: { code1: 'P', code3: 'Pro', name: 'Proline', category: 'special', molecularWeight: 115.13, charge: 0, hydropathy: -1.6 },
  S: { code1: 'S', code3: 'Ser', name: 'Serine', category: 'polar', molecularWeight: 105.09, charge: 0, hydropathy: -0.8 },
  T: { code1: 'T', code3: 'Thr', name: 'Threonine', category: 'polar', molecularWeight: 119.12, charge: 0, hydropathy: -0.7 },
  W: { code1: 'W', code3: 'Trp', name: 'Tryptophan', category: 'hydrophobic', molecularWeight: 204.23, charge: 0, hydropathy: -0.9 },
  Y: { code1: 'Y', code3: 'Tyr', name: 'Tyrosine', category: 'polar', molecularWeight: 181.19, charge: 0, hydropathy: -1.3 },
  V: { code1: 'V', code3: 'Val', name: 'Valine', category: 'hydrophobic', molecularWeight: 117.15, charge: 0, hydropathy: 4.2 },
  '*': { code1: '*', code3: 'Stop', name: 'Stop Codon', category: 'stop', molecularWeight: 0, charge: 0, hydropathy: 0 },
  '?': { code1: '?', code3: 'Unk', name: 'Unknown / Frameshifted', category: 'special', molecularWeight: 0, charge: 0, hydropathy: 0 },
};

// Standard Genetic Code (NCBI translation table 1)
export const STANDARD_GENETIC_CODE: Record<string, string> = {
  // Phenylalanine
  TTT: 'F', TTC: 'F',
  // Leucine
  TTA: 'L', TTG: 'L', CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  // Isoleucine
  ATT: 'I', ATC: 'I', ATA: 'I',
  // Methionine (Start)
  ATG: 'M',
  // Valine
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  // Serine
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S', AGT: 'S', AGC: 'S',
  // Proline
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  // Threonine
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  // Alanine
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  // Tyrosine
  TAT: 'Y', TAC: 'Y',
  // Stop (Ochre, Amber, Opal)
  TAA: '*', TAG: '*', TGA: '*',
  // Histidine
  CAT: 'H', CAC: 'H',
  // Glutamine
  CAA: 'Q', CAG: 'Q',
  // Asparagine
  AAT: 'N', AAC: 'N',
  // Lysine
  AAA: 'K', AAG: 'K',
  // Aspartic Acid
  GAT: 'D', GAC: 'D',
  // Glutamic Acid
  GAA: 'E', GAG: 'E',
  // Cysteine
  TGT: 'C', TGC: 'C',
  // Tryptophan
  TGG: 'W',
  // Arginine
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R', AGA: 'R', AGG: 'R',
  // Glycine
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

// Reference Sequences Catalog with authentic NCBI RefSeq and PDB identifiers
export const REFERENCE_SEQUENCES: ReferenceSequence[] = [
  {
    id: 'demo-initial',
    name: 'Demonstration Sequence (B-DNA Coding Segment)',
    organism: 'Synthetic / Educational Model',
    geneSymbol: 'DEMO-1',
    accessionNumber: 'NCBI:SYN-EDU-0015',
    database: 'Educational Demonstration',
    sequence: 'ATGGCTACTGGTTAA',
    description: 'The standard 15 bp benchmark sequence from user requirements. Encodes Met-Ala-Thr-Gly-Stop. Nucleotide position 9 (T in codon ACT -> Thr) serves as the canonical interactive substitution target (ACT -> ACG, synonymous mutation).',
    demonstrationMutation: {
      position: 9,
      newBase: 'G',
      rationale: 'Substitutes T -> G at pos 9, changing codon 3 from ACT to ACG. Both codons translate to Threonine under standard genetic code, demonstrating a synonymous (silent) mutation.',
    },
  },
  {
    id: 'human-hbb-sickle',
    name: 'Human HBB Beta-Globin (Sickle Cell Hotspot)',
    organism: 'Homo sapiens',
    geneSymbol: 'HBB',
    accessionNumber: 'NCBI RefSeq: NM_000518.5',
    database: 'NCBI RefSeq',
    sequence: 'ATGGTGCACCTGACTCCTGAGGAGAAGTCT',
    description: 'Human hemoglobin beta chain (exonic coding region beginning at codon 1). The 6th codon (GAG, glutamic acid) undergoes a substitution to GTG (valine), leading to sickle cell hemoglobin (HbS).',
    demonstrationMutation: {
      position: 20,
      newBase: 'T',
      rationale: 'Substitutes A -> T at pos 20 (GAG -> GTG), converting acidic Glutamate (Glu6) to hydrophobic Valine (Val6), the molecular basis of sickle cell anemia.',
    },
    pdbId: '1A3N',
  },
  {
    id: 'human-tp53-codon248',
    name: 'Human TP53 Tumor Suppressor (Hotspot Codon 248)',
    organism: 'Homo sapiens',
    geneSymbol: 'TP53',
    accessionNumber: 'NCBI RefSeq: NM_000546.6',
    database: 'NCBI RefSeq',
    sequence: 'ATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGAC',
    description: 'Segment containing the DNA-binding domain of TP53. Arginine 248 (encoded by CGG) makes direct contact with the DNA minor groove. Mutations here are among the most frequent alterations in human cancers.',
    demonstrationMutation: {
      position: 8,
      newBase: 'T',
      rationale: 'Substitutes G -> T in codon CGG -> CTG (Arg -> Leu), destroying critical minor-groove hydrogen bonding contacts with DNA.',
    },
    pdbId: '1TUP',
  },
  {
    id: 'human-braf-v600e',
    name: 'Human BRAF Kinase (V600E Oncogenic Mutation)',
    organism: 'Homo sapiens',
    geneSymbol: 'BRAF',
    accessionNumber: 'NCBI RefSeq: NM_004333.6',
    database: 'NCBI RefSeq',
    sequence: 'GATTTTGGTCTAGCTACAGTGAAATCTCGATGG',
    description: 'Exon 15 of human BRAF kinase surrounding codon 600 (GTG, Valine). The T1799A transversion (GTG -> GAG) causes constitutive activation of the MAPK kinase pathway.',
    demonstrationMutation: {
      position: 20,
      newBase: 'A',
      rationale: 'Substitutes T -> A (GTG -> GAG, Val600Glu), causing phosphomimetic constitutive activation of the kinase domain.',
    },
    pdbId: '4MBJ',
  },
  {
    id: 'human-cftr-deltaf508',
    name: 'Human CFTR (Delta-F508 In-Frame Deletion)',
    organism: 'Homo sapiens',
    geneSymbol: 'CFTR',
    accessionNumber: 'NCBI RefSeq: NM_000492.4',
    database: 'NCBI RefSeq',
    sequence: 'ATCATTGGTGTTTCCTATGATGAATATAGA',
    description: 'Region encoding the NBD1 domain of CFTR. Deletion of the CTT/TTT codon encoding Phenylalanine at position 508 represents ~70% of cystic fibrosis alleles worldwide.',
    pdbId: '6MSM',
  },
  {
    id: 'pdb-1bna-dodecamer',
    name: 'Dickerson-Drew B-DNA Dodecamer (Canonical Crystal)',
    organism: 'Synthetic Oligonucleotide',
    geneSymbol: 'CGCGAATTCGCG',
    accessionNumber: 'RCSB PDB: 1BNA',
    database: 'RCSB PDB',
    sequence: 'CGCGAATTCGCG',
    description: 'The historic first high-resolution crystal structure of a single-turn B-DNA double helix solved by Dickerson and Drew (1981). Includes the canonical EcoRI recognition sequence GAATTC.',
    pdbId: '1BNA',
  },
];

/**
 * Validates DNA input string, parsing FASTA headers, detecting illegal characters,
 * computing GC/AT percentage, Tm, and coding metrics.
 */
export function validateDNASequence(rawInput: string): SequenceValidationResult {
  const lines = rawInput.trim().split(/\r?\n/);
  let fastaHeader: string | undefined = undefined;
  let sequenceLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      if (!fastaHeader) fastaHeader = trimmed.substring(1).trim();
    } else {
      sequenceLines.push(trimmed);
    }
  }

  const combined = sequenceLines.join('').replace(/\s+/g, '').toUpperCase();
  const invalidCharsSet = new Set<string>();

  for (let i = 0; i < combined.length; i++) {
    const char = combined[i];
    if (char !== 'A' && char !== 'T' && char !== 'G' && char !== 'C') {
      invalidCharsSet.add(char);
    }
  }

  const invalidCharacters = Array.from(invalidCharsSet);
  const isValid = invalidCharacters.length === 0 && combined.length > 0;
  const length = combined.length;

  let gCount = 0;
  let cCount = 0;
  let aCount = 0;
  let tCount = 0;

  for (let i = 0; i < combined.length; i++) {
    const c = combined[i];
    if (c === 'G') gCount++;
    else if (c === 'C') cCount++;
    else if (c === 'A') aCount++;
    else if (c === 'T') tCount++;
  }

  const gcCount = gCount + cCount;
  const atCount = aCount + tCount;
  const gcPercent = length > 0 ? Number(((gcCount / length) * 100).toFixed(1)) : 0;
  const atPercent = length > 0 ? Number(((atCount / length) * 100).toFixed(1)) : 0;
  const codonCount = Math.floor(length / 3);
  const isCompleteCodingSequence = length % 3 === 0 && length >= 3;

  // Nearest-neighbor / Wallace / Marmur melting temperature approximation
  let meltingTemperature = 0;
  if (length > 0) {
    if (length < 14) {
      meltingTemperature = (aCount + tCount) * 2 + (gCount + cCount) * 4;
    } else {
      meltingTemperature = Number((64.9 + (41 * (gcCount - 16.4)) / length).toFixed(1));
    }
  }

  // Molecular weight of ssDNA (average nucleotide ~330 Da, minus terminal water)
  const molecularWeightKDa = length > 0 ? Number(((length * 330) / 1000).toFixed(2)) : 0;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (combined.length === 0) {
    errors.push('Sequence is empty. Please enter a DNA sequence or choose a reference.');
  }

  if (invalidCharacters.length > 0) {
    errors.push(
      `Invalid nucleotide character(s) detected: [${invalidCharacters.join(
        ', '
      )}]. Only A, T, G, and C are accepted in canonical DNA sequences.`
    );
  }

  if (isValid && length % 3 !== 0) {
    warnings.push(
      `Sequence length (${length} bp) is not a multiple of 3. Downstream codons will be truncated in frame 0 translation.`
    );
  }

  if (isValid && isCompleteCodingSequence) {
    const startCodon = combined.substring(0, 3);
    const stopCodon = combined.substring(length - 3, length);
    if (startCodon !== 'ATG') {
      warnings.push(`First codon is '${startCodon}' (expected canonical start codon 'ATG').`);
    }
    if (stopCodon !== 'TAA' && stopCodon !== 'TAG' && stopCodon !== 'TGA') {
      warnings.push(`Terminal codon is '${stopCodon}' (no canonical stop codon TAA/TAG/TGA detected).`);
    }
  }

  return {
    isValid,
    cleanedSequence: combined,
    originalInput: rawInput,
    length,
    gcCount,
    atCount,
    gcPercent,
    atPercent,
    codonCount,
    isCompleteCodingSequence,
    meltingTemperature,
    molecularWeightKDa,
    invalidCharacters,
    fastaHeader,
    errors,
    warnings,
  };
}

/**
 * Returns the Watson-Crick complement of a nucleotide (A <-> T, G <-> C).
 */
export function getComplementaryBase(base: NucleotideType): NucleotideType {
  switch (base) {
    case 'A': return 'T';
    case 'T': return 'A';
    case 'G': return 'C';
    case 'C': return 'G';
  }
}

/**
 * Generates the complementary strand (antiparallel 3' to 5').
 */
export function generateComplementaryStrand(sequence: string): string {
  return sequence
    .split('')
    .map((b) => getComplementaryBase(b as NucleotideType))
    .join('');
}

/**
 * Transcribes coding DNA (5' -> 3') to mRNA (T -> U).
 */
export function transcribeToMRNA(dnaSequence: string): string {
  return dnaSequence.replace(/T/g, 'U');
}

/**
 * Translates a 3-letter DNA codon into an amino acid.
 */
export function translateCodon(
  codon: string,
  _table: GeneticCodeTable = 'standard'
): AminoAcidInfo {
  const upper = codon.toUpperCase();
  if (upper.length !== 3) {
    return AMINO_ACIDS['?'];
  }
  const aaCode = STANDARD_GENETIC_CODE[upper] || '?';
  return AMINO_ACIDS[aaCode] || AMINO_ACIDS['?'];
}

/**
 * Parses full sequence into structured codon list for a given reading frame (0, 1, or 2).
 */
export function extractCodons(
  sequence: string,
  readingFrame: 0 | 1 | 2 = 0,
  mutatedPositions: Set<number> = new Set()
): CodonInfo[] {
  const codons: CodonInfo[] = [];
  const seqToParse = sequence.substring(readingFrame);
  const totalComplete = Math.floor(seqToParse.length / 3);

  for (let i = 0; i < totalComplete; i++) {
    const startIdx = readingFrame + i * 3;
    const codonDna = sequence.substring(startIdx, startIdx + 3);
    const mrna = transcribeToMRNA(codonDna);
    const aa = translateCodon(codonDna);

    const pos1 = startIdx + 1;
    const pos2 = startIdx + 2;
    const pos3 = startIdx + 3;
    const isMut = mutatedPositions.has(pos1) || mutatedPositions.has(pos2) || mutatedPositions.has(pos3);

    codons.push({
      index: i + 1,
      sequence: codonDna,
      mrnaSequence: mrna,
      startPosition: pos1,
      endPosition: pos3,
      aminoAcid: aa,
      isStartCodon: codonDna === 'ATG',
      isStopCodon: codonDna === 'TAA' || codonDna === 'TAG' || codonDna === 'TGA',
      isMutated: isMut,
    });
  }

  return codons;
}

/**
 * Builds complete detailed NucleotideItem array for every position in the sequence.
 */
export function buildNucleotideItems(
  sequence: string,
  strand: 'coding' | 'complementary',
  mutatedIndices: Set<number> = new Set(),
  originalSeq?: string
): NucleotideItem[] {
  const items: NucleotideItem[] = [];
  const len = sequence.length;

  for (let i = 0; i < len; i++) {
    const position = i + 1; // 1-indexed
    const base = sequence[i] as NucleotideType;
    const complementBase = getComplementaryBase(base);
    const codonIndex = Math.floor(i / 3) + 1;
    const codonPosInTrio = ((i % 3) + 1) as 1 | 2 | 3;
    const codonStart = Math.floor(i / 3) * 3;
    const codonSeq = sequence.substring(codonStart, Math.min(codonStart + 3, len));
    const mrnaCodonSeq = transcribeToMRNA(codonSeq);
    const aa = translateCodon(codonSeq);
    const isMutated = mutatedIndices.has(position);

    items.push({
      position,
      base: strand === 'coding' ? base : complementBase,
      complementBase: strand === 'coding' ? complementBase : base,
      strand,
      direction: strand === 'coding' ? "5'-to-3'" : "3'-to-5'",
      codonIndex,
      codonPosInTrio,
      codonSeq,
      mrnaCodonSeq,
      aminoAcid: aa,
      isStartCodon: codonSeq === 'ATG',
      isStopCodon: codonSeq === 'TAA' || codonSeq === 'TAG' || codonSeq === 'TGA',
      isMutated,
      originalBase: originalSeq ? (originalSeq[i] as NucleotideType) : undefined,
    });
  }

  return items;
}

/**
 * Classifies point mutation as Transition (purine <-> purine or pyrimidine <-> pyrimidine)
 * or Transversion (purine <-> pyrimidine).
 */
export function checkTransitionTransversion(
  orig: NucleotideType,
  mut: NucleotideType
): { isTransition: boolean; isTransversion: boolean; typeStr: string } {
  if (orig === mut) {
    return { isTransition: false, isTransversion: false, typeStr: 'None' };
  }
  const isOrigPurine = orig === 'A' || orig === 'G';
  const isMutPurine = mut === 'A' || mut === 'G';

  if (isOrigPurine === isMutPurine) {
    return { isTransition: true, isTransversion: false, typeStr: 'Transition' };
  } else {
    return { isTransition: false, isTransversion: true, typeStr: 'Transversion' };
  }
}

/**
 * Performs mutation on sequence and evaluates complete biological consequences.
 */
export function simulateMutation(
  originalSeq: string,
  type: MutationType,
  position: number, // 1-indexed
  newBaseOrBases: string
): { mutatedSeq: string; diff: MutationDiff } {
  let mutatedSeq = originalSeq;
  const idx = position - 1;

  if (type === 'substitution') {
    const singleNewBase = newBaseOrBases.toUpperCase().charAt(0) as NucleotideType;
    mutatedSeq = originalSeq.substring(0, idx) + singleNewBase + originalSeq.substring(idx + 1);
  } else if (type === 'insertion') {
    const ins = newBaseOrBases.toUpperCase();
    mutatedSeq = originalSeq.substring(0, idx) + ins + originalSeq.substring(idx);
  } else if (type === 'deletion') {
    const delCount = Math.max(1, newBaseOrBases.length || 1);
    mutatedSeq = originalSeq.substring(0, idx) + originalSeq.substring(idx + delCount);
  }

  // Determine affected codon & amino acid
  const origCodonStart = Math.floor(idx / 3) * 3;
  const origCodonSeq = originalSeq.substring(origCodonStart, origCodonStart + 3);
  const origAA = translateCodon(origCodonSeq);

  let mutatedCodonSeq: string | undefined = undefined;
  let mutAA: AminoAcidInfo | undefined = undefined;

  let category: MutationDiff['category'] = 'missense';
  let categoryLabel = 'Missense';
  let description = '';
  let readingFrameShift = 0;
  let isTransition: boolean | undefined = undefined;
  let isTransversion: boolean | undefined = undefined;

  if (type === 'substitution') {
    const origBase = originalSeq[idx] as NucleotideType;
    const newBase = mutatedSeq[idx] as NucleotideType;
    const tt = checkTransitionTransversion(origBase, newBase);
    isTransition = tt.isTransition;
    isTransversion = tt.isTransversion;

    mutatedCodonSeq = mutatedSeq.substring(origCodonStart, origCodonStart + 3);
    mutAA = translateCodon(mutatedCodonSeq);

    if (origAA.code1 === mutAA.code1) {
      category = 'synonymous';
      categoryLabel = 'Synonymous (Silent)';
      description = `Substitution ${origBase}${position}${newBase} changes codon ${origCodonSeq} to ${mutatedCodonSeq}. Both encode ${origAA.name} (${origAA.code3}). No amino acid sequence change occurs under the standard genetic code.`;
    } else if (mutAA.code1 === '*') {
      category = 'nonsense';
      categoryLabel = 'Nonsense (Stop-gain)';
      description = `Substitution ${origBase}${position}${newBase} generates a premature termination codon (${mutatedCodonSeq}), terminating translation early at position ${Math.floor(idx / 3) + 1}.`;
    } else if (origAA.code1 === '*') {
      category = 'missense';
      categoryLabel = 'Stop-loss';
      description = `Substitution ${origBase}${position}${newBase} removes the stop codon, leading to translational readthrough.`;
    } else {
      category = 'missense';
      categoryLabel = 'Missense';
      const chemDiff = origAA.category !== mutAA.category ? `non-conservative (${origAA.category} -> ${mutAA.category})` : `conservative (${origAA.category})`;
      description = `Substitution ${origBase}${position}${newBase} replaces ${origAA.name} (${origAA.code3}) with ${mutAA.name} (${mutAA.code3}). Chemical shift: ${chemDiff}.`;
    }
  } else if (type === 'insertion') {
    const insertedLen = newBaseOrBases.length;
    readingFrameShift = insertedLen % 3;
    if (readingFrameShift !== 0) {
      category = 'frameshift';
      categoryLabel = `Frameshift (+${insertedLen} bp)`;
      description = `Insertion of ${insertedLen} bp disrupts the downstream triplet reading frame. All subsequent amino acids and termination signals are altered.`;
    } else {
      category = 'inframe_insertion';
      categoryLabel = `In-frame Insertion (+${insertedLen / 3} AA)`;
      description = `Insertion of ${insertedLen} bp inserts ${insertedLen / 3} amino acid(s) into the polypeptide while maintaining downstream reading frame integrity.`;
    }
  } else if (type === 'deletion') {
    const deletedLen = Math.max(1, newBaseOrBases.length || 1);
    readingFrameShift = deletedLen % 3;
    if (readingFrameShift !== 0) {
      category = 'frameshift';
      categoryLabel = `Frameshift (-${deletedLen} bp)`;
      description = `Deletion of ${deletedLen} bp alters downstream codon groupings, producing an extensive translational frameshift.`;
    } else {
      category = 'inframe_deletion';
      categoryLabel = `In-frame Deletion (-${deletedLen / 3} AA)`;
      description = `Deletion of ${deletedLen} bp removes ${deletedLen / 3} amino acid(s) without disrupting the downstream reading frame.`;
    }
  }

  const diff: MutationDiff = {
    type,
    position,
    originalBase: originalSeq[idx],
    newBase: type === 'substitution' ? mutatedSeq[idx] : undefined,
    insertedBases: type === 'insertion' ? newBaseOrBases : undefined,
    deletedBases: type === 'deletion' ? originalSeq.substring(idx, idx + (newBaseOrBases.length || 1)) : undefined,
    originalSequence: originalSeq,
    mutatedSequence: mutatedSeq,
    originalCodon: origCodonSeq,
    mutatedCodon: mutatedCodonSeq,
    originalAminoAcid: origAA,
    mutatedAminoAcid: mutAA,
    category,
    categoryLabel,
    description,
    isTransition,
    isTransversion,
    readingFrameShift,
  };

  return { mutatedSeq, diff };
}

/**
 * Compares reference sequence with observed sequence via backend pairwise aligner.
 */
export async function compareSequences(
  referenceSequence: string,
  observedSequence: string,
  readingFrame: number = 0
): Promise<CompareResult> {
  const res = await fetch('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference_sequence: referenceSequence,
      observed_sequence: observedSequence,
      reading_frame: readingFrame,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      detail || `Reference-aware alignment failed with HTTP ${res.status}. Start the BioCrystal backend and retry.`
    );
  }

  // Indel-aware coordinate mapping is only performed by the backend aligner.
  // Do not silently replace it with an index-by-index browser comparison.
  return await res.json();
}

/**
 * Conducts exploratory sequence analysis (ORFs, composition, motifs).
 */
export async function annotateSequence(sequence: string): Promise<ExploratoryAnalysisResult> {
  try {
    const res = await fetch('/api/annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback client-side
  }

  const val = validateDNASequence(sequence);
  const seq = val.cleanedSequence;

  // Simple motifs detection
  const homopolymers: ExploratoryAnalysisResult['homopolymers'] = [];
  const homopolymerMatches = seq.matchAll(/([ATGC])\1{3,}/g);
  for (const match of homopolymerMatches) {
    if (match.index !== undefined) {
      homopolymers.push({
        base: match[1],
        length: match[0].length,
        start_position: match.index + 1,
        end_position: match.index + match[0].length,
        sequence: match[0],
      });
    }
  }

  // Reading frames
  const reading_frames: ExploratoryAnalysisResult['reading_frames'] = [0, 1, 2].map((f) => {
    const codons = extractCodons(seq, f as 0 | 1 | 2);
    const stopCount = codons.filter((c) => c.isStopCodon).length;
    return {
      frame_label: `+${f + 1}`,
      frame_index: f,
      codons,
      codon_count: codons.length,
      stop_count: stopCount,
      has_internal_stop: codons.some((c, i) => c.isStopCodon && i < codons.length - 1),
      protein_string: codons.map((c) => c.aminoAcid.code1).join(''),
    };
  });

  return {
    validation: val,
    composition: {
      counts: {
        A: (seq.match(/A/g) || []).length,
        T: (seq.match(/T/g) || []).length,
        G: (seq.match(/G/g) || []).length,
        C: (seq.match(/C/g) || []).length,
      },
      percentages: {
        A: Math.round(((seq.match(/A/g) || []).length / (seq.length || 1)) * 100),
        T: Math.round(((seq.match(/T/g) || []).length / (seq.length || 1)) * 100),
        G: Math.round(((seq.match(/G/g) || []).length / (seq.length || 1)) * 100),
        C: Math.round(((seq.match(/C/g) || []).length / (seq.length || 1)) * 100),
      },
      gc_percent: val.gcPercent,
      at_percent: val.atPercent,
      gc_ratio: Number(((val.gcCount) / Math.max(val.atCount, 1)).toFixed(2)),
    },
    homopolymers,
    tandem_repeats: [],
    orfs: reading_frames.map((rf) => ({
      frame: rf.frame_label,
      frame_index: rf.frame_index,
      start_position: 1,
      end_position: seq.length,
      length_bp: rf.codons.length * 3,
      length_aa: rf.codons.length,
      has_start_codon: rf.codons[0]?.isStartCodon || false,
      has_stop_codon: rf.codons[rf.codons.length - 1]?.isStopCodon || false,
      nucleotide_sequence: seq,
      protein_sequence: rf.protein_string,
    })),
    reading_frames,
    anomalies: val.warnings,
    limitations_notice:
      'Sequence analyzed without an authoritative reference. Anomalies and candidate reading frames are descriptive structural observations.',
  };
}

/**
 * Requests ranked correction candidates from the backend engine.
 */
export async function getCorrectionCandidates(
  observedSequence: string,
  referenceSequence?: string,
  readingFrame: number = 0,
  constraints?: Record<string, any>
): Promise<CorrectionRecommendationResult> {
  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observed_sequence: observedSequence,
        reference_sequence: referenceSequence || null,
        reading_frame: readingFrame,
        constraints: constraints || null,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(detail || `Candidate service returned HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    // Never fabricate a restoration candidate in the browser. An unavailable
    // scientific backend must be reported as unavailable, not replaced by a
    // hard-coded score or an assumed reference repair.
    return {
      observed_sequence: observedSequence,
      reference_sequence: referenceSequence || null,
      reading_frame: `+${readingFrame + 1}`,
      total_candidates: 0,
      strategies_used: [],
      candidates: [],
      recommendation_status: 'candidate_service_unavailable',
      recommendation_notice:
        'Candidate assessment could not be completed because the scientific backend is unavailable. No replacement has been recommended.',
      safeguards_notice:
        error instanceof Error
          ? error.message
          : 'The candidate assessment service could not be reached. Try again when the backend is running.',
    };
  }
}


