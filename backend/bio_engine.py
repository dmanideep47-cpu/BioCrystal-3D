import re
from typing import Dict, Any, List, Optional, Tuple
from Bio.Seq import Seq
from Bio.Data import CodonTable
from Bio.SeqUtils import gc_fraction, molecular_weight, MeltingTemp as mt
from Bio import Align

# Standard amino acid table metadata
AMINO_ACID_METADATA: Dict[str, Dict[str, Any]] = {
    'A': {'code3': 'Ala', 'name': 'Alanine', 'category': 'hydrophobic', 'mw': 89.09, 'charge': 0, 'hydropathy': 1.8},
    'R': {'code3': 'Arg', 'name': 'Arginine', 'category': 'basic', 'mw': 174.20, 'charge': 1, 'hydropathy': -4.5},
    'N': {'code3': 'Asn', 'name': 'Asparagine', 'category': 'polar', 'mw': 132.12, 'charge': 0, 'hydropathy': -3.5},
    'D': {'code3': 'Asp', 'name': 'Aspartic Acid', 'category': 'acidic', 'mw': 133.10, 'charge': -1, 'hydropathy': -3.5},
    'C': {'code3': 'Cys', 'name': 'Cysteine', 'category': 'special', 'mw': 121.16, 'charge': 0, 'hydropathy': 2.5},
    'Q': {'code3': 'Gln', 'name': 'Glutamine', 'category': 'polar', 'mw': 146.15, 'charge': 0, 'hydropathy': -3.5},
    'E': {'code3': 'Glu', 'name': 'Glutamic Acid', 'category': 'acidic', 'mw': 147.13, 'charge': -1, 'hydropathy': -3.5},
    'G': {'code3': 'Gly', 'name': 'Glycine', 'category': 'special', 'mw': 75.07, 'charge': 0, 'hydropathy': -0.4},
    'H': {'code3': 'His', 'name': 'Histidine', 'category': 'basic', 'mw': 155.16, 'charge': 0.1, 'hydropathy': -3.2},
    'I': {'code3': 'Ile', 'name': 'Isoleucine', 'category': 'hydrophobic', 'mw': 131.17, 'charge': 0, 'hydropathy': 4.5},
    'L': {'code3': 'Leu', 'name': 'Leucine', 'category': 'hydrophobic', 'mw': 131.17, 'charge': 0, 'hydropathy': 3.8},
    'K': {'code3': 'Lys', 'name': 'Lysine', 'category': 'basic', 'mw': 146.19, 'charge': 1, 'hydropathy': -3.9},
    'M': {'code3': 'Met', 'name': 'Methionine', 'category': 'hydrophobic', 'mw': 149.21, 'charge': 0, 'hydropathy': 1.9},
    'F': {'code3': 'Phe', 'name': 'Phenylalanine', 'category': 'hydrophobic', 'mw': 165.19, 'charge': 0, 'hydropathy': 2.8},
    'P': {'code3': 'Pro', 'name': 'Proline', 'category': 'special', 'mw': 115.13, 'charge': 0, 'hydropathy': -1.6},
    'S': {'code3': 'Ser', 'name': 'Serine', 'category': 'polar', 'mw': 105.09, 'charge': 0, 'hydropathy': -0.8},
    'T': {'code3': 'Thr', 'name': 'Threonine', 'category': 'polar', 'mw': 119.12, 'charge': 0, 'hydropathy': -0.7},
    'W': {'code3': 'Trp', 'name': 'Tryptophan', 'category': 'hydrophobic', 'mw': 204.23, 'charge': 0, 'hydropathy': -0.9},
    'Y': {'code3': 'Tyr', 'name': 'Tyrosine', 'category': 'polar', 'mw': 181.19, 'charge': 0, 'hydropathy': -1.3},
    'V': {'code3': 'Val', 'name': 'Valine', 'category': 'hydrophobic', 'mw': 117.15, 'charge': 0, 'hydropathy': 4.2},
    '*': {'code3': 'Stop', 'name': 'Stop Codon', 'category': 'stop', 'mw': 0, 'charge': 0, 'hydropathy': 0},
    '?': {'code3': 'Unk', 'name': 'Unknown', 'category': 'special', 'mw': 0, 'charge': 0, 'hydropathy': 0},
}


def get_amino_acid_info(codon: Optional[str], table_id: int = 1) -> Dict[str, Any]:
    if not codon or len(codon) != 3:
        return AMINO_ACID_METADATA['?']
    codon_u = codon.upper()
    table = CodonTable.unambiguous_dna_by_id[table_id]
    if codon_u in table.stop_codons:
        return AMINO_ACID_METADATA['*']
    code1 = table.forward_table.get(codon_u, '?')
    return AMINO_ACID_METADATA.get(code1, AMINO_ACID_METADATA['?'])


def validate_dna_sequence(raw_input: str) -> Dict[str, Any]:
    lines = raw_input.strip().splitlines()
    fasta_header = None
    seq_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith('>'):
            if fasta_header is None:
                fasta_header = stripped[1:].strip()
        else:
            seq_lines.append(stripped)

    combined = "".join(seq_lines).replace(" ", "").upper()
    valid_bases = {'A', 'T', 'G', 'C'}
    invalid_chars = sorted(list({c for c in combined if c not in valid_bases}))

    is_valid = len(invalid_chars) == 0 and len(combined) > 0
    length = len(combined)

    errors = []
    warnings = []

    if len(combined) == 0:
        errors.append("Sequence is empty.")
    if invalid_chars:
        errors.append(f"Invalid character(s) detected: [{', '.join(invalid_chars)}]. Only canonical DNA bases A, T, G, C are valid.")

    gc_pct = 0.0
    at_pct = 0.0
    tm_c = 0.0
    mw_kda = 0.0

    if is_valid:
        seq_obj = Seq(combined)
        gc_pct = round(gc_fraction(seq_obj) * 100, 1)
        at_pct = round(100.0 - gc_pct, 1)
        try:
            tm_c = round(float(mt.Tm_NN(seq_obj)), 1)
        except Exception:
            tm_c = round(64.9 + 41 * (seq_obj.count('G') + seq_obj.count('C') - 16.4) / length, 1)
        mw_kda = round(float(molecular_weight(seq_obj, seq_type='DNA')) / 1000.0, 2)

        if length % 3 != 0:
            warnings.append(f"Sequence length ({length} bp) is not a multiple of 3.")

    return {
        "is_valid": is_valid,
        "cleaned_sequence": combined,
        "fasta_header": fasta_header,
        "length": length,
        "gc_percent": gc_pct,
        "at_percent": at_pct,
        "codon_count": length // 3,
        "melting_temperature": tm_c,
        "molecular_weight_kda": mw_kda,
        "invalid_characters": invalid_chars,
        "errors": errors,
        "warnings": warnings,
    }


def translate_dna(sequence: str, table_id: int = 1, reading_frame: int = 0) -> List[Dict[str, Any]]:
    table = CodonTable.unambiguous_dna_by_id[table_id]
    codons = []
    seq_frame = sequence[reading_frame:]
    total_triplets = len(seq_frame) // 3

    for i in range(total_triplets):
        start = reading_frame + i * 3
        triplet = sequence[start:start + 3]
        mrna = triplet.replace('T', 'U')

        if triplet in table.stop_codons:
            aa_char = '*'
        else:
            aa_char = table.forward_table.get(triplet, '?')

        meta = AMINO_ACID_METADATA.get(aa_char, AMINO_ACID_METADATA['?'])

        codons.append({
            "index": i + 1,
            "triplet": triplet,
            "mrna": mrna,
            "start_pos": start + 1,
            "end_pos": start + 3,
            "amino_acid": {
                "code1": aa_char,
                "code3": meta['code3'],
                "name": meta['name'],
                "category": meta['category'],
                "mw": meta['mw'],
                "charge": meta['charge'],
                "hydropathy": meta['hydropathy'],
            },
            "is_start": triplet == 'ATG',
            "is_stop": triplet in table.stop_codons,
        })

    return codons


def classify_mutation(
    original_seq: str,
    mut_type: str,
    position: int,  # 1-indexed
    new_bases: str,
    table_id: int = 1
) -> Dict[str, Any]:
    idx = position - 1
    table = CodonTable.unambiguous_dna_by_id[table_id]

    if mut_type == 'substitution':
        single_base = new_bases.upper()[0]
        mutated_seq = original_seq[:idx] + single_base + original_seq[idx + 1:]
    elif mut_type == 'insertion':
        ins = new_bases.upper()
        mutated_seq = original_seq[:idx] + ins + original_seq[idx:]
    elif mut_type == 'deletion':
        del_len = max(1, len(new_bases))
        mutated_seq = original_seq[:idx] + original_seq[idx + del_len:]
    else:
        mutated_seq = original_seq

    # Codon analysis
    orig_codon_idx = idx // 3
    orig_codon_start = orig_codon_idx * 3
    orig_codon = original_seq[orig_codon_start:orig_codon_start + 3] if len(original_seq) >= orig_codon_start + 3 else None
    mut_codon = mutated_seq[orig_codon_start:orig_codon_start + 3] if len(mutated_seq) >= orig_codon_start + 3 else None

    orig_aa = get_amino_acid_info(orig_codon, table_id)
    mut_aa = get_amino_acid_info(mut_codon, table_id) if mut_codon else None

    # Classification
    category = "missense"
    category_label = "Missense"
    description = ""
    is_trans = None
    is_transv = None

    if mut_type == 'substitution':
        orig_base = original_seq[idx]
        new_base = mutated_seq[idx]
        is_orig_purine = orig_base in ('A', 'G')
        is_mut_purine = new_base in ('A', 'G')
        is_trans = is_orig_purine == is_mut_purine
        is_transv = not is_trans

        if orig_aa['code3'] == mut_aa['code3']:
            category = "synonymous"
            category_label = "Synonymous (Silent)"
            description = f"Substitution {orig_base}{position}{new_base} alters codon {orig_codon} to {mut_codon}. Both translate to {orig_aa['name']} ({orig_aa['code3']}) under standard code. No amino acid alteration occurs."
        elif mut_aa['code3'] == 'Stop':
            category = "nonsense"
            category_label = "Nonsense (Stop-gain)"
            description = f"Substitution {orig_base}{position}{new_base} produces a premature termination codon ({mut_codon}), causing early polypeptide truncation."
        elif orig_aa['code3'] == 'Stop' and mut_aa['code3'] != 'Stop':
            category = "stop_loss"
            category_label = "Stop-loss"
            description = f"Substitution {orig_base}{position}{new_base} removes stop codon ({orig_codon} -> {mut_codon}), elongating translation."
        elif orig_codon_idx == 0 and orig_codon == 'ATG' and mut_codon != 'ATG':
            category = "start_loss"
            category_label = "Start-loss"
            description = f"Substitution {orig_base}{position}{new_base} disrupts the canonical initiator Methionine codon (ATG -> {mut_codon})."
        else:
            category = "missense"
            category_label = "Missense"
            chem_shift = f"non-conservative ({orig_aa['category']} -> {mut_aa['category']})" if orig_aa['category'] != mut_aa['category'] else f"conservative ({orig_aa['category']})"
            description = f"Substitution {orig_base}{position}{new_base} changes codon {orig_codon} to {mut_codon}, replacing {orig_aa['name']} with {mut_aa['name']}. Chemical shift: {chem_shift}."
    elif mut_type == 'insertion':
        ins_len = len(new_bases)
        if ins_len % 3 == 0:
            category = "inframe_insertion"
            category_label = f"In-frame Insertion (+{ins_len // 3} AA)"
            description = f"Insertion of {ins_len} bp adds {ins_len // 3} amino acid(s) while preserving downstream reading frame."
        else:
            category = "frameshift"
            category_label = f"Frameshift (+{ins_len} bp)"
            description = f"Insertion of {ins_len} bp alters reading frame (+{ins_len % 3} shift), disrupting all downstream codons."
    elif mut_type == 'deletion':
        del_len = max(1, len(new_bases))
        if del_len % 3 == 0:
            category = "inframe_deletion"
            category_label = f"In-frame Deletion (-{del_len // 3} AA)"
            description = f"Deletion of {del_len} bp deletes {del_len // 3} amino acid(s) while preserving downstream frame."
        else:
            category = "frameshift"
            category_label = f"Frameshift (-{del_len} bp)"
            description = f"Deletion of {del_len} bp disrupts downstream reading frame."

    return {
        "original_sequence": original_seq,
        "mutated_sequence": mutated_seq,
        "type": mut_type,
        "position": position,
        "original_codon": orig_codon,
        "mutated_codon": mut_codon,
        "original_amino_acid": orig_aa,
        "mutated_amino_acid": mut_aa,
        "category": category,
        "category_label": category_label,
        "description": description,
        "is_transition": is_trans,
        "is_transversion": is_transv,
    }


# ==============================================================================
# MODE A: REFERENCE-BASED PAIRWISE ALIGNMENT AND DIFFERENTIAL DETECTION
# ==============================================================================

def perform_pairwise_alignment(
    ref_seq: str,
    obs_seq: str,
    reading_frame: int = 0,
    table_id: int = 1,
    is_coding: bool = True,
) -> Dict[str, Any]:
    """
    Performs pairwise global alignment between reference and observed sequence
    using Biopython PairwiseAligner and classifies all detected mutations.
    """
    clean_ref = ref_seq.strip().upper()
    clean_obs = obs_seq.strip().upper()

    aligner = Align.PairwiseAligner()
    aligner.mode = 'global'
    aligner.match_score = 2
    aligner.mismatch_score = -1
    aligner.open_gap_score = -2.5
    aligner.extend_gap_score = -1

    alignments = aligner.align(clean_ref, clean_obs)
    if not alignments:
        return {
            "alignment_score": 0,
            "identity_percent": 0.0,
            "mutations": [],
            "aligned_ref": clean_ref,
            "aligned_obs": clean_obs,
        }

    al = alignments[0]
    aligned_ref = str(al[0])
    aligned_obs = str(al[1])

    # Walk aligned strings and extract discrete mutation events
    ref_pos = 1
    obs_pos = 1
    mutations: List[Dict[str, Any]] = []

    i = 0
    total_len = len(aligned_ref)
    identical_matches = 0

    while i < total_len:
        r_char = aligned_ref[i]
        o_char = aligned_obs[i]

        if r_char == o_char and r_char != '-':
            identical_matches += 1
            ref_pos += 1
            obs_pos += 1
            i += 1
        elif r_char != '-' and o_char != '-':
            # Substitution
            orig_base = r_char
            new_base = o_char
            curr_ref_pos = ref_pos
            curr_obs_pos = obs_pos

            codon_idx = (curr_ref_pos - 1 - reading_frame) // 3
            ref_codon = None
            obs_codon = None
            ref_aa = AMINO_ACID_METADATA['?']
            obs_aa = AMINO_ACID_METADATA['?']
            is_trans = None

            if is_coding:
                ref_codon_start = reading_frame + codon_idx * 3
                obs_codon_idx = (curr_obs_pos - 1 - reading_frame) // 3
                obs_codon_start = reading_frame + obs_codon_idx * 3
                ref_codon = clean_ref[ref_codon_start:ref_codon_start + 3] if ref_codon_start >= 0 else None
                obs_codon = clean_obs[obs_codon_start:obs_codon_start + 3] if obs_codon_start >= 0 else None

                ref_aa = get_amino_acid_info(ref_codon, table_id)
                obs_aa = get_amino_acid_info(obs_codon, table_id)

                is_orig_purine = orig_base in ('A', 'G')
                is_mut_purine = new_base in ('A', 'G')
                is_trans = is_orig_purine == is_mut_purine

                if ref_aa['code3'] == obs_aa['code3']:
                    category = "synonymous"
                    category_label = "Synonymous"
                    desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} changes codon {ref_codon} to {obs_codon} and preserves {ref_aa['name']}."
                elif obs_aa['code3'] == 'Stop':
                    category = "nonsense"
                    category_label = "Stop gain"
                    desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} changes codon {ref_codon} to stop codon {obs_codon}."
                elif ref_aa['code3'] == 'Stop' and obs_aa['code3'] != 'Stop':
                    category = "stop_loss"
                    category_label = "Stop loss"
                    desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} changes stop codon {ref_codon} to {obs_codon}."
                elif codon_idx == 0 and ref_codon == 'ATG' and obs_codon != 'ATG':
                    category = "start_loss"
                    category_label = "Start codon change"
                    desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} changes the initial codon from ATG to {obs_codon}."
                else:
                    category = "missense"
                    category_label = "Amino-acid substitution"
                    desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} changes codon {ref_codon} to {obs_codon}."
            else:
                category = "non_coding"
                category_label = "Sequence substitution"
                desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} relative to the selected reference."

            mutations.append({
                "type": "substitution",
                "reference_position": curr_ref_pos,
                "observed_position": curr_obs_pos,
                "original_base": orig_base,
                "observed_base": new_base,
                "affected_codon_index": codon_idx + 1 if is_coding else None,
                "reference_codon": ref_codon,
                "observed_codon": obs_codon,
                "original_amino_acid": ref_aa,
                "observed_amino_acid": obs_aa,
                "category": category,
                "category_label": category_label,
                "is_transition": is_trans,
                "is_transversion": not is_trans,
                "description": desc,
            })
            ref_pos += 1
            obs_pos += 1
            i += 1
        elif r_char == '-':
            # Insertion in observed
            ins_bases = []
            curr_ref_pos = ref_pos
            start_obs_pos = obs_pos
            while i < total_len and aligned_ref[i] == '-':
                ins_bases.append(aligned_obs[i])
                obs_pos += 1
                i += 1
            ins_str = "".join(ins_bases)
            ins_len = len(ins_str)

            if not is_coding:
                cat = "non_coding"
                cat_label = "Sequence insertion"
                desc = f"Insertion of {ins_len} bp ({ins_str}) relative to the selected reference."
            elif ins_len % 3 == 0:
                cat = "inframe_insertion"
                cat_label = f"In-frame Insertion (+{ins_len // 3} AA)"
                desc = f"Insertion of {ins_len} bp ({ins_str}) preserves downstream reading frame."
            else:
                cat = "frameshift"
                cat_label = f"Frameshift (+{ins_len} bp)"
                desc = f"Insertion of {ins_len} bp ({ins_str}) disrupts downstream reading frame (+{ins_len % 3} shift)."

            mutations.append({
                "type": "insertion",
                "reference_position": curr_ref_pos,
                "reference_left_position": curr_ref_pos - 1 if curr_ref_pos > 1 else None,
                "reference_right_position": curr_ref_pos if curr_ref_pos <= len(clean_ref) else None,
                "observed_position": start_obs_pos,
                "original_base": "-",
                "observed_base": ins_str,
                "affected_codon_index": (curr_ref_pos - 1 - reading_frame) // 3 + 1,
                "reference_codon": None,
                "observed_codon": None,
                "original_amino_acid": AMINO_ACID_METADATA['?'],
                "observed_amino_acid": AMINO_ACID_METADATA['?'],
                "category": cat,
                "category_label": cat_label,
                "is_transition": None,
                "is_transversion": None,
                "description": desc,
            })
        elif o_char == '-':
            # Deletion in observed
            del_bases = []
            start_ref_pos = ref_pos
            curr_obs_pos = obs_pos
            while i < total_len and aligned_obs[i] == '-':
                del_bases.append(aligned_ref[i])
                ref_pos += 1
                i += 1
            del_str = "".join(del_bases)
            del_len = len(del_str)

            if not is_coding:
                cat = "non_coding"
                cat_label = "Sequence deletion"
                desc = f"Deletion of reference bases {start_ref_pos}-{start_ref_pos + del_len - 1} ({del_str})."
            elif del_len % 3 == 0:
                cat = "inframe_deletion"
                cat_label = f"In-frame Deletion (-{del_len // 3} AA)"
                desc = f"Deletion of {del_len} bp ({del_str}) deletes {del_len // 3} amino acid(s) while preserving downstream frame."
            else:
                cat = "frameshift"
                cat_label = f"Frameshift (-{del_len} bp)"
                desc = f"Deletion of {del_len} bp ({del_str}) disrupts downstream reading frame."

            mutations.append({
                "type": "deletion",
                "reference_position": start_ref_pos,
                "reference_end_position": start_ref_pos + del_len - 1,
                "observed_position": curr_obs_pos,
                "original_base": del_str,
                "observed_base": "-",
                "affected_codon_index": (start_ref_pos - 1 - reading_frame) // 3 + 1,
                "reference_codon": None,
                "observed_codon": None,
                "original_amino_acid": AMINO_ACID_METADATA['?'],
                "observed_amino_acid": AMINO_ACID_METADATA['?'],
                "category": cat,
                "category_label": cat_label,
                "is_transition": None,
                "is_transversion": None,
                "description": desc,
            })

    identity_pct = round((identical_matches / max(total_len, 1)) * 100, 1)

    return {
        "alignment_score": float(al.score),
        "identity_percent": identity_pct,
        "mutation_count": len(mutations),
        "mutations": mutations,
        "aligned_reference": aligned_ref,
        "aligned_observed": aligned_obs,
        "method": "Biopython PairwiseAligner global alignment",
        "scoring": {
            "match": 2,
            "mismatch": -1,
            "gap_open": -2.5,
            "gap_extend": -1,
        },
        "normalization": "The first optimal alignment returned by PairwiseAligner is reported; equivalent repeat-region placements are not independently normalized.",
    }


# ==============================================================================
# MODE B: SEQUENCE-ONLY EXPLORATORY ANALYSIS
# ==============================================================================

def find_homopolymers(sequence: str, min_length: int = 4) -> List[Dict[str, Any]]:
    homopolymers = []
    for match in re.finditer(r'([ATGC])\1{' + str(min_length - 1) + r',}', sequence):
        homopolymers.append({
            "base": match.group(1),
            "length": len(match.group(0)),
            "start_position": match.start() + 1,
            "end_position": match.end(),
            "sequence": match.group(0),
        })
    return homopolymers


def find_tandem_repeats(sequence: str) -> List[Dict[str, Any]]:
    repeats = []
    # Dinucleotide repeats (>= 3 units, e.g. ATATAT, CGCGCG)
    for m in re.finditer(r'(([ATGC]{2}))\1{2,}', sequence):
        unit = m.group(2)
        total = m.group(0)
        repeats.append({
            "unit": unit,
            "unit_length": 2,
            "copies": len(total) // 2,
            "start_position": m.start() + 1,
            "end_position": m.end(),
            "pattern": total,
        })
    # Trinucleotide repeats (>= 2 units, e.g. CAGCAG)
    for m in re.finditer(r'(([ATGC]{3}))\1{1,}', sequence):
        unit = m.group(2)
        total = m.group(0)
        repeats.append({
            "unit": unit,
            "unit_length": 3,
            "copies": len(total) // 3,
            "start_position": m.start() + 1,
            "end_position": m.end(),
            "pattern": total,
        })
    return repeats


def find_open_reading_frames(sequence: str, table_id: int = 1) -> List[Dict[str, Any]]:
    table = CodonTable.unambiguous_dna_by_id[table_id]
    orfs: List[Dict[str, Any]] = []

    for frame in (0, 1, 2):
        frame_seq = sequence[frame:]
        triplets = [frame_seq[i:i + 3] for i in range(0, len(frame_seq) - 2, 3)]
        
        in_orf = False
        start_idx = -1
        current_codons: List[str] = []

        for idx, tr in enumerate(triplets):
            if not in_orf:
                if tr == 'ATG':
                    in_orf = True
                    start_idx = idx
                    current_codons = [tr]
            else:
                current_codons.append(tr)
                if tr in table.stop_codons:
                    # ORF complete
                    start_pos = frame + start_idx * 3 + 1
                    end_pos = frame + (idx + 1) * 3
                    aa_seq = []
                    for c in current_codons:
                        if c in table.stop_codons:
                            aa_seq.append('*')
                        else:
                            aa_seq.append(table.forward_table.get(c, '?'))
                    
                    orfs.append({
                        "frame": f"+{frame + 1}",
                        "frame_index": frame,
                        "start_position": start_pos,
                        "end_position": end_pos,
                        "length_bp": len(current_codons) * 3,
                        "length_aa": len(current_codons),
                        "has_start_codon": True,
                        "has_stop_codon": True,
                        "nucleotide_sequence": "".join(current_codons),
                        "protein_sequence": "".join(aa_seq),
                    })
                    in_orf = False
                    current_codons = []

        # If sequence ends without stop codon but started
        if in_orf and current_codons:
            start_pos = frame + start_idx * 3 + 1
            end_pos = frame + len(triplets) * 3
            aa_seq = [table.forward_table.get(c, '?') for c in current_codons]
            orfs.append({
                "frame": f"+{frame + 1}",
                "frame_index": frame,
                "start_position": start_pos,
                "end_position": end_pos,
                "length_bp": len(current_codons) * 3,
                "length_aa": len(current_codons),
                "has_start_codon": True,
                "has_stop_codon": False,
                "nucleotide_sequence": "".join(current_codons),
                "protein_sequence": "".join(aa_seq),
            })

    # Sort ORFs by length descending
    orfs.sort(key=lambda x: x['length_bp'], reverse=True)
    return orfs


def perform_exploratory_analysis(sequence: str, table_id: int = 1) -> Dict[str, Any]:
    val = validate_dna_sequence(sequence)
    if not val["is_valid"]:
        return {
            "validation": val,
            "composition": {},
            "homopolymers": [],
            "tandem_repeats": [],
            "orfs": [],
            "reading_frames": [],
            "anomalies": val["errors"],
            "limitations_notice": "Sequence could not be analyzed due to validation errors."
        }

    clean_seq = val["cleaned_sequence"]
    length = len(clean_seq)

    # Nucleotide composition
    counts = {
        'A': clean_seq.count('A'),
        'T': clean_seq.count('T'),
        'G': clean_seq.count('G'),
        'C': clean_seq.count('C'),
    }
    percentages = {b: round((counts[b] / length) * 100, 1) for b in counts}

    homopolymers = find_homopolymers(clean_seq)
    tandem_repeats = find_tandem_repeats(clean_seq)
    orfs = find_open_reading_frames(clean_seq, table_id)

    # Frame translations
    reading_frames = []
    for f in (0, 1, 2):
        codons = translate_dna(clean_seq, table_id, reading_frame=f)
        stops = [c for c in codons if c['is_stop']]
        has_internal_stop = any(c['is_stop'] and c['index'] < len(codons) for c in codons)
        reading_frames.append({
            "frame_label": f"+{f + 1}",
            "frame_index": f,
            "codons": codons,
            "codon_count": len(codons),
            "stop_count": len(stops),
            "has_internal_stop": has_internal_stop,
            "protein_string": "".join(c['amino_acid']['code1'] for c in codons),
        })

    anomalies: List[str] = []
    if length % 3 != 0:
        anomalies.append(f"Incomplete reading frame: Sequence length ({length} bp) has {length % 3} un-paired trailing nucleotide(s).")
    if not clean_seq.startswith('ATG'):
        anomalies.append("No canonical Methionine initiator codon (ATG) at position 1.")
    if clean_seq.endswith('TAA') or clean_seq.endswith('TAG') or clean_seq.endswith('TGA'):
        pass
    else:
        anomalies.append("No standard termination codon (TAA, TAG, TGA) at 3' terminus.")
    if homopolymers:
        anomalies.append(f"Contains {len(homopolymers)} homopolymer stretch(es) >= 4 bp; potential sequencing error or structural motif hotspot.")
    if tandem_repeats:
        anomalies.append(f"Contains {len(tandem_repeats)} tandem repeat motif(s). Note: Repeated nucleotide patterns are structural features, not inherently pathogenic mutations.")

    limitations_notice = (
        "Exploratory mode evaluated sequence in isolation without an authoritative reference. "
        "Sequence anomalies, structural motifs, and candidate ORFs are descriptive computational observations. "
        "No verified biological mutation or clinical consequence can be asserted without reference confirmation or experimental validation."
    )

    return {
        "validation": val,
        "composition": {
            "counts": counts,
            "percentages": percentages,
            "gc_percent": val["gc_percent"],
            "at_percent": val["at_percent"],
            "gc_ratio": round((counts['G'] + counts['C']) / max(counts['A'] + counts['T'], 1), 2),
        },
        "homopolymers": homopolymers,
        "tandem_repeats": tandem_repeats,
        "orfs": orfs,
        "reading_frames": reading_frames,
        "anomalies": anomalies,
        "limitations_notice": limitations_notice,
    }


# ==============================================================================
# INTELLIGENT CANDIDATE CORRECTION & RANKING ENGINE
# ==============================================================================

def generate_correction_candidates(
    ref_seq: Optional[str],
    obs_seq: str,
    reading_frame: int = 0,
    constraints: Optional[Dict[str, Any]] = None,
    table_id: int = 1
) -> Dict[str, Any]:
    """
    Generates and ranks biologically plausible sequence correction candidates across:
    1. Reference Restoration (reverting observed differences)
    2. Protein-Preserving Synonymous Alternatives
    3. Constraint-Based Sequence Optimization
    """
    clean_obs = obs_seq.strip().upper()
    val_obs = validate_dna_sequence(clean_obs)
    if not val_obs["is_valid"]:
        return {"candidates": [], "message": "Observed sequence is invalid.", "strategies_used": []}

    constraints = constraints or {}
    target_gc_min = float(constraints.get("target_gc_min", 40.0))
    target_gc_max = float(constraints.get("target_gc_max", 60.0))
    preserve_protein = bool(constraints.get("preserve_protein", True))
    avoid_premature_stops = bool(constraints.get("avoid_premature_stops", True))

    table = CodonTable.unambiguous_dna_by_id[table_id]
    candidates: List[Dict[str, Any]] = []
    strategies_used: List[str] = []

    # Helper: translation of sequence in frame
    def get_protein(seq: str) -> str:
        codons = [seq[reading_frame + i * 3:reading_frame + (i + 1) * 3]
                  for i in range((len(seq) - reading_frame) // 3)]
        return "".join('*' if c in table.stop_codons else table.forward_table.get(c, '?')
                       for c in codons)

    obs_protein = get_protein(clean_obs)
    obs_gc = val_obs["gc_percent"]

    # --------------------------------------------------------------------------
    # STRATEGY A: REFERENCE RESTORATION
    # --------------------------------------------------------------------------
    if ref_seq:
        clean_ref = ref_seq.strip().upper()
        val_ref = validate_dna_sequence(clean_ref)
        if val_ref["is_valid"] and clean_ref != clean_obs:
            strategies_used.append("Reference Restoration")
            diff_res = perform_pairwise_alignment(clean_ref, clean_obs, reading_frame, table_id)
            mutations = diff_res.get("mutations", [])

            # Comprehensive restoration candidate (full restore)
            ref_protein = get_protein(clean_ref)
            ref_gc = val_ref["gc_percent"]
            
            # Edit descriptions
            edit_descs = [f"Revert pos {m['reference_position']}: {m['observed_base']} -> {m['original_base']}"
                          for m in mutations]
            
            candidates.append({
                "candidate_id": "cand_ref_full",
                "title": "Full Reference Restoration",
                "strategy": "Reference Restoration",
                "sequence": clean_ref,
                "edits_count": len(mutations),
                "edits_detail": edit_descs,
                "resulting_gc_percent": ref_gc,
                "gc_delta": round(ref_gc - obs_gc, 1),
                "protein_sequence": ref_protein,
                "protein_preserved": ref_protein == obs_protein,
                "premature_stop_detected": '*' in ref_protein[:-1] if ref_protein else False,
                "constraint_violations": [],
                "score": 98.0,
                "rationale": "Restores the observed sequence to match the user-supplied reference sequence.",
                "scientific_limitation": "Assumes the supplied reference represents the intended wild-type biological state.",
            })

            # Discrete single-edit restorations if multiple mutations exist
            if len(mutations) > 1:
                for idx_m, m in enumerate(mutations):
                    if m["type"] == "substitution":
                        p = m["reference_position"]
                        orig_b = m["original_base"]
                        # Restore just this one base
                        single_restored = clean_obs[:p - 1] + orig_b + clean_obs[p:]
                        s_prot = get_protein(single_restored)
                        s_gc = round(gc_fraction(Seq(single_restored)) * 100, 1)

                        candidates.append({
                            "candidate_id": f"cand_ref_step_{idx_m + 1}",
                            "title": f"Single Restoration: Pos {p} ({m['observed_base']} -> {orig_b})",
                            "strategy": "Reference Restoration (Targeted)",
                            "sequence": single_restored,
                            "edits_count": 1,
                            "edits_detail": [f"Revert pos {p}: {m['observed_base']} -> {orig_b}"],
                            "resulting_gc_percent": s_gc,
                            "gc_delta": round(s_gc - obs_gc, 1),
                            "protein_sequence": s_prot,
                            "protein_preserved": s_prot == ref_protein,
                            "premature_stop_detected": '*' in s_prot[:-1] if s_prot else False,
                            "constraint_violations": [],
                            "score": 92.0 - (idx_m * 2),
                            "rationale": f"Isolates correction of {m['observed_base']} to {orig_b} at locus {p}.",
                            "scientific_limitation": "Corrects only this individual locus while leaving remaining loci altered.",
                        })

    # --------------------------------------------------------------------------
    # STRATEGY B: PROTEIN-PRESERVING SYNONYMOUS ALTERNATIVES
    # --------------------------------------------------------------------------
    strategies_used.append("Protein-Preserving Synonymous Selection")
    # Invert forward table to find all synonymous codons per amino acid
    synonymous_map: Dict[str, List[str]] = {}
    for cod, aa in table.forward_table.items():
        synonymous_map.setdefault(aa, []).append(cod)

    # Inspect codons in observed sequence
    obs_codons = [clean_obs[reading_frame + i * 3:reading_frame + (i + 1) * 3]
                  for i in range((len(clean_obs) - reading_frame) // 3)]

    syn_candidates_count = 0
    for c_idx, current_codon in enumerate(obs_codons):
        if syn_candidates_count >= 3:
            break
        if current_codon in table.stop_codons:
            continue
        aa = table.forward_table.get(current_codon)
        if not aa:
            continue
        alternatives = [c for c in synonymous_map.get(aa, []) if c != current_codon]
        for alt in alternatives:
            # Generate candidate sequence with this synonymous replacement
            start_idx = reading_frame + c_idx * 3
            cand_seq = clean_obs[:start_idx] + alt + clean_obs[start_idx + 3:]
            cand_gc = round(gc_fraction(Seq(cand_seq)) * 100, 1)
            cand_prot = get_protein(cand_seq)

            # Evaluate GC optimization
            is_gc_improvement = abs(cand_gc - 50.0) < abs(obs_gc - 50.0)
            score = 85.0 + (5.0 if is_gc_improvement else 0.0)

            candidates.append({
                "candidate_id": f"cand_syn_{c_idx + 1}_{alt}",
                "title": f"Synonymous Alternative: Codon {c_idx + 1} ({current_codon} -> {alt})",
                "strategy": "Protein-Preserving Alternative",
                "sequence": cand_seq,
                "edits_count": sum(1 for a, b in zip(current_codon, alt) if a != b),
                "edits_detail": [f"Substitute codon {c_idx + 1} at pos {start_idx + 1}: {current_codon} -> {alt} (both encode {AMINO_ACID_METADATA.get(aa, {}).get('name', aa)})"],
                "resulting_gc_percent": cand_gc,
                "gc_delta": round(cand_gc - obs_gc, 1),
                "protein_sequence": cand_prot,
                "protein_preserved": True,
                "premature_stop_detected": False,
                "constraint_violations": [],
                "score": score,
                "rationale": f"Replaces codon {current_codon} with synonymous triplet {alt}, preserving translated polypeptide 100%.",
                "scientific_limitation": "Synonymous codons may exhibit species-specific codon bias; does not imply biological superiority.",
            })
            syn_candidates_count += 1
            if syn_candidates_count >= 3:
                break

    # --------------------------------------------------------------------------
    # STRATEGY C: CONSTRAINT-BASED SEQUENCE OPTIMIZATION
    # --------------------------------------------------------------------------
    strategies_used.append("Constraint-Based Sequence Optimization")
    for cand in candidates:
        violations = []
        c_gc = cand["resulting_gc_percent"]
        if c_gc < target_gc_min or c_gc > target_gc_max:
            violations.append(f"GC content ({c_gc}%) falls outside target window [{target_gc_min}%, {target_gc_max}%]")
        if preserve_protein and not cand["protein_preserved"]:
            violations.append("Alters primary polypeptide translation")
        if avoid_premature_stops and cand["premature_stop_detected"]:
            violations.append("Contains premature termination codon (truncation hazard)")

        cand["constraint_violations"] = violations
        # Score deduction for violations
        cand["score"] = max(10.0, cand["score"] - len(violations) * 25.0)

    # Sort descending by score
    candidates.sort(key=lambda x: x["score"], reverse=True)

    return {
        "observed_sequence": clean_obs,
        "reference_sequence": ref_seq,
        "reading_frame": f"+{reading_frame + 1}",
        "total_candidates": len(candidates),
        "strategies_used": list(set(strategies_used)),
        "candidates": candidates,
        "safeguards_notice": (
            "Caution: Candidate sequences are theoretical computational proposals. "
            "Never implement sequence alterations without explicit biological verification and reference alignment."
        )
    }


# ==============================================================================
# MODE D: VIRTUAL MUTATION LAB EDUCATIONAL ANALYSIS ENGINE
# ==============================================================================

MAX_EDUCATIONAL_SEQ_LENGTH = 10000


def analyze_mutation_experiment(
    reference_seq: str,
    variant_seq: str,
    prediction: Optional[Dict[str, Any]] = None,
    reading_frame: int = 0,
    table_id: int = 1,
) -> Dict[str, Any]:
    """
    BioCrystal Virtual Mutation Lab educational engine.
    Analyzes how changes in a declared 5' -> 3' protein-coding DNA sequence
    alter codon triplet grouping, stop codon placement, and translation product.
    NCBI Standard Genetic Code (Table 1), Frame 0 educational assumptions.
    """
    ref_val = validate_dna_sequence(reference_seq)
    var_val = validate_dna_sequence(variant_seq)

    errors: List[str] = []
    if not ref_val["is_valid"]:
        errors.append(f"Reference sequence invalid: {', '.join(ref_val['errors'])}")
    if not var_val["is_valid"]:
        errors.append(f"Variant sequence invalid: {', '.join(var_val['errors'])}")

    if ref_val["length"] > MAX_EDUCATIONAL_SEQ_LENGTH:
        errors.append(f"Reference sequence length ({ref_val['length']} bp) exceeds maximum supported limit ({MAX_EDUCATIONAL_SEQ_LENGTH} bp).")
    if var_val["length"] > MAX_EDUCATIONAL_SEQ_LENGTH:
        errors.append(f"Variant sequence length ({var_val['length']} bp) exceeds maximum supported limit ({MAX_EDUCATIONAL_SEQ_LENGTH} bp).")

    if errors:
        return {
            "success": False,
            "errors": errors,
            "reference_validation": ref_val,
            "variant_validation": var_val,
        }

    clean_ref = ref_val["cleaned_sequence"]
    clean_var = var_val["cleaned_sequence"]
    table = CodonTable.unambiguous_dna_by_id[table_id]

    # Codon decomposition for reference
    ref_frame_seq = clean_ref[reading_frame:]
    ref_codon_count = len(ref_frame_seq) // 3
    ref_codons: List[str] = [ref_frame_seq[i * 3: (i + 1) * 3] for i in range(ref_codon_count)]
    ref_trailing_len = len(ref_frame_seq) % 3
    ref_trailing_bases = ref_frame_seq[-ref_trailing_len:] if ref_trailing_len > 0 else ""

    # Codon decomposition for variant
    var_frame_seq = clean_var[reading_frame:]
    var_codon_count = len(var_frame_seq) // 3
    var_codons: List[str] = [var_frame_seq[i * 3: (i + 1) * 3] for i in range(var_codon_count)]
    var_trailing_len = len(var_frame_seq) % 3
    var_trailing_bases = var_frame_seq[-var_trailing_len:] if var_trailing_len > 0 else ""

    # Full codon-by-codon translation strings
    def translate_triplets(triplets: List[str]) -> Tuple[str, List[Dict[str, Any]]]:
        aa_chars = []
        details = []
        for idx, tri in enumerate(triplets):
            if tri in table.stop_codons:
                aa = '*'
            else:
                aa = table.forward_table.get(tri, '?')
            aa_chars.append(aa)
            meta = AMINO_ACID_METADATA.get(aa, AMINO_ACID_METADATA['?'])
            details.append({
                "codon_index": idx + 1,
                "triplet": tri,
                "amino_acid_code1": aa,
                "amino_acid_code3": meta["code3"],
                "amino_acid_name": meta["name"],
                "is_stop": tri in table.stop_codons,
                "is_start": tri == "ATG",
            })
        return "".join(aa_chars), details

    ref_translation_str, ref_codon_details = translate_triplets(ref_codons)
    var_translation_str, var_codon_details = translate_triplets(var_codons)

    # Educational protein product (stops at first in-frame stop '*')
    def get_protein_product(trans_str: str) -> Tuple[str, Optional[int]]:
        stop_idx = trans_str.find('*')
        if stop_idx != -1:
            return trans_str[:stop_idx], stop_idx + 1  # 1-based stop codon position
        return trans_str, None

    ref_protein_product, ref_first_stop = get_protein_product(ref_translation_str)
    var_protein_product, var_first_stop = get_protein_product(var_translation_str)

    # Detect first affected codon
    first_affected_codon: Optional[int] = None
    min_codons = min(ref_codon_count, var_codon_count)
    for c_idx in range(min_codons):
        if ref_codons[c_idx] != var_codons[c_idx]:
            first_affected_codon = c_idx + 1
            break
    if first_affected_codon is None and ref_codon_count != var_codon_count:
        first_affected_codon = min_codons + 1

    # Scientific notes collection
    notes: List[str] = [
        "Educational translation assumes 5' -> 3' coding strand, fixed reading frame 0, and standard genetic code (NCBI Table 1).",
    ]

    start_codon_changed = False
    if clean_ref.startswith("ATG") and not clean_var.startswith("ATG"):
        start_codon_changed = True
        notes.append("The starting codon has changed. Fixed-frame translation is shown, but biological initiation is not modeled.")

    if var_first_stop is None:
        notes.append("No in-frame stop codon occurs within the supplied sequence.")
    elif var_first_stop < var_codon_count:
        notes.append("Sequence beyond the first stop codon is not part of this translated product.")

    if var_trailing_bases:
        notes.append(f"Trailing incomplete codon (+{len(var_trailing_bases)} nt: {var_trailing_bases}) is not translated into an amino acid.")

    # Classify mutation category
    category: str = "unchanged"
    category_label: str = "Unchanged"
    explanation: str = "The variant sequence is identical to the reference sequence. No mutation detected."
    reflection_question: str = "What happens if a mutation occurs in an untranslated region versus a coding region?"
    reflection_model_answer: str = "Mutations in coding regions can change amino acid sequences or stop codons, whereas non-coding mutations may affect regulatory signals without directly altering peptide sequence."

    len_diff = len(clean_var) - len(clean_ref)

    if clean_ref == clean_var:
        category = "unchanged"
        category_label = "Unchanged"
        explanation = "The variant sequence is identical to the reference sequence."
    elif len_diff != 0:
        # Indel: insertion or deletion
        if len_diff % 3 == 0:
            if len_diff > 0:
                category = "inframe_indel"
                category_label = f"In-frame Insertion (+{len_diff // 3} AA)"
                explanation = f"A complete number of codons (+{len_diff // 3} triplet(s)) was inserted. The downstream reading frame is preserved."
            else:
                del_count = abs(len_diff) // 3
                category = "inframe_indel"
                category_label = f"In-frame Deletion (-{del_count} AA)"
                explanation = f"A complete number of codons was removed ({del_count} triplet(s)). The downstream reading frame is preserved."
            reflection_question = "How is an in-frame three-base deletion biologically different from a single-base deletion in a coding frame?"
            reflection_model_answer = "Removing 3 nucleotides (1 full codon) keeps all following codons in their original reading frame, losing only 1 amino acid. A 1-base deletion shifts the reading frame for all downstream codons."
        else:
            category = "frameshift"
            category_label = f"Frameshift ({'+' if len_diff > 0 else ''}{len_diff} bp)"
            explanation = "This insertion or deletion changes the grouping of downstream bases into codons in the selected reading frame."
            reflection_question = "Why did deleting or inserting a number of bases not divisible by three affect downstream codons?"
            reflection_model_answer = "Because codons are read in continuous triplets, adding or removing 1 or 2 bases shifts the 3-base window, causing every subsequent codon to be read out of its original frame."
    else:
        # Same length: Substitution(s)
        mismatches = sum(1 for r, v in zip(clean_ref, clean_var) if r != v)
        if mismatches == 1:
            if ref_translation_str == var_translation_str:
                category = "synonymous"
                category_label = "Synonymous (Silent)"
                explanation = "The DNA changed, but this codon still specifies the same amino acid under the selected genetic code."
                reflection_question = "Why did the DNA change without changing the amino acid?"
                reflection_model_answer = "The genetic code is degenerate (redundant): multiple distinct 3-base codons can encode the exact same amino acid (e.g. GCT and GCC both encode Alanine)."
            elif var_first_stop is not None and (ref_first_stop is None or var_first_stop < ref_first_stop):
                category = "stop_gained"
                category_label = "Stop-gained (Nonsense)"
                explanation = "The edit introduces an earlier stop codon in this reading frame. The displayed translated product ends earlier."
                reflection_question = "Why does an earlier stop codon shorten this translated product?"
                reflection_model_answer = "During ribosome translation, a stop codon signals release factors to terminate peptide synthesis, leaving the protein truncated before the rest of the mRNA can be translated."
            elif ref_first_stop is not None and (var_first_stop is None or var_first_stop > ref_first_stop):
                category = "stop_lost"
                category_label = "Stop-lost (Readthrough)"
                explanation = "The edit alters the original termination codon, allowing translation to continue through downstream sequence."
                reflection_question = "What happens to a protein when a natural stop codon is mutated into an amino acid codon?"
                reflection_model_answer = "Translation continues past the normal termination site until another in-frame stop codon is encountered, adding extra amino acids to the C-terminus."
            elif start_codon_changed:
                category = "start_loss"
                category_label = "Start-codon change"
                explanation = "The starting codon has changed. Fixed-frame translation is shown, but biological initiation is not modeled."
                reflection_question = "Why is the ATG start codon critical for protein synthesis in living cells?"
                reflection_model_answer = "ATG specifies Methionine and provides the canonical initiation signal that establishes the reading frame on the ribosome."
            else:
                category = "missense"
                category_label = "Missense (Amino-acid replacement)"
                explanation = "The changed codon specifies a different amino acid. This calculation alone does not establish an effect on protein function."
                reflection_question = "Why does changing an amino acid sometimes alter protein behavior and sometimes have little effect?"
                reflection_model_answer = "It depends on where the amino acid is located in the folded structure (e.g. active site vs surface) and how different its chemical properties (charge, size, hydrophobicity) are from the original."
        else:
            # Multiple substitutions
            if ref_translation_str == var_translation_str:
                category = "synonymous"
                category_label = "Multiple Synonymous Substitutions"
                explanation = "Multiple nucleotide substitutions occurred, but all codons continue to encode the same amino acids."
            else:
                category = "complex_substitutions"
                category_label = f"Multiple Substitutions ({mismatches} bp)"
                explanation = f"Detected {mismatches} nucleotide substitutions between reference and variant."
                reflection_question = "How do multiple mutations interact in a single coding sequence?"
                reflection_model_answer = "Multiple mutations can combine their effects, sometimes altering several residue positions simultaneously."

    # Prediction evaluation (if student provided prediction)
    # Typed prediction choices:
    # 'no_change'       -> No amino-acid change
    # 'one_aa_change'   -> One amino acid is replaced
    # 'early_stop'      -> Translation stops earlier
    # 'frameshift'      -> The downstream reading frame changes
    # 'inframe_indel'   -> Amino acids are added or removed without shifting the downstream frame
    # 'not_sure'        -> Not sure
    prediction_result: Optional[Dict[str, Any]] = None
    if prediction:
        choice = str(prediction.get("choice", "")).strip().lower()
        rationale = prediction.get("rationale", "")

        matched: Optional[bool] = None
        status: str = "not_evaluated"
        feedback: str = ""

        choice_labels = {
            "no_change": "No amino-acid change",
            "one_aa_change": "One amino acid is replaced",
            "early_stop": "Translation stops earlier",
            "frameshift": "The downstream reading frame changes",
            "inframe_indel": "Amino acids are added or removed without shifting the downstream frame",
            "not_sure": "Not sure",
        }
        choice_label = choice_labels.get(choice, choice)

        if choice in ("no_change", "no amino-acid change", "synonymous"):
            if category in ("synonymous", "unchanged"):
                matched = True
                status = "correct"
                feedback = "Correct! Your prediction matched: the nucleotide change did not alter the amino acid sequence because of codon degeneracy."
            else:
                matched = False
                status = "diverged"
                feedback = f"Your prediction was 'No amino-acid change', but the experiment resulted in {category_label}."
        elif choice in ("one_aa_change", "missense", "one amino acid changes", "one amino acid is replaced"):
            if category == "missense":
                matched = True
                status = "correct"
                feedback = f"Correct! Your prediction matched: codon {first_affected_codon} was altered to specify a different amino acid."
            else:
                matched = False
                status = "diverged"
                feedback = f"Your prediction was 'One amino acid is replaced', but the experiment resulted in {category_label}."
        elif choice in ("early_stop", "translation stops earlier", "stop_gained"):
            if category == "stop_gained":
                matched = True
                status = "correct"
                feedback = f"Correct! Your prediction matched: a premature stop codon was introduced at codon {var_first_stop}, truncating the translated product."
            else:
                matched = False
                status = "diverged"
                feedback = f"Your prediction was 'Translation stops earlier', but the experiment resulted in {category_label}."
        elif choice in ("frameshift", "the reading frame changes", "the downstream reading frame changes"):
            if category == "frameshift":
                matched = True
                status = "correct"
                feedback = "Correct! Your prediction matched: the insertion/deletion length was not divisible by 3, altering downstream codon groupings."
            else:
                matched = False
                status = "diverged"
                feedback = f"Your prediction was 'The downstream reading frame changes', but the experiment resulted in {category_label}."
        elif choice in ("inframe_indel", "amino acids are added or removed without shifting the downstream frame", "inframe_deletion", "inframe_insertion"):
            if category == "inframe_indel":
                matched = True
                status = "correct"
                feedback = "Correct! Your prediction matched: a complete number of codons was added or removed without altering the downstream reading frame."
            else:
                matched = False
                status = "diverged"
                feedback = f"Your prediction was 'Amino acids are added or removed without shifting the downstream frame', but the experiment resulted in {category_label}."
        elif choice in ("not_sure", "not sure"):
            matched = None
            status = "not_sure"
            feedback = f"Exploring without a prior hypothesis: This experiment resulted in {category_label}."
        else:
            matched = None
            status = "not_evaluated"
            feedback = f"Unrestricted edit: The observed outcome is {category_label}."

        prediction_result = {
            "choice": choice,
            "choice_label": choice_label,
            "rationale": rationale,
            "matched": matched,
            "status": status,
            "feedback": feedback,
        }

    return {
        "success": True,
        "reference_sequence": clean_ref,
        "variant_sequence": clean_var,
        "reading_frame": reading_frame,
        "genetic_code": "NCBI Standard (Table 1)",
        "reference_length": len(clean_ref),
        "variant_length": len(clean_var),
        "reference_codons": ref_codons,
        "variant_codons": var_codons,
        "reference_codon_count": ref_codon_count,
        "variant_codon_count": var_codon_count,
        "reference_trailing_bases": ref_trailing_bases,
        "variant_trailing_bases": var_trailing_bases,
        "reference_translation": ref_translation_str,
        "variant_translation": var_translation_str,
        "reference_protein_product": ref_protein_product,
        "variant_protein_product": var_protein_product,
        "reference_first_stop_position": ref_first_stop,
        "variant_first_stop_position": var_first_stop,
        "first_affected_codon": first_affected_codon,
        "start_codon_changed": start_codon_changed,
        "mutation_category": category,
        "category_label": category_label,
        "explanation": explanation,
        "notes": notes,
        "prediction_evaluation": prediction_result,
        "reflection": {
            "question": reflection_question,
            "model_answer": reflection_model_answer,
        },
        "codon_comparison": [
            {
                "codon_index": i + 1,
                "ref_codon": ref_codons[i] if i < ref_codon_count else "-",
                "var_codon": var_codons[i] if i < var_codon_count else "-",
                "ref_aa": ref_codon_details[i]["amino_acid_code1"] if i < ref_codon_count else "-",
                "var_aa": var_codon_details[i]["amino_acid_code1"] if i < var_codon_count else "-",
                "is_changed": (
                    i >= ref_codon_count
                    or i >= var_codon_count
                    or ref_codons[i] != var_codons[i]
                ),
            }
            for i in range(max(ref_codon_count, var_codon_count))
        ],
    }


def parse_fasta_content(fasta_text: str) -> Dict[str, Any]:
    """
    Parses FASTA formatted text containing DNA sequences.
    Accepts standard FASTA:
      - Ignores lines beginning with '>'
      - Reads sequence lines below header
      - Removes whitespace, line breaks, carriage returns
      - Converts lowercase nucleotides to uppercase
      - Validates that sequence contains only A, T, G, C, and optional N characters
    Supports single or multiple sequences.
    """
    if not fasta_text or not fasta_text.strip():
        return {
            "valid": False,
            "count": 0,
            "sequences": [],
            "error": "Invalid FASTA format. Please upload a valid DNA FASTA file.",
        }

    lines = fasta_text.splitlines()
    if not any(line.strip().startswith(">") for line in lines):
        return {
            "valid": False,
            "count": 0,
            "sequences": [],
            "error": "Invalid FASTA format. Please upload a valid DNA FASTA file.",
        }

    entries: List[Dict[str, Any]] = []
    current_header: Optional[str] = None
    current_seq_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(">"):
            if current_header is not None or current_seq_lines:
                raw_seq = "".join(current_seq_lines).replace(" ", "").replace("\t", "").replace("\r", "").upper()
                entries.append({
                    "header": current_header or "Unnamed sequence",
                    "sequence": raw_seq,
                })
                current_seq_lines = []
            current_header = stripped[1:].strip()
        else:
            current_seq_lines.append(stripped)

    # Append last entry
    if current_header is not None or current_seq_lines:
        raw_seq = "".join(current_seq_lines).replace(" ", "").replace("\t", "").replace("\r", "").upper()
        entries.append({
            "header": current_header or "Unnamed sequence",
            "sequence": raw_seq,
        })

    if not entries:
        return {
            "valid": False,
            "count": 0,
            "sequences": [],
            "error": "Invalid FASTA format. Please upload a valid DNA FASTA file.",
        }

    parsed_sequences: List[Dict[str, Any]] = []
    valid_dna_pattern = re.compile(r"^[ATGCN]+$")

    for idx, entry in enumerate(entries):
        seq = entry["sequence"]
        header = entry["header"]
        if not seq or not valid_dna_pattern.match(seq):
            return {
                "valid": False,
                "count": 0,
                "sequences": [],
                "error": "Invalid FASTA format. Please upload a valid DNA FASTA file.",
            }

        # Calculate GC percentage
        gc_count = seq.count("G") + seq.count("C")
        gc_pct = round((gc_count / len(seq)) * 100.0, 1) if seq else 0.0
        seq_id = header.split()[0] if header else f"seq_{idx + 1}"

        parsed_sequences.append({
            "id": seq_id,
            "header": header,
            "sequence": seq,
            "length": len(seq),
            "gc_percent": gc_pct,
        })

    return {
        "valid": True,
        "count": len(parsed_sequences),
        "sequences": parsed_sequences,
        "error": None,
    }


def compute_protein_biochemical_telemetry(protein_seq: str) -> Dict[str, Any]:
    """
    Computes molecular mass (Da), Kyte-Doolittle GRAVY hydropathy score,
    and net charge for a polypeptide sequence.
    """
    clean_prot = protein_seq.replace("*", "").replace("?", "").strip()
    if not clean_prot:
        return {"mass_da": 0.0, "gravy": 0.0, "net_charge": 0.0, "length": 0}

    total_mass = 18.015  # Terminal H2O
    total_hydro = 0.0
    total_charge = 0.0

    for aa in clean_prot:
        meta = AMINO_ACID_METADATA.get(aa, AMINO_ACID_METADATA['?'])
        mw = meta.get("mw", 110.0)
        if mw > 0:
            total_mass += (mw - 18.015)
        total_hydro += meta.get("hydropathy", 0.0)
        total_charge += meta.get("charge", 0.0)

    gravy = round(total_hydro / len(clean_prot), 2)
    return {
        "mass_da": round(total_mass, 1),
        "gravy": gravy,
        "net_charge": round(total_charge, 1),
        "length": len(clean_prot),
    }


def generate_mutation_impact_summary(
    mutations: List[Dict[str, Any]],
    reference_seq: str,
    variant_seq: str,
    structure_mapping: Optional[Dict[str, Any]] = None,
    gene: Optional[str] = None,
    is_coding: bool = True,
    reading_frame: int = 0,
    table_id: int = 1,
) -> Dict[str, Any]:
    """
    Constructs a structured mutation impact summary for every detected sequence variation.
    Reports mutation notation, codon position, codon change, amino-acid change, consequence,
    premature stop status, protein length impact, PDB availability, and a concise primary interpretation sentence.
    """
    pdb_avail = bool(structure_mapping and structure_mapping.get("mapped"))
    actual_pdb_id = structure_mapping.get("pdb_id") if (pdb_avail and structure_mapping.get("pdb_id")) else None

    if pdb_avail and actual_pdb_id:
        provenance_str = f"Experimentally determined Protein Data Bank (PDB) structure (PDB ID: {actual_pdb_id})."
    else:
        provenance_str = "No experimentally determined PDB structure available; canonical B-DNA model generated from input sequence."

    if not mutations:
        primary_interp = (
            "Primary interpretation: No sequence alterations detected. Variant sequence is identical to reference sequence. "
            "Canonical B-DNA analysis is shown."
        )
        return {
            "has_mutations": False,
            "total_mutations": 0,
            "primary_interpretation": primary_interp,
            "items": [],
        }

    items: List[Dict[str, Any]] = []

    # Get translated protein products if coding
    ref_protein = ""
    var_protein = ""
    if is_coding:
        try:
            ref_codons = translate_dna(reference_seq, reading_frame=reading_frame, table_id=table_id)
            var_codons = translate_dna(variant_seq, reading_frame=reading_frame, table_id=table_id)
            ref_protein = "".join(c["amino_acid"]["code1"] for c in ref_codons)
            var_protein = "".join(c["amino_acid"]["code1"] for c in var_codons)
        except Exception:
            pass

    for idx, mut in enumerate(mutations):
        mtype = mut.get("type", "substitution")
        cat = mut.get("category", "")
        ref_pos = mut.get("reference_position") or mut.get("observed_position", 1)
        orig_b = mut.get("original_base") or mut.get("reference_bases", "")
        obs_b = mut.get("observed_base") or mut.get("observed_bases", "")
        codon_idx = mut.get("affected_codon_index")

        # Notation
        if mtype == "substitution" and orig_b and obs_b:
            notation = f"c.{ref_pos}{orig_b}>{obs_b}"
        elif mtype == "insertion":
            notation = f"c.{ref_pos}_{ref_pos+1}ins{obs_b}" if obs_b else f"c.{ref_pos}ins"
        elif mtype == "deletion":
            notation = f"c.{ref_pos}del{orig_b}" if orig_b else f"c.{ref_pos}del"
        else:
            notation = f"{mtype} at {ref_pos}"

        # Codon change
        ref_codon = mut.get("reference_codon") or mut.get("original_codon")
        obs_codon = mut.get("observed_codon")
        if ref_codon and obs_codon:
            codon_change = f"{ref_codon} → {obs_codon}"
        else:
            codon_change = "—"

        # Amino acid change
        orig_aa = mut.get("original_amino_acid", {}) or {}
        obs_aa = mut.get("observed_amino_acid", {}) or {}
        orig_aa3 = orig_aa.get("code3") or orig_aa.get("name")
        obs_aa3 = obs_aa.get("code3") or obs_aa.get("name")

        if orig_aa3 and obs_aa3 and codon_idx:
            aa_change = f"p.{orig_aa3}{codon_idx}{obs_aa3}"
        elif orig_aa3 and obs_aa3:
            aa_change = f"{orig_aa3} → {obs_aa3}"
        else:
            aa_change = "—"

        # Consequence label
        if cat == "missense":
            consequence = "missense"
            consequence_label = "Missense"
        elif cat == "nonsense":
            consequence = "nonsense"
            consequence_label = "Nonsense"
        elif cat == "synonymous":
            consequence = "synonymous"
            consequence_label = "Synonymous"
        elif cat == "frameshift":
            consequence = "frameshift"
            consequence_label = "Frameshift"
        elif cat == "in_frame_indel":
            consequence = "in-frame indel"
            consequence_label = "In-frame Indel"
        elif not is_coding or cat == "non_coding":
            consequence = "no protein-level change"
            consequence_label = "Non-coding"
        else:
            consequence = cat or "sequence variant"
            consequence_label = consequence.replace("_", " ").capitalize()

        # Premature stop & length check
        is_premature_stop = (cat == "nonsense") or (obs_aa.get("code3") == "Stop" and orig_aa.get("code3") != "Stop")
        changes_len = False
        if is_coding and ref_protein and var_protein:
            changes_len = len(ref_protein.split("*")[0]) != len(var_protein.split("*")[0])
        elif mtype in ("insertion", "deletion", "frameshift", "in_frame_indel"):
            changes_len = True

        # Primary interpretation sentence
        orig_name = orig_aa.get("name") or orig_aa.get("code3") or "residue"
        obs_name = obs_aa.get("name") or obs_aa.get("code3") or "residue"

        if consequence == "missense" and codon_idx:
            interp = f"Missense mutation detected at codon {codon_idx}. The codon changes from {ref_codon} to {obs_codon}, altering the translated amino acid from {orig_name} to {obs_name}."
        elif consequence == "nonsense" and codon_idx:
            interp = f"Nonsense mutation detected at codon {codon_idx}. The codon changes from {ref_codon} to {obs_codon}, introducing a premature stop codon."
        elif consequence == "synonymous" and codon_idx:
            interp = f"Synonymous mutation detected at codon {codon_idx}. The codon changes from {ref_codon} to {obs_codon}, conserving the {orig_name} residue."
        elif consequence == "frameshift":
            interp = f"Frameshift mutation detected at position {ref_pos}, altering the downstream reading frame."
        else:
            interp = f"{consequence_label} mutation detected at position {ref_pos}."

        if pdb_avail and actual_pdb_id:
            interp += " An experimentally determined PDB structure is available for structural mapping."
        else:
            interp += " No experimentally determined PDB structure is available; sequence-level and canonical B-DNA analysis are shown."

        items.append({
            "index": idx + 1,
            "mutation_type": mtype,
            "mutation_notation": notation,
            "codon_position": codon_idx,
            "codon_change": codon_change,
            "amino_acid_change": aa_change,
            "consequence": consequence,
            "consequence_label": consequence_label,
            "creates_premature_stop": is_premature_stop,
            "changes_protein_length": changes_len,
            "pdb_available": pdb_avail,
            "pdb_id": actual_pdb_id,
            "structure_provenance": provenance_str,
            "primary_interpretation": f"Primary interpretation: {interp}",
        })

    first_item = items[0]
    overall_interp = first_item["primary_interpretation"]

    return {
        "has_mutations": True,
        "total_mutations": len(items),
        "primary_interpretation": overall_interp,
        "items": items,
    }


def compare_two_variants(
    reference_seq: str,
    variant_a_seq: str,
    variant_b_seq: str,
    variant_a_name: str = "Variant A",
    variant_b_name: str = "Variant B",
    gene: Optional[str] = None,
    pdb_id: Optional[str] = None,
    reading_frame: int = 0,
    table_id: int = 1,
    is_coding: bool = True,
) -> Dict[str, Any]:
    """
    Compares two variant sequences against the identical reference sequence.
    Runs alignment, mutation classification, protein consequence translation,
    and biophysical parameter determination independently for both variants.
    Returns comparison rows for all 13 required metrics and a concise comparison conclusion.
    """
    # 1. Align both variants
    aln_a = perform_pairwise_alignment(
        ref_seq=reference_seq,
        obs_seq=variant_a_seq,
        reading_frame=reading_frame,
        table_id=table_id,
        is_coding=is_coding,
    )
    aln_b = perform_pairwise_alignment(
        ref_seq=reference_seq,
        obs_seq=variant_b_seq,
        reading_frame=reading_frame,
        table_id=table_id,
        is_coding=is_coding,
    )

    # 2. Biophysical & GC/Tm profiles
    try:
        from dna_biophysics import compute_dna_biophysics
    except ImportError:
        from backend.dna_biophysics import compute_dna_biophysics

    bio_ref = compute_dna_biophysics(reference_seq, mutations=[])
    bio_a = compute_dna_biophysics(variant_a_seq, mutations=aln_a.get("mutations", []))
    bio_b = compute_dna_biophysics(variant_b_seq, mutations=aln_b.get("mutations", []))

    tm_ref = bio_ref["thermodynamics"]["melting_temperature_c"]
    gc_ref = bio_ref["spectroscopic_profile"]["gc_percent"]

    tm_a = bio_a["thermodynamics"]["melting_temperature_c"]
    gc_a = bio_a["spectroscopic_profile"]["gc_percent"]
    delta_tm_a = round(tm_a - tm_ref, 1)
    delta_gc_a = round(gc_a - gc_ref, 1)

    tm_b = bio_b["thermodynamics"]["melting_temperature_c"]
    gc_b = bio_b["spectroscopic_profile"]["gc_percent"]
    delta_tm_b = round(tm_b - tm_ref, 1)
    delta_gc_b = round(gc_b - gc_ref, 1)

    # 3. Protein telemetry
    ref_prot = ""
    prot_a = ""
    prot_b = ""
    if is_coding:
        try:
            ref_codons = translate_dna(reference_seq, reading_frame=reading_frame, table_id=table_id)
            codons_a = translate_dna(variant_a_seq, reading_frame=reading_frame, table_id=table_id)
            codons_b = translate_dna(variant_b_seq, reading_frame=reading_frame, table_id=table_id)
            ref_prot = "".join(c["amino_acid"]["code1"] for c in ref_codons).split("*")[0]
            prot_a = "".join(c["amino_acid"]["code1"] for c in codons_a).split("*")[0]
            prot_b = "".join(c["amino_acid"]["code1"] for c in codons_b).split("*")[0]
        except Exception:
            pass

    tele_ref = compute_protein_biochemical_telemetry(ref_prot)
    tele_a = compute_protein_biochemical_telemetry(prot_a)
    tele_b = compute_protein_biochemical_telemetry(prot_b)

    delta_mw_a = round(tele_a["mass_da"] - tele_ref["mass_da"], 1)
    delta_gravy_a = round(tele_a["gravy"] - tele_ref["gravy"], 2)
    delta_charge_a = round(tele_a["net_charge"] - tele_ref["net_charge"], 1)

    delta_mw_b = round(tele_b["mass_da"] - tele_ref["mass_da"], 1)
    delta_gravy_b = round(tele_b["gravy"] - tele_ref["gravy"], 2)
    delta_charge_b = round(tele_b["net_charge"] - tele_ref["net_charge"], 1)

    # 4. Structure mapping
    try:
        from structure_engine import map_mutations_to_structure
    except ImportError:
        from backend.structure_engine import map_mutations_to_structure

    smap_a = map_mutations_to_structure(
        gene=gene,
        pdb_id=pdb_id,
        mutations=aln_a.get("mutations", []),
        reference_sequence=reference_seq,
        is_coding=is_coding,
        reading_frame=reading_frame,
    )
    smap_b = map_mutations_to_structure(
        gene=gene,
        pdb_id=pdb_id,
        mutations=aln_b.get("mutations", []),
        reference_sequence=reference_seq,
        is_coding=is_coding,
        reading_frame=reading_frame,
    )

    impact_a = generate_mutation_impact_summary(
        mutations=aln_a.get("mutations", []),
        reference_seq=reference_seq,
        variant_seq=variant_a_seq,
        structure_mapping=smap_a,
        gene=gene,
        is_coding=is_coding,
        reading_frame=reading_frame,
        table_id=table_id,
    )
    impact_b = generate_mutation_impact_summary(
        mutations=aln_b.get("mutations", []),
        reference_seq=reference_seq,
        variant_seq=variant_b_seq,
        structure_mapping=smap_b,
        gene=gene,
        is_coding=is_coding,
        reading_frame=reading_frame,
        table_id=table_id,
    )

    item_a = impact_a["items"][0] if impact_a["items"] else {
        "mutation_type": "Wild-type",
        "mutation_notation": "None",
        "codon_change": "—",
        "amino_acid_change": "—",
        "consequence_label": "Identical",
        "primary_interpretation": impact_a["primary_interpretation"],
    }
    item_b = impact_b["items"][0] if impact_b["items"] else {
        "mutation_type": "Wild-type",
        "mutation_notation": "None",
        "codon_change": "—",
        "amino_acid_change": "—",
        "consequence_label": "Identical",
        "primary_interpretation": impact_b["primary_interpretation"],
    }

    pdb_avail_a = bool(smap_a.get("mapped"))
    pdb_id_a = smap_a.get("pdb_id") if pdb_avail_a else None
    pdb_label_a = f"Available ({pdb_id_a})" if pdb_avail_a and pdb_id_a else ("Available" if pdb_avail_a else "Unavailable")

    pdb_avail_b = bool(smap_b.get("mapped"))
    pdb_id_b = smap_b.get("pdb_id") if pdb_avail_b else None
    pdb_label_b = f"Available ({pdb_id_b})" if pdb_avail_b and pdb_id_b else ("Available" if pdb_avail_b else "Unavailable")

    # Format 13 metrics for Variant A & Variant B
    row_a = {
        "variant_label": variant_a_name,
        "mutation_type": item_a.get("mutation_type", "substitution"),
        "mutation_notation": item_a.get("mutation_notation", "—"),
        "codon_change": item_a.get("codon_change", "—"),
        "amino_acid_change": item_a.get("amino_acid_change", "—"),
        "mutation_consequence": item_a.get("consequence_label", "Missense"),
        "protein_mw_change": f"{delta_mw_a:+.1f} Da",
        "gravy_score_change": f"{delta_gravy_a:+.2f}",
        "net_charge_change": f"{delta_charge_a:+.1f}",
        "gc_content_change": f"{delta_gc_a:+.1f}%",
        "melting_temp_change": f"{delta_tm_a:+.1f}°C",
        "pdb_availability": pdb_label_a,
        "primary_interpretation": item_a.get("primary_interpretation", "").replace("Primary interpretation: ", ""),
    }

    row_b = {
        "variant_label": variant_b_name,
        "mutation_type": item_b.get("mutation_type", "substitution"),
        "mutation_notation": item_b.get("mutation_notation", "—"),
        "codon_change": item_b.get("codon_change", "—"),
        "amino_acid_change": item_b.get("amino_acid_change", "—"),
        "mutation_consequence": item_b.get("consequence_label", "Missense"),
        "protein_mw_change": f"{delta_mw_b:+.1f} Da",
        "gravy_score_change": f"{delta_gravy_b:+.2f}",
        "net_charge_change": f"{delta_charge_b:+.1f}",
        "gc_content_change": f"{delta_gc_b:+.1f}%",
        "melting_temp_change": f"{delta_tm_b:+.1f}°C",
        "pdb_availability": pdb_label_b,
        "primary_interpretation": item_b.get("primary_interpretation", "").replace("Primary interpretation: ", ""),
    }

    # Generate concise comparison conclusion
    conclusion_parts = []
    conseq_a = item_a.get("consequence_label", "").lower()
    conseq_b = item_b.get("consequence_label", "").lower()
    aa_a = item_a.get("amino_acid_change", "")
    aa_b = item_b.get("amino_acid_change", "")

    if conseq_a == conseq_b and conseq_a:
        conclusion_parts.append(f"Both variants are {conseq_a} mutations.")
    else:
        conclusion_parts.append(f"{variant_a_name} is a {conseq_a} mutation, while {variant_b_name} is a {conseq_b} mutation.")

    # Amino acid difference
    if aa_a and aa_b and aa_a != "—" and aa_b != "—":
        conclusion_parts.append(f"{variant_a_name} confers {aa_a}, while {variant_b_name} confers {aa_b}.")

    # PDB mapping status
    if pdb_avail_a and pdb_avail_b:
        conclusion_parts.append("Both variants can be mapped to available experimental PDB structures.")
    elif pdb_avail_a:
        conclusion_parts.append(f"Only {variant_a_name} maps to an experimental PDB structure.")
    elif pdb_avail_b:
        conclusion_parts.append(f"Only {variant_b_name} maps to an experimental PDB structure.")
    else:
        conclusion_parts.append("Neither variant has an experimental PDB structure available; canonical B-DNA conformations are modeled.")

    conclusion = " ".join(conclusion_parts)

    return {
        "reference_length": len(reference_seq),
        "gene": gene,
        "conclusion": conclusion,
        "variant_a": {
            "name": variant_a_name,
            "sequence": variant_a_seq,
            "alignment": aln_a,
            "impact_summary": impact_a,
            "telemetry": {
                "mw_delta": delta_mw_a,
                "gravy_delta": delta_gravy_a,
                "charge_delta": delta_charge_a,
                "gc_delta": delta_gc_a,
                "tm_delta": delta_tm_a,
            },
            "pdb_id": pdb_id_a,
            "pdb_available": pdb_avail_a,
        },
        "variant_b": {
            "name": variant_b_name,
            "sequence": variant_b_seq,
            "alignment": aln_b,
            "impact_summary": impact_b,
            "telemetry": {
                "mw_delta": delta_mw_b,
                "gravy_delta": delta_gravy_b,
                "charge_delta": delta_charge_b,
                "gc_delta": delta_gc_b,
                "tm_delta": delta_tm_b,
            },
            "pdb_id": pdb_id_b,
            "pdb_available": pdb_avail_b,
        },
        "rows": [row_a, row_b],
    }

