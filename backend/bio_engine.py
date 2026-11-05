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
    table_id: int = 1
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

            # Codon context in reference
            codon_idx = (curr_ref_pos - 1 - reading_frame) // 3
            codon_start = reading_frame + codon_idx * 3
            ref_codon = clean_ref[codon_start:codon_start + 3] if len(clean_ref) >= codon_start + 3 else None
            obs_codon = clean_obs[codon_start:codon_start + 3] if len(clean_obs) >= codon_start + 3 else None

            ref_aa = get_amino_acid_info(ref_codon, table_id)
            obs_aa = get_amino_acid_info(obs_codon, table_id)

            is_orig_purine = orig_base in ('A', 'G')
            is_mut_purine = new_base in ('A', 'G')
            is_trans = is_orig_purine == is_mut_purine

            if ref_aa['code3'] == obs_aa['code3']:
                category = "synonymous"
                category_label = "Synonymous (Silent)"
                desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} (codon {ref_codon} -> {obs_codon}) preserves amino acid {ref_aa['name']} ({ref_aa['code3']})."
            elif obs_aa['code3'] == 'Stop':
                category = "nonsense"
                category_label = "Nonsense (Stop-gain)"
                desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} generates a premature stop codon ({obs_codon}), terminating translation."
            elif ref_aa['code3'] == 'Stop' and obs_aa['code3'] != 'Stop':
                category = "stop_loss"
                category_label = "Stop-loss"
                desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} alters stop codon ({ref_codon} -> {obs_codon}), continuing translation."
            elif codon_idx == 0 and ref_codon == 'ATG' and obs_codon != 'ATG':
                category = "start_loss"
                category_label = "Start-loss"
                desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} alters initiator methionine codon (ATG -> {obs_codon})."
            else:
                category = "missense"
                category_label = "Missense"
                chem_shift = f"non-conservative ({ref_aa['category']} -> {obs_aa['category']})" if ref_aa['category'] != obs_aa['category'] else f"conservative ({ref_aa['category']})"
                desc = f"Substitution {orig_base}{curr_ref_pos}{new_base} alters codon {ref_codon} -> {obs_codon}, replacing {ref_aa['name']} with {obs_aa['name']} ({chem_shift})."

            mutations.append({
                "type": "substitution",
                "reference_position": curr_ref_pos,
                "observed_position": curr_obs_pos,
                "original_base": orig_base,
                "observed_base": new_base,
                "affected_codon_index": codon_idx + 1,
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

            if ins_len % 3 == 0:
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

            if del_len % 3 == 0:
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

    identity_pct = round((identical_matches / max(len(clean_ref), len(clean_obs), 1)) * 100, 1)

    return {
        "alignment_score": float(al.score),
        "identity_percent": identity_pct,
        "mutation_count": len(mutations),
        "mutations": mutations,
        "aligned_reference": aligned_ref,
        "aligned_observed": aligned_obs,
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
                "rationale": "Directly restores observed sequence to match the authoritative wild-type reference sequence.",
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
