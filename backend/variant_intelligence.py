"""
BioCrystal 3D — Variant Intelligence Engine
===========================================
Independent analytical layers for DNA comparison, coding and protein interpretation,
biochemical property tracking, genuine pretrained ESM masked-marginal scoring,
and spatial macromolecular structure neighborhood observations.

Strictly follows:
- Deterministic 1-based coordinates
- Multi-base changes in the same codon evaluated once
- NCBI Standard Genetic Code (Table 1)
- Kyte-Doolittle hydropathy, Grantham/Zamyatnin volume, monoisotopic residue mass
- Meta ESM-2 / ESM-1v masked-marginal log-probability ratio scoring
- 5 Å heavy-atom spatial structural neighborhood from Bio.PDB
- Clear layer statuses: available, not_applicable, unsupported_input, unavailable, failed
"""

from __future__ import annotations

import os
import sys
import re
import math
import hashlib
import threading
from io import StringIO
from typing import Any, Dict, List, Optional, Tuple

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from Bio import Align
from Bio.Data import CodonTable
from Bio.PDB import PDBParser
from Bio.PDB.PDBExceptions import PDBConstructionException

# -----------------------------------------------------------------------------
# 1. Documented Biochemical Metadata & Scales
# -----------------------------------------------------------------------------

# Kyte-Doolittle hydropathy scale (Kyte & Doolittle, J. Mol. Biol. 1982, 157:105-132)
KYTE_DOOLITTLE_HYDROPATHY: Dict[str, float] = {
    'I': 4.5, 'V': 4.2, 'L': 3.8, 'F': 2.8, 'C': 2.5, 'M': 1.9, 'A': 1.8,
    'G': -0.4, 'T': -0.7, 'S': -0.8, 'W': -0.9, 'Y': -1.3, 'P': -1.6,
    'H': -3.2, 'E': -3.5, 'Q': -3.5, 'D': -3.5, 'N': -3.5, 'K': -3.9, 'R': -4.5
}

# Monoisotopic residue molecular mass in Daltons (M_free - 18.0152 Da for H2O)
MONOISOTOPIC_RESIDUE_MASS: Dict[str, float] = {
    'G': 57.02, 'A': 71.04, 'S': 87.03, 'P': 97.05, 'V': 99.07, 'T': 101.05,
    'C': 103.01, 'I': 113.08, 'L': 113.08, 'N': 114.04, 'D': 115.03, 'Q': 128.06,
    'K': 128.09, 'E': 129.04, 'M': 131.04, 'H': 137.06, 'F': 147.07, 'R': 156.10,
    'Y': 163.06, 'W': 186.08
}

# Residue volume scale in Å³ (Grantham 1974 / Zamyatnin 1972)
RESIDUE_VOLUME_SCALE: Dict[str, float] = {
    'G': 60.1, 'A': 88.6, 'S': 89.0, 'C': 108.5, 'D': 111.1, 'P': 112.7,
    'T': 116.1, 'N': 114.1, 'V': 140.0, 'E': 138.4, 'Q': 143.8, 'H': 153.2,
    'M': 162.9, 'I': 166.7, 'L': 166.7, 'K': 168.6, 'R': 173.4, 'F': 189.9,
    'Y': 193.6, 'W': 227.8
}

# Side-chain charge category at physiological pH 7.4
# (Acidic = -1, Basic = +1, Histidine = +0.1 weak partial, Neutral = 0)
SIDECHAIN_CHARGE_PH74: Dict[str, float] = {
    'K': 1.0, 'R': 1.0, 'H': 0.1, 'D': -1.0, 'E': -1.0,
    'A': 0.0, 'C': 0.0, 'F': 0.0, 'G': 0.0, 'I': 0.0, 'L': 0.0, 'M': 0.0,
    'N': 0.0, 'P': 0.0, 'Q': 0.0, 'S': 0.0, 'T': 0.0, 'V': 0.0, 'W': 0.0, 'Y': 0.0
}

# Documented Polarity Category
POLARITY_CATEGORY: Dict[str, str] = {
    'A': 'nonpolar', 'V': 'nonpolar', 'I': 'nonpolar', 'L': 'nonpolar', 'M': 'nonpolar',
    'F': 'nonpolar', 'W': 'nonpolar', 'P': 'nonpolar', 'G': 'nonpolar',
    'S': 'polar_uncharged', 'T': 'polar_uncharged', 'C': 'polar_uncharged',
    'Y': 'polar_uncharged', 'N': 'polar_uncharged', 'Q': 'polar_uncharged',
    'K': 'basic_positive', 'R': 'basic_positive', 'H': 'basic_positive',
    'D': 'acidic_negative', 'E': 'acidic_negative'
}

# Aromaticity
AROMATIC_AMINO_ACIDS = {'F', 'Y', 'W', 'H'}

# Full Amino Acid Metadata
AMINO_ACID_TABLE: Dict[str, Dict[str, Any]] = {
    'A': {'code3': 'Ala', 'name': 'Alanine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 71.04, 'hydropathy': 1.8, 'volume': 88.6, 'aromatic': False},
    'R': {'code3': 'Arg', 'name': 'Arginine', 'polarity': 'basic_positive', 'charge': 1.0, 'mw_residue': 156.10, 'hydropathy': -4.5, 'volume': 173.4, 'aromatic': False},
    'N': {'code3': 'Asn', 'name': 'Asparagine', 'polarity': 'polar_uncharged', 'charge': 0.0, 'mw_residue': 114.04, 'hydropathy': -3.5, 'volume': 114.1, 'aromatic': False},
    'D': {'code3': 'Asp', 'name': 'Aspartic Acid', 'polarity': 'acidic_negative', 'charge': -1.0, 'mw_residue': 115.03, 'hydropathy': -3.5, 'volume': 111.1, 'aromatic': False},
    'C': {'code3': 'Cys', 'name': 'Cysteine', 'polarity': 'polar_uncharged', 'charge': 0.0, 'mw_residue': 103.01, 'hydropathy': 2.5, 'volume': 108.5, 'aromatic': False},
    'Q': {'code3': 'Gln', 'name': 'Glutamine', 'polarity': 'polar_uncharged', 'charge': 0.0, 'mw_residue': 128.06, 'hydropathy': -3.5, 'volume': 143.8, 'aromatic': False},
    'E': {'code3': 'Glu', 'name': 'Glutamic Acid', 'polarity': 'acidic_negative', 'charge': -1.0, 'mw_residue': 129.04, 'hydropathy': -3.5, 'volume': 138.4, 'aromatic': False},
    'G': {'code3': 'Gly', 'name': 'Glycine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 57.02, 'hydropathy': -0.4, 'volume': 60.1, 'aromatic': False},
    'H': {'code3': 'His', 'name': 'Histidine', 'polarity': 'basic_positive', 'charge': 0.1, 'mw_residue': 137.06, 'hydropathy': -3.2, 'volume': 153.2, 'aromatic': True},
    'I': {'code3': 'Ile', 'name': 'Isoleucine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 113.08, 'hydropathy': 4.5, 'volume': 166.7, 'aromatic': False},
    'L': {'code3': 'Leu', 'name': 'Leucine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 113.08, 'hydropathy': 3.8, 'volume': 166.7, 'aromatic': False},
    'K': {'code3': 'Lys', 'name': 'Lysine', 'polarity': 'basic_positive', 'charge': 1.0, 'mw_residue': 128.09, 'hydropathy': -3.9, 'volume': 168.6, 'aromatic': False},
    'M': {'code3': 'Met', 'name': 'Methionine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 131.04, 'hydropathy': 1.9, 'volume': 162.9, 'aromatic': False},
    'F': {'code3': 'Phe', 'name': 'Phenylalanine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 147.07, 'hydropathy': 2.8, 'volume': 189.9, 'aromatic': True},
    'P': {'code3': 'Pro', 'name': 'Proline', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 97.05, 'hydropathy': -1.6, 'volume': 112.7, 'aromatic': False},
    'S': {'code3': 'Ser', 'name': 'Serine', 'polarity': 'polar_uncharged', 'charge': 0.0, 'mw_residue': 87.03, 'hydropathy': -0.8, 'volume': 89.0, 'aromatic': False},
    'T': {'code3': 'Thr', 'name': 'Threonine', 'polarity': 'polar_uncharged', 'charge': 0.0, 'mw_residue': 101.05, 'hydropathy': -0.7, 'volume': 116.1, 'aromatic': False},
    'W': {'code3': 'Trp', 'name': 'Tryptophan', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 186.08, 'hydropathy': -0.9, 'volume': 227.8, 'aromatic': True},
    'Y': {'code3': 'Tyr', 'name': 'Tyrosine', 'polarity': 'polar_uncharged', 'charge': 0.0, 'mw_residue': 163.06, 'hydropathy': -1.3, 'volume': 193.6, 'aromatic': True},
    'V': {'code3': 'Val', 'name': 'Valine', 'polarity': 'nonpolar', 'charge': 0.0, 'mw_residue': 99.07, 'hydropathy': 4.2, 'volume': 140.0, 'aromatic': False},
    '*': {'code3': 'Stop', 'name': 'Termination (Stop)', 'polarity': 'stop', 'charge': 0.0, 'mw_residue': 0.0, 'hydropathy': 0.0, 'volume': 0.0, 'aromatic': False},
    '?': {'code3': 'Unk', 'name': 'Unknown / Ambiguous', 'polarity': 'unknown', 'charge': 0.0, 'mw_residue': 0.0, 'hydropathy': 0.0, 'volume': 0.0, 'aromatic': False},
}


# -----------------------------------------------------------------------------
# 2. Concurrency-Safe ESM Inference Singleton
# -----------------------------------------------------------------------------

_esm_lock = threading.Lock()
_esm_model = None
_esm_alphabet = None
_esm_model_name = "esm2_t6_8M_UR50D"
_esm_init_error: Optional[str] = None


def get_esm_model() -> Tuple[Any, Any]:
    """
    Lazy thread-safe initialization of Meta ESM model on CPU.
    """
    global _esm_model, _esm_alphabet, _esm_init_error
    if _esm_model is not None:
        return _esm_model, _esm_alphabet

    with _esm_lock:
        if _esm_model is not None:
            return _esm_model, _esm_alphabet
        if _esm_init_error is not None:
            raise RuntimeError(f"ESM model previously failed to initialize: {_esm_init_error}")

        try:
            import esm
            import torch
            # Concurrency-safe local load from torch hub cache
            model, alphabet = esm.pretrained.esm2_t6_8M_UR50D()
            model.eval()
            _esm_model = model
            _esm_alphabet = alphabet
            return _esm_model, _esm_alphabet
        except Exception as e:
            _esm_init_error = str(e)
            raise RuntimeError(f"Failed to load ESM model: {e}")


# -----------------------------------------------------------------------------
# 3. DNA Normalization & Validation
# -----------------------------------------------------------------------------

IUPAC_AMBIGUOUS_BASES = {'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V', 'N'}
CANONICAL_BASES = {'A', 'C', 'G', 'T'}


def normalize_dna(raw: str) -> str:
    """Removes all whitespace and converts to uppercase."""
    return "".join(raw.split()).upper()


def validate_dna(seq: str, label: str = "Sequence") -> Dict[str, Any]:
    """
    Validates DNA sequence characters, checking for empty strings,
    canonical bases, and ambiguous symbols.
    """
    if not seq:
        return {
            "is_valid": False,
            "errors": [f"{label} is empty."],
            "has_ambiguous": False,
            "ambiguous_positions": [],
        }

    ambiguous_positions = []
    invalid_chars = set()

    for idx, char in enumerate(seq, start=1):
        if char in CANONICAL_BASES:
            continue
        elif char in IUPAC_AMBIGUOUS_BASES:
            ambiguous_positions.append({"position": idx, "base": char})
        else:
            invalid_chars.add(char)

    if invalid_chars:
        return {
            "is_valid": False,
            "errors": [f"{label} contains unsupported characters: {', '.join(sorted(invalid_chars))}"],
            "has_ambiguous": len(ambiguous_positions) > 0,
            "ambiguous_positions": ambiguous_positions,
        }

    return {
        "is_valid": True,
        "errors": [],
        "has_ambiguous": len(ambiguous_positions) > 0,
        "ambiguous_positions": ambiguous_positions,
    }


# -----------------------------------------------------------------------------
# 4. Layer A: Nucleotide Comparison
# -----------------------------------------------------------------------------

def compute_nucleotide_comparison(
    clean_ref: str,
    clean_obs: str,
    reading_frame: int = 0,
    table_id: int = 1,
) -> Dict[str, Any]:
    """
    Performs global alignment, calculates nucleotide composition,
    identifies discrete and grouped mutation events, and counts transitions/transversions.
    """
    aligner = Align.PairwiseAligner()
    aligner.mode = 'global'
    aligner.match_score = 2
    aligner.mismatch_score = -1
    aligner.open_gap_score = -2.5
    aligner.extend_gap_score = -1

    alignments = aligner.align(clean_ref, clean_obs)
    if not alignments:
        return {
            "status": "failed",
            "reason": "Could not compute global pairwise alignment.",
        }

    al = alignments[0]
    aligned_ref = str(al[0])
    aligned_obs = str(al[1])
    alignment_len = len(aligned_ref)

    # Base counts and percentages
    def base_stats(seq: str) -> Dict[str, Any]:
        l = len(seq)
        if l == 0:
            return {"A": 0, "C": 0, "G": 0, "T": 0, "A_pct": 0.0, "C_pct": 0.0, "G_pct": 0.0, "T_pct": 0.0, "gc_pct": 0.0, "at_pct": 0.0}
        counts = {'A': seq.count('A'), 'C': seq.count('C'), 'G': seq.count('G'), 'T': seq.count('T')}
        gc_count = counts['G'] + counts['C']
        at_count = counts['A'] + counts['T']
        return {
            "A": counts['A'],
            "C": counts['C'],
            "G": counts['G'],
            "T": counts['T'],
            "A_pct": round((counts['A'] / l) * 100, 2),
            "C_pct": round((counts['C'] / l) * 100, 2),
            "G_pct": round((counts['G'] / l) * 100, 2),
            "T_pct": round((counts['T'] / l) * 100, 2),
            "gc_pct": round((gc_count / l) * 100, 2),
            "at_pct": round((at_count / l) * 100, 2),
        }

    ref_stats = base_stats(clean_ref)
    obs_stats = base_stats(clean_obs)
    gc_diff = round(obs_stats['gc_pct'] - ref_stats['gc_pct'], 2)

    # Walk aligned sequences
    ref_pos = 1
    obs_pos = 1
    matching_bases = 0
    substituted_bases = 0
    inserted_bases = 0
    deleted_bases = 0
    transitions_count = 0
    transversions_count = 0

    events: List[Dict[str, Any]] = []
    event_counter = 1
    i = 0

    while i < alignment_len:
        r_ch = aligned_ref[i]
        o_ch = aligned_obs[i]

        if r_ch == o_ch and r_ch != '-':
            matching_bases += 1
            ref_pos += 1
            obs_pos += 1
            i += 1
        elif r_ch != '-' and o_ch != '-':
            # Substitution
            substituted_bases += 1
            is_purine_r = r_ch in ('A', 'G')
            is_purine_o = o_ch in ('A', 'G')
            is_trans = is_purine_r == is_purine_o
            if is_trans:
                transitions_count += 1
            else:
                transversions_count += 1

            event_id = f"EV-{event_counter}"
            event_counter += 1

            events.append({
                "event_id": event_id,
                "event_type": "substitution",
                "reference_interval": [ref_pos, ref_pos],
                "variant_interval": [obs_pos, obs_pos],
                "reference_position": ref_pos,
                "variant_position": obs_pos,
                "reference_bases": r_ch,
                "variant_bases": o_ch,
                "length": 1,
                "is_transition": is_trans,
                "is_transversion": not is_trans,
                "codon_index": (ref_pos - 1 - reading_frame) // 3 + 1 if ref_pos > reading_frame else None,
            })
            ref_pos += 1
            obs_pos += 1
            i += 1
        elif r_ch == '-':
            # Insertion event
            start_i = i
            start_obs = obs_pos
            ins_bases = []
            while i < alignment_len and aligned_ref[i] == '-':
                ins_bases.append(aligned_obs[i])
                obs_pos += 1
                i += 1
            ins_str = "".join(ins_bases)
            ins_len = len(ins_str)
            inserted_bases += ins_len

            event_id = f"EV-{event_counter}"
            event_counter += 1

            events.append({
                "event_id": event_id,
                "event_type": "insertion",
                "reference_interval": [ref_pos - 1, ref_pos],
                "variant_interval": [start_obs, obs_pos - 1],
                "reference_pos_before": ref_pos - 1 if ref_pos > 1 else None,
                "reference_pos_after": ref_pos if ref_pos <= len(clean_ref) else None,
                "reference_bases": "-",
                "variant_bases": ins_str,
                "length": ins_len,
                "is_transition": False,
                "is_transversion": False,
                "codon_index": None,
            })
        elif o_ch == '-':
            # Deletion event
            start_i = i
            start_ref = ref_pos
            del_bases = []
            while i < alignment_len and aligned_obs[i] == '-':
                del_bases.append(aligned_ref[i])
                ref_pos += 1
                i += 1
            del_str = "".join(del_bases)
            del_len = len(del_str)
            deleted_bases += del_len

            event_id = f"EV-{event_counter}"
            event_counter += 1

            events.append({
                "event_id": event_id,
                "event_type": "deletion",
                "reference_interval": [start_ref, ref_pos - 1],
                "variant_interval": [obs_pos - 1, obs_pos],
                "reference_position": start_ref,
                "reference_end_position": ref_pos - 1,
                "reference_bases": del_str,
                "variant_bases": "-",
                "length": del_len,
                "is_transition": False,
                "is_transversion": False,
                "codon_index": None,
            })

    # Identity percentage: matching unambiguous bases divided by total aligned columns
    identity_pct = round((matching_bases / alignment_len) * 100, 2) if alignment_len > 0 else 0.0

    return {
        "status": "available",
        "evidence_label": "Calculated from input sequences",
        "reference_length_bp": len(clean_ref),
        "variant_length_bp": len(clean_obs),
        "alignment_length_bp": alignment_len,
        "matching_bases": matching_bases,
        "substituted_bases": substituted_bases,
        "inserted_bases": inserted_bases,
        "deleted_bases": deleted_bases,
        "grouped_events_count": len(events),
        "identity_percentage": identity_pct,
        "transitions_count": transitions_count,
        "transversions_count": transversions_count,
        "reference_composition": ref_stats,
        "variant_composition": obs_stats,
        "gc_difference_pct_points": gc_diff,
        "aligned_reference": aligned_ref,
        "aligned_variant": aligned_obs,
        "events": events,
    }


# -----------------------------------------------------------------------------
# 5. Layer B: Coding and Protein Interpretation
# -----------------------------------------------------------------------------

def translate_sequence(dna: str, reading_frame: int = 0, table_id: int = 1) -> Dict[str, Any]:
    """
    Translates DNA under NCBI Standard Code, returning codons and protein product ending at first stop.
    """
    table = CodonTable.unambiguous_dna_by_id.get(table_id, CodonTable.unambiguous_dna_by_id[1])
    trimmed = dna[reading_frame:]
    total_codons = len(trimmed) // 3
    incomplete_bp = len(trimmed) % 3

    codons: List[str] = []
    aa_list: List[str] = []
    first_stop_idx: Optional[int] = None

    for c_i in range(total_codons):
        codon = trimmed[c_i * 3 : c_i * 3 + 3]
        codons.append(codon)
        if codon in table.stop_codons:
            if first_stop_idx is None:
                first_stop_idx = c_i + 1 # 1-based codon position
            aa_list.append('*')
        else:
            aa = table.forward_table.get(codon, '?')
            aa_list.append(aa)

    # Displayed product ending strictly before the first in-frame stop
    displayed_product = "".join(aa_list[:first_stop_idx - 1]) if first_stop_idx is not None else "".join(aa_list)

    return {
        "codons": codons,
        "full_amino_acids": aa_list,
        "displayed_product": displayed_product,
        "product_length_aa": len(displayed_product),
        "first_stop_codon_position": first_stop_idx,
        "trailing_incomplete_bp": incomplete_bp,
    }


def compute_protein_interpretation(
    clean_ref: str,
    clean_obs: str,
    events: List[Dict[str, Any]],
    reading_frame: int = 0,
    table_id: int = 1,
    is_coding: bool = True,
) -> Dict[str, Any]:
    """
    Evaluates codon alterations, amino acid substitutions, indels, and frameshifts.
    Crucially: Multi-base changes affecting the same codon are evaluated ONCE.
    """
    if not is_coding:
        return {
            "status": "not_applicable",
            "evidence_label": "Calculated from input sequences",
            "reason": "Sequence context specified as non-coding. Protein translation is not evaluated.",
            "is_coding": False,
            "substitutions": [],
        }

    ref_trans = translate_sequence(clean_ref, reading_frame, table_id)
    obs_trans = translate_sequence(clean_obs, reading_frame, table_id)

    table = CodonTable.unambiguous_dna_by_id.get(table_id, CodonTable.unambiguous_dna_by_id[1])

    # Check for indels or frameshifts
    has_indels = any(e['event_type'] in ('insertion', 'deletion') for e in events)
    len_diff = len(clean_obs) - len(clean_ref)
    is_frameshift = (len_diff % 3 != 0) and has_indels

    # Evaluate substitutions grouped by codon index
    codon_sub_map: Dict[int, List[Dict[str, Any]]] = {}
    for ev in events:
        if ev['event_type'] == 'substitution' and ev.get('codon_index') is not None:
            c_idx = ev['codon_index'] # 1-based codon index
            codon_sub_map.setdefault(c_idx, []).append(ev)

    substitutions: List[Dict[str, Any]] = []
    consequence_types = set()

    for c_idx, ev_list in sorted(codon_sub_map.items()):
        # 1-based codon index
        c_zero = c_idx - 1
        ref_start = reading_frame + c_zero * 3
        obs_start = reading_frame + c_zero * 3

        if ref_start + 3 <= len(clean_ref) and obs_start + 3 <= len(clean_obs) and not has_indels:
            ref_codon = clean_ref[ref_start : ref_start + 3]
            obs_codon = clean_obs[obs_start : obs_start + 3]

            ref_aa = table.forward_table.get(ref_codon, '*' if ref_codon in table.stop_codons else '?')
            obs_aa = table.forward_table.get(obs_codon, '*' if obs_codon in table.stop_codons else '?')

            if ref_aa == obs_aa:
                consequence = "synonymous"
                consequence_label = "Synonymous"
                consequence_types.add("synonymous")
            elif obs_aa == '*':
                consequence = "stop_gained"
                consequence_label = "Stop-gained (Nonsense)"
                consequence_types.add("stop_gained")
            elif ref_aa == '*' and obs_aa != '*':
                consequence = "stop_lost"
                consequence_label = "Stop-lost"
                consequence_types.add("stop_lost")
            else:
                consequence = "missense"
                consequence_label = "Missense"
                consequence_types.add("missense")

            sub_id = f"SUB-{c_idx}"
            linked_event_ids = [ev['event_id'] for ev in ev_list]

            substitutions.append({
                "substitution_id": sub_id,
                "protein_position": c_idx, # 1-based residue position
                "codon_index": c_idx,
                "reference_codon": ref_codon,
                "variant_codon": obs_codon,
                "reference_aa": ref_aa,
                "variant_aa": obs_aa,
                "mutation_label": f"{ref_aa}{c_idx}{obs_aa}",
                "consequence": consequence,
                "consequence_label": consequence_label,
                "base_changes_count": len(ev_list),
                "linked_event_ids": linked_event_ids,
            })

    # Overall consequence classification
    overall_consequences = list(consequence_types)
    if is_frameshift:
        overall_consequences.append("frameshift")
    elif has_indels and (len_diff % 3 == 0):
        overall_consequences.append("inframe_indel")

    if not overall_consequences and clean_ref == clean_obs:
        overall_consequences.append("identical")

    return {
        "status": "available",
        "evidence_label": "Calculated from input sequences",
        "is_coding": True,
        "reading_frame": reading_frame,
        "genetic_code_table": table_id,
        "reference_protein_product": ref_trans['displayed_product'],
        "variant_protein_product": obs_trans['displayed_product'],
        "reference_first_stop_position": ref_trans['first_stop_codon_position'],
        "variant_first_stop_position": obs_trans['first_stop_codon_position'],
        "has_indels": has_indels,
        "is_frameshift": is_frameshift,
        "consequences": overall_consequences,
        "substitutions": substitutions,
    }


# -----------------------------------------------------------------------------
# 6. Layer C: Biochemical Comparison
# -----------------------------------------------------------------------------

def compute_biochemical_comparison(substitutions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes rigorous documented biochemical shifts for missense amino acid substitutions.
    """
    if not substitutions:
        return {
            "status": "not_applicable",
            "evidence_label": "Calculated from input sequences",
            "reason": "No amino acid substitutions detected.",
            "entries": [],
        }

    entries: List[Dict[str, Any]] = []

    for sub in substitutions:
        ref_aa = sub['reference_aa']
        var_aa = sub['variant_aa']

        ref_meta = AMINO_ACID_TABLE.get(ref_aa, AMINO_ACID_TABLE['?'])
        var_meta = AMINO_ACID_TABLE.get(var_aa, AMINO_ACID_TABLE['?'])

        # Skip stop codons or unknown
        if ref_aa in ('*', '?') or var_aa in ('*', '?'):
            continue

        h_ref = KYTE_DOOLITTLE_HYDROPATHY.get(ref_aa, 0.0)
        h_var = KYTE_DOOLITTLE_HYDROPATHY.get(var_aa, 0.0)
        delta_h = round(h_var - h_ref, 2)

        m_ref = MONOISOTOPIC_RESIDUE_MASS.get(ref_aa, 0.0)
        m_var = MONOISOTOPIC_RESIDUE_MASS.get(var_aa, 0.0)
        delta_m = round(m_var - m_ref, 2)

        v_ref = RESIDUE_VOLUME_SCALE.get(ref_aa, 0.0)
        v_var = RESIDUE_VOLUME_SCALE.get(var_aa, 0.0)
        delta_v = round(v_var - v_ref, 1)

        c_ref = SIDECHAIN_CHARGE_PH74.get(ref_aa, 0.0)
        c_var = SIDECHAIN_CHARGE_PH74.get(var_aa, 0.0)
        delta_c = round(c_var - c_ref, 2)

        p_ref = POLARITY_CATEGORY.get(ref_aa, 'unknown')
        p_var = POLARITY_CATEGORY.get(var_aa, 'unknown')

        arom_ref = ref_aa in AROMATIC_AMINO_ACIDS
        arom_var = var_aa in AROMATIC_AMINO_ACIDS

        desc = (
            f"Substitution {sub['mutation_label']} changes residue from {ref_meta['name']} ({ref_meta['code3']}) "
            f"to {var_meta['name']} ({var_meta['code3']}). Polarity shifts from {p_ref.replace('_', ' ')} "
            f"to {p_var.replace('_', ' ')}. Hydropathy delta: {delta_h:+.2f} (Kyte-Doolittle); "
            f"mass delta: {delta_m:+.2f} Da (monoisotopic residue); volume delta: {delta_v:+.1f} Å³."
        )

        entries.append({
            "substitution_id": sub['substitution_id'],
            "protein_position": sub['protein_position'],
            "mutation_label": sub['mutation_label'],
            "reference_aa": ref_aa,
            "variant_aa": var_aa,
            "hydropathy": {"reference": h_ref, "variant": h_var, "delta": delta_h, "scale": "Kyte-Doolittle (1982)"},
            "molecular_mass_da": {"reference": m_ref, "variant": m_var, "delta": delta_m, "scale": "Monoisotopic residue mass (Da)"},
            "volume_angstrom3": {"reference": v_ref, "variant": v_var, "delta": delta_v, "scale": "Grantham (1974) / Zamyatnin (1972)"},
            "sidechain_charge_ph74": {"reference": c_ref, "variant": c_var, "delta": delta_c, "scale": "Formal residue charge at physiological pH 7.4"},
            "polarity": {"reference": p_ref, "variant": p_var, "transition": f"{p_ref} -> {p_var}"},
            "aromaticity": {"reference": arom_ref, "variant": arom_var, "transition": f"{'Aromatic' if arom_ref else 'Non-aromatic'} -> {'Aromatic' if arom_var else 'Non-aromatic'}"},
            "description": desc,
        })

    return {
        "status": "available" if entries else "not_applicable",
        "evidence_label": "Calculated from input sequences",
        "entries": entries,
        "scales_metadata": {
            "hydropathy": "Kyte & Doolittle (J. Mol. Biol. 1982, 157:105-132)",
            "molecular_mass": "Standard IUPAC monoisotopic amino acid residue mass (M_free - 18.015 Da)",
            "residue_volume": "Grantham (Science 1974) and Zamyatnin (Prog. Biophys. Mol. Biol. 1972)",
            "charge": "Standard side-chain ionization at pH 7.4",
        }
    }


# -----------------------------------------------------------------------------
# 7. Layer D: Pretrained ESM Masked-Marginal Scoring
# -----------------------------------------------------------------------------

def compute_esm_scoring(
    ref_protein: str,
    var_protein: str,
    substitutions: List[Dict[str, Any]],
    has_indels: bool,
    is_frameshift: bool,
) -> Dict[str, Any]:
    """
    Executes official masked-marginal scoring on reference protein context:
    score_i = log P(alternative_i | masked ref) - log P(reference_i | masked ref)
    """
    # 1. Eligibility Check
    if not ref_protein:
        return {
            "status": "unsupported_input",
            "evidence_label": "Model-derived",
            "model_name": _esm_model_name,
            "reason": "Reference protein sequence is empty.",
            "site_scores": [],
        }

    if has_indels or is_frameshift or len(ref_protein) != len(var_protein):
        return {
            "status": "unsupported_input",
            "evidence_label": "Model-derived",
            "model_name": _esm_model_name,
            "reason": "ESM masked-marginal scoring requires equal-length aligned protein substitutions. Indels and frameshifts are unsupported.",
            "site_scores": [],
        }

    # Filter to missense substitutions
    missense_subs = [s for s in substitutions if s.get('consequence') == 'missense']

    if not missense_subs:
        if substitutions and all(s.get('consequence') == 'synonymous' for s in substitutions):
            return {
                "status": "not_applicable",
                "evidence_label": "Model-derived",
                "model_name": _esm_model_name,
                "reason": "The encoded amino-acid sequence is unchanged. This protein model does not evaluate possible RNA-level effects.",
                "site_scores": [],
            }
        return {
            "status": "not_applicable",
            "evidence_label": "Model-derived",
            "model_name": _esm_model_name,
            "reason": "No single amino-acid substitutions eligible for sitewise ESM masked-marginal scoring.",
            "site_scores": [],
        }

    # 2. PyTorch Model Inference
    try:
        import torch
        model, alphabet = get_esm_model()
        batch_converter = alphabet.get_batch_converter()

        site_scores: List[Dict[str, Any]] = []

        for sub in missense_subs:
            pos_1based = sub['protein_position']
            ref_aa = sub['reference_aa']
            var_aa = sub['variant_aa']

            if pos_1based < 1 or pos_1based > len(ref_protein):
                continue

            # Mask reference residue at position i
            masked_chars = list(ref_protein)
            masked_chars[pos_1based - 1] = '<mask>'
            masked_seq_str = "".join(masked_chars)

            data = [("query_ref", masked_seq_str)]
            _, _, batch_tokens = batch_converter(data)

            # Tokenizer prepends <cls> at index 0. Therefore pos_1based is at token index pos_1based
            token_idx = pos_1based

            with torch.inference_mode():
                out = model(batch_tokens)
                logits = out["logits"] # [1, seq_len, vocab_size]
                log_probs = torch.log_softmax(logits[0, token_idx], dim=-1)

            ref_tok = alphabet.get_idx(ref_aa)
            alt_tok = alphabet.get_idx(var_aa)

            ref_log_p = log_probs[ref_tok].item()
            alt_log_p = log_probs[alt_tok].item()
            score_i = round(alt_log_p - ref_log_p, 4)

            # Preference interpretation
            if score_i > 0.05:
                pref = "alternative_favoured"
                interp = f"The model assigns higher conditional likelihood to {var_aa} than {ref_aa} in this reference context."
            elif score_i < -0.05:
                pref = "reference_favoured"
                interp = f"The model assigns higher conditional likelihood to reference {ref_aa} than {var_aa} in this context."
            else:
                pref = "neutral_or_close"
                interp = f"The model shows little separation between {ref_aa} and {var_aa} on this log-ratio scale."

            site_scores.append({
                "substitution_id": sub['substitution_id'],
                "protein_position": pos_1based,
                "mutation_label": sub['mutation_label'],
                "reference_aa": ref_aa,
                "variant_aa": var_aa,
                "score_log_ratio": score_i,
                "ref_log_prob": round(ref_log_p, 4),
                "alt_log_prob": round(alt_log_p, 4),
                "preference": pref,
                "interpretation": interp,
                "scoring_method": "sitewise_reference_context_masked_marginal",
            })

        return {
            "status": "available",
            "evidence_label": "Model-derived",
            "model_name": "Meta ESM-2 (8M parameters, UR50D)",
            "model_checkpoint": "esm2_t6_8M_UR50D",
            "scoring_formula": "log P(alt | masked reference) - log P(ref | masked reference)",
            "scoring_units": "Log-probability ratio (natural log)",
            "site_scores": site_scores,
            "disclaimer": (
                "Sitewise reference-context scoring under ESM-2. Positive scores indicate the alternative residue "
                "is more favoured by the masked language model in this context; negative indicates reference is favoured. "
                "This metric reflects model likelihood, not measured biological improvement, stability, or clinical phenotype."
            ),
        }

    except Exception as exc:
        return {
            "status": "failed",
            "evidence_label": "Model-derived",
            "model_name": _esm_model_name,
            "reason": f"ESM model scoring failed: {str(exc)}",
            "site_scores": [],
        }


# -----------------------------------------------------------------------------
# 8. Layer E: Structural Mapping & 5 Å Spatial Neighborhood
# -----------------------------------------------------------------------------

def compute_structural_observations(
    clean_ref_dna: str,
    gene: Optional[str],
    pdb_id: Optional[str],
    substitutions: List[Dict[str, Any]],
    fetch_pdb_func: Any,
) -> Dict[str, Any]:
    """
    Maps protein residues onto macromolecular structure and calculates
    the 5 Å heavy-atom spatial neighborhood using Bio.PDB.
    """
    # 1. Resolve Target PDB
    from structure_engine import GENE_STRUCTURE_REGISTRY

    # Add GB1 to registry if not present
    if "GB1" not in GENE_STRUCTURE_REGISTRY:
        GENE_STRUCTURE_REGISTRY["GB1"] = {
            "gene": "GB1",
            "organism": "Streptococcus sp.",
            "accession": "P06654",
            "pdb_id": "1PGA",
            "chain": "A",
            "title": "Structure of protein G B1 domain at 2.07 Å",
            "method": "X-ray Diffraction",
            "resolution": "2.07 Å",
            "coding_sequence": "ATGCAGTACAAACTGATCCTGAACGGTAAAACCCTGAAAGGTGAAACCACCACCGAAGCTGTTGACGCTGCTACCGCTGAAAAAGTTTTCAAACAGTACGCTAACGACAACGGTGTTGACGGTGAATGGACCTACGACGACGCTACCAAAACCTTCACCGTTACCGAA",
            "cds_start_offset": 0,
        }

    gene_key = (gene or "").strip().upper()
    target_config = None
    if gene_key in GENE_STRUCTURE_REGISTRY:
        target_config = GENE_STRUCTURE_REGISTRY[gene_key]
    elif pdb_id:
        p_u = pdb_id.strip().upper()
        for g_k, conf in GENE_STRUCTURE_REGISTRY.items():
            if conf.get('pdb_id') == p_u:
                target_config = conf
                break

    if not target_config:
        # Check if sequence length is very short
        if len(clean_ref_dna) < 30:
            return {
                "status": "unavailable",
                "evidence_label": "Structure-derived",
                "reason": f"Submitted DNA ({len(clean_ref_dna)} bp) is too short to map to an experimental macromolecular structure.",
                "mapped_residues": [],
            }
        return {
            "status": "unavailable",
            "evidence_label": "Structure-derived",
            "reason": "No validated macromolecular reference structure available for this gene and sequence in the registry.",
            "mapped_residues": [],
        }

    # Verify reference DNA match with curated coding sequence
    if clean_ref_dna != target_config["coding_sequence"]:
        return {
            "status": "unavailable",
            "evidence_label": "Structure-derived",
            "pdb_id": target_config["pdb_id"],
            "reason": "Supplied reference DNA does not match the curated coding sequence for this structure. Residues are not inferred.",
            "mapped_residues": [],
        }

    pdb_text = fetch_pdb_func(target_config["pdb_id"])
    if not pdb_text:
        return {
            "status": "failed",
            "evidence_label": "Structure-derived",
            "pdb_id": target_config["pdb_id"],
            "reason": f"Could not retrieve PDB file for {target_config['pdb_id']}.",
            "mapped_residues": [],
        }

    try:
        parser = PDBParser(QUIET=True)
        struct = parser.get_structure(target_config["pdb_id"], StringIO(pdb_text))
        chain = struct[0][target_config["chain"]]
    except Exception as exc:
        return {
            "status": "failed",
            "evidence_label": "Structure-derived",
            "pdb_id": target_config["pdb_id"],
            "reason": f"PDB parser failure: {str(exc)}",
            "mapped_residues": [],
        }

    # Map substitutions
    mapped_residues: List[Dict[str, Any]] = []
    cds_offset = target_config.get("cds_start_offset", 0)

    for sub in substitutions:
        pos_aa = sub['protein_position']
        # Compute PDB residue number
        pdb_res_num = pos_aa + cds_offset

        target_res = None
        for res in chain:
            if res.id[0] == ' ' and res.id[1] == pdb_res_num:
                target_res = res
                break

        if target_res is None:
            continue

        res_key = f"{target_config['chain']}:{pdb_res_num}"

        # 5 Å Spatial Neighborhood (Heavy-atom minimum distance)
        # Target residue heavy atoms:
        target_heavy_atoms = [a for a in target_res if a.element != 'H']

        spatial_neighbors: List[Dict[str, Any]] = []

        for other_res in chain:
            if other_res == target_res or other_res.id[0] != ' ':
                continue
            other_heavy = [a for a in other_res if a.element != 'H']
            if not other_heavy:
                continue

            # Minimum distance between any heavy atom of target and other
            min_dist = float('inf')
            for a1 in target_heavy_atoms:
                for a2 in other_heavy:
                    dist = (a1 - a2) # Biopython atom subtraction gives Euclidean distance in Å
                    if dist < min_dist:
                        min_dist = dist

            if min_dist <= 5.0:
                spatial_neighbors.append({
                    "neighbor_key": f"{target_config['chain']}:{other_res.id[1]}",
                    "residue_name": other_res.resname,
                    "residue_number": int(other_res.id[1]),
                    "min_distance_angstrom": round(float(min_dist), 2),
                })

        spatial_neighbors.sort(key=lambda x: x["min_distance_angstrom"])

        mapped_residues.append({
            "substitution_id": sub['substitution_id'],
            "protein_position": pos_aa,
            "mutation_label": sub['mutation_label'],
            "pdb_id": target_config["pdb_id"],
            "chain": target_config["chain"],
            "pdb_residue_number": int(pdb_res_num),
            "residue_key": res_key,
            "spatial_neighbors_5a": spatial_neighbors,
            "b_factor_mean": round(float(sum(a.get_bfactor() for a in target_heavy_atoms) / max(len(target_heavy_atoms), 1)), 2),
            "b_factor_disclaimer": "Values represent crystallographic B-factors (temperature factors), not AlphaFold pLDDT confidence.",
            "secondary_structure_status": "unavailable",
            "secondary_structure_reason": "DSSP binary not installed in environment.",
            "solvent_accessibility_status": "unavailable",
            "solvent_accessibility_reason": "FreeSASA/DSSP binary not installed in environment.",
        })

    return {
        "status": "available" if mapped_residues else "unavailable",
        "evidence_label": "Structure-derived",
        "pdb_id": target_config["pdb_id"],
        "chain": target_config["chain"],
        "structure_title": target_config.get("title"),
        "method": target_config.get("method"),
        "resolution": target_config.get("resolution"),
        "mapped_residues": mapped_residues,
        "spatial_neighborhood_definition": "Minimum heavy-atom distance <= 5.0 Å from selected residue in structural model.",
        "spatial_proximity_disclaimer": "Spatial proximity does not establish a functional interaction.",
    }


# -----------------------------------------------------------------------------
# 9. Integrated Explanation Generator (Deterministic)
# -----------------------------------------------------------------------------

def generate_integrated_explanation(
    nucleotide_layer: Dict[str, Any],
    protein_layer: Dict[str, Any],
    biochem_layer: Dict[str, Any],
    ml_layer: Dict[str, Any],
    struct_layer: Dict[str, Any],
) -> str:
    """
    Generates a clear, objective scientific summary of all evidence layers.
    """
    parts: List[str] = []

    # DNA comparison
    subs = nucleotide_layer.get("substituted_bases", 0)
    inss = nucleotide_layer.get("inserted_bases", 0)
    dels = nucleotide_layer.get("deleted_bases", 0)
    ident = nucleotide_layer.get("identity_percentage", 100.0)

    if subs == 0 and inss == 0 and dels == 0:
        return "Reference and variant sequences are identical (100.0% identity). No nucleotide, amino-acid, or structural alterations occur."

    diff_tokens = []
    if subs > 0:
        diff_tokens.append(f"{subs} substitution{'s' if subs > 1 else ''}")
    if inss > 0:
        diff_tokens.append(f"{inss} inserted nucleotide{'s' if inss > 1 else ''}")
    if dels > 0:
        diff_tokens.append(f"{dels} deleted nucleotide{'s' if dels > 1 else ''}")

    parts.append(f"Sequence comparison identifies {', '.join(diff_tokens)} across {nucleotide_layer.get('alignment_length_bp', 0)} aligned columns ({ident}% identity).")

    # Protein
    if protein_layer.get("status") == "available":
        consequences = protein_layer.get("consequences", [])
        subs_list = protein_layer.get("substitutions", [])
        if "frameshift" in consequences:
            parts.append("An indel induces a frameshift altering downstream translation.")
        elif subs_list:
            labels = [s['mutation_label'] for s in subs_list]
            parts.append(f"Translation under the Standard Code yields alteration(s): {', '.join(labels)}.")

    # Biochemical
    if biochem_layer.get("status") == "available" and biochem_layer.get("entries"):
        first_b = biochem_layer["entries"][0]
        dh = first_b['hydropathy']['delta']
        dm = first_b['molecular_mass_da']['delta']
        parts.append(f"Biochemical tracking shows hydropathy shift of {dh:+.2f} and residue mass change of {dm:+.2f} Da.")

    # ESM ML
    if ml_layer.get("status") == "available" and ml_layer.get("site_scores"):
        scores_desc = [f"{s['mutation_label']}: {s['score_log_ratio']:+.4f} ({s['preference'].replace('_', ' ')})" for s in ml_layer["site_scores"]]
        parts.append(f"Meta ESM-2 masked-marginal scoring: {'; '.join(scores_desc)}.")
    elif ml_layer.get("status") == "not_applicable":
        parts.append("Protein language model scoring is not applicable (sequence unchanged or non-coding).")

    # Structural
    if struct_layer.get("status") == "available" and struct_layer.get("mapped_residues"):
        first_s = struct_layer["mapped_residues"][0]
        n_count = len(first_s.get("spatial_neighbors_5a", []))
        parts.append(f"Mapped to {struct_layer.get('pdb_id')} (chain {struct_layer.get('chain')}) at residue {first_s.get('residue_key')} with {n_count} spatial neighbor(s) within 5 Å.")

    parts.append("These observations reflect sequence differences and model likelihood; they do not establish clinical effect or general protein fitness.")

    return " ".join(parts)


# -----------------------------------------------------------------------------
# 10. Canonical Snapshot Orchestrator
# -----------------------------------------------------------------------------

def analyze_variant_intelligence(
    reference_sequence: str,
    variant_sequence: str,
    gene: Optional[str] = None,
    pdb_id: Optional[str] = None,
    reading_frame: int = 0,
    table_id: int = 1,
    is_coding: bool = True,
    fetch_pdb_func: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Executes all 5 independent analysis layers and assembles the canonical snapshot.
    """
    clean_ref = normalize_dna(reference_sequence)
    clean_var = normalize_dna(variant_sequence)

    ref_val = validate_dna(clean_ref, "Reference DNA")
    var_val = validate_dna(clean_var, "Variant DNA")

    if not ref_val["is_valid"]:
        raise ValueError("; ".join(ref_val["errors"]))
    if not var_val["is_valid"]:
        raise ValueError("; ".join(var_val["errors"]))

    # 1. Hashes and Metadata
    ref_hash = hashlib.sha256(clean_ref.encode('utf-8')).hexdigest()
    var_hash = hashlib.sha256(clean_var.encode('utf-8')).hexdigest()
    analysis_id = f"AN-{hashlib.md5(f'{clean_ref}:{clean_var}'.encode('utf-8')).hexdigest()[:8].upper()}"

    # 2. Layer A: Nucleotide Comparison
    nucleotide_layer = compute_nucleotide_comparison(
        clean_ref=clean_ref,
        clean_obs=clean_var,
        reading_frame=reading_frame,
        table_id=table_id,
    )

    # 3. Layer B: Protein Interpretation
    protein_layer = compute_protein_interpretation(
        clean_ref=clean_ref,
        clean_obs=clean_var,
        events=nucleotide_layer.get("events", []),
        reading_frame=reading_frame,
        table_id=table_id,
        is_coding=is_coding,
    )

    # 4. Layer C: Biochemical Comparison
    biochem_layer = compute_biochemical_comparison(
        substitutions=protein_layer.get("substitutions", []),
    )

    # 5. Layer D: ESM ML Scoring
    ref_prot = protein_layer.get("reference_protein_product", "")
    var_prot = protein_layer.get("variant_protein_product", "")
    has_indels = protein_layer.get("has_indels", False)
    is_frameshift = protein_layer.get("is_frameshift", False)

    ml_layer = compute_esm_scoring(
        ref_protein=ref_prot,
        var_protein=var_prot,
        substitutions=protein_layer.get("substitutions", []),
        has_indels=has_indels,
        is_frameshift=is_frameshift,
    )

    # 6. Layer E: Structural Observations
    if fetch_pdb_func is None:
        from structure_engine import fetch_pdb_file
        fetch_pdb_func = fetch_pdb_file

    struct_layer = compute_structural_observations(
        clean_ref_dna=clean_ref,
        gene=gene,
        pdb_id=pdb_id,
        substitutions=protein_layer.get("substitutions", []),
        fetch_pdb_func=fetch_pdb_func,
    )

    # 7. Integrated Explanation
    explanation = generate_integrated_explanation(
        nucleotide_layer=nucleotide_layer,
        protein_layer=protein_layer,
        biochem_layer=biochem_layer,
        ml_layer=ml_layer,
        struct_layer=struct_layer,
    )

    # 8. Layer Statuses Summary
    layer_statuses = {
        "nucleotide_comparison": nucleotide_layer.get("status", "failed"),
        "protein_interpretation": protein_layer.get("status", "failed"),
        "biochemical_comparison": biochem_layer.get("status", "failed"),
        "ml_scoring": ml_layer.get("status", "failed"),
        "structural_observations": struct_layer.get("status", "failed"),
    }

    return {
        "analysis_id": analysis_id,
        "analysis_version": "3.0.0",
        "input_hashes": {
            "reference_sha256": ref_hash,
            "variant_sha256": var_hash,
        },
        "context": {
            "gene": gene or "Unspecified",
            "reading_frame": reading_frame,
            "table_id": table_id,
            "is_coding": is_coding,
        },
        "layer_statuses": layer_statuses,
        "nucleotide_comparison": nucleotide_layer,
        "protein_interpretation": protein_layer,
        "biochemical_comparison": biochem_layer,
        "ml_scoring": ml_layer,
        "structural_observations": struct_layer,
        "integrated_explanation": explanation,
    }
