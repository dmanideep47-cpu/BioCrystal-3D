
"""Explainable DNA candidate assessment for BioCrystal 3D.

Scores in this module are objective-fit measures, never probabilities of
pathogenicity, safety, or biological correctness.
"""
from typing import Any, Dict, List, Optional

from Bio.Data import CodonTable
from Bio.Seq import Seq
from Bio.SeqUtils import gc_fraction

try:
    from .bio_engine import perform_pairwise_alignment, validate_dna_sequence
except ImportError:  # Supports running Uvicorn from inside the backend directory.
    from bio_engine import perform_pairwise_alignment, validate_dna_sequence


def _protein(sequence: str, frame: int, table: Any) -> str:
    codons = [
        sequence[frame + index * 3:frame + (index + 1) * 3]
        for index in range(max(0, (len(sequence) - frame) // 3))
    ]
    return "".join(
        "*" if codon in table.stop_codons else table.forward_table.get(codon, "?")
        for codon in codons
    )


def _has_internal_stop(protein: str) -> bool:
    return "*" in protein[:-1] if protein else False


def _gc(sequence: str) -> float:
    return round(float(gc_fraction(Seq(sequence)) * 100.0), 1) if sequence else 0.0


def generate_correction_candidates(
    ref_seq: Optional[str],
    obs_seq: str,
    reading_frame: int = 0,
    constraints: Optional[Dict[str, Any]] = None,
    table_id: int = 1,
) -> Dict[str, Any]:
    """Generate reference-restoration or explicitly authorized design candidates."""
    observed_validation = validate_dna_sequence(obs_seq)
    clean_obs = observed_validation["cleaned_sequence"]

    base_result = {
        "observed_sequence": clean_obs,
        "reference_sequence": None,
        "reading_frame": "+{}".format(reading_frame + 1),
        "total_candidates": 0,
        "strategies_used": [],
        "candidates": [],
    }

    if not observed_validation["is_valid"]:
        return {
            **base_result,
            "recommendation_status": "invalid_observed_sequence",
            "recommendation_notice": "The observed sequence failed DNA validation. No candidate was generated.",
            "safeguards_notice": "Correct the input sequence before running candidate assessment.",
        }

    if reading_frame not in (0, 1, 2):
        raise ValueError("reading_frame must be 0, 1, or 2.")

    options = constraints or {}
    gc_min = float(options.get("target_gc_min", 40.0))
    gc_max = float(options.get("target_gc_max", 60.0))
    preserve_protein = bool(options.get("preserve_protein", True))
    avoid_internal_stops = bool(options.get("avoid_premature_stops", True))
    coding_context_confirmed = bool(options.get("coding_context_confirmed", False))
    candidate_mode = options.get(
        "candidate_mode",
        "reference_restoration" if ref_seq and ref_seq.strip() else "sequence_design",
    )

    if not (0 <= gc_min <= 100 and 0 <= gc_max <= 100) or gc_min > gc_max:
        raise ValueError("GC constraints must be between 0 and 100, with minimum no greater than maximum.")

    table = CodonTable.unambiguous_dna_by_id[table_id]
    result = dict(base_result)
    candidates: List[Dict[str, Any]] = []

    clean_ref: Optional[str] = None
    if ref_seq and ref_seq.strip():
        reference_validation = validate_dna_sequence(ref_seq)
        if not reference_validation["is_valid"]:
            return {
                **result,
                "recommendation_status": "invalid_reference_sequence",
                "recommendation_notice": "The supplied reference failed DNA validation. Restoration cannot be assessed.",
                "safeguards_notice": "Use a verified reference sequence with known organism, region, strand and provenance.",
            }
        clean_ref = reference_validation["cleaned_sequence"]
        result["reference_sequence"] = clean_ref

    def make_candidate(
        candidate_id: str,
        title: str,
        strategy: str,
        sequence: str,
        edits: List[str],
        rationale: str,
        limitation: str,
        score: float,
        score_label: str,
        objective: str,
        reference_identity: Optional[float] = None,
        changed_positions: Optional[List[int]] = None,
        before_changed_positions: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        protein = _protein(sequence, reading_frame, table)
        reference_protein = _protein(clean_ref, reading_frame, table) if clean_ref else None
        violations: List[str] = []
        gc_value = _gc(sequence)

        if gc_value < gc_min or gc_value > gc_max:
            violations.append(
                "GC content ({}%) is outside the requested range [{}, {}]%.".format(
                    gc_value, gc_min, gc_max
                )
            )
        if avoid_internal_stops and _has_internal_stop(protein):
            violations.append("An internal stop codon is present in the selected reading frame.")
        if preserve_protein and reference_protein is not None and protein != reference_protein:
            violations.append("The candidate translation differs from the supplied reference translation.")

        return {
            "candidate_id": candidate_id,
            "title": title,
            "strategy": strategy,
            "sequence": sequence,
            "edits_count": len(edits),
            "edits_detail": edits,
            "resulting_gc_percent": gc_value,
            "gc_delta": round(gc_value - observed_validation["gc_percent"], 1),
            "protein_sequence": protein,
            "protein_preserved": protein == _protein(clean_obs, reading_frame, table),
            "protein_matches_reference": protein == reference_protein if reference_protein is not None else None,
            "premature_stop_detected": _has_internal_stop(protein),
            "constraint_violations": violations,
            "score": round(max(0.0, min(100.0, score)), 1),
            "objective_fit_score": round(max(0.0, min(100.0, score)), 1),
            "score_label": score_label,
            "objective": objective,
            "reference_identity_percent": reference_identity,
            "changed_positions": sorted(set(changed_positions or [])),
            "before_changed_positions": sorted(set(before_changed_positions or [])),
            "rationale": rationale,
            "scientific_limitation": limitation,
        }

    # MODE A: restoration to the explicitly supplied reference.
    if clean_ref is not None and candidate_mode == "reference_restoration":
        if not bool(options.get("reference_context_confirmed", False)):
            return {
                **result,
                "recommendation_status": "reference_context_not_confirmed",
                "recommendation_notice": (
                    "The sequences can be compared, but restoration candidates are withheld until you confirm "
                    "that the selected reference matches the intended organism, locus, strand and transcript context."
                ),
                "safeguards_notice": "A pasted sequence or workspace default is not automatically an authoritative biological reference.",
            }

        comparison = perform_pairwise_alignment(clean_ref, clean_obs, reading_frame, table_id)
        mutations = comparison.get("mutations", [])
        result["strategies_used"] = ["Reference-guided restoration"]

        if not mutations:
            return {
                **result,
                "recommendation_status": "no_differences_found",
                "recommendation_notice": "The observed sequence matches the supplied reference. No restoration is required.",
                "safeguards_notice": "Identity to a reference does not establish clinical or biological status.",
            }

        edit_details: List[str] = []
        for mutation in mutations:
            kind = mutation.get("type")
            ref_position = mutation.get("reference_position")
            obs_position = mutation.get("observed_position")
            ref_base = mutation.get("original_base", "-")
            obs_base = mutation.get("observed_base", "-")
            if kind == "substitution":
                edit_details.append(
                    "Observed position {}: {} -> {} (reference position {}).".format(
                        obs_position, obs_base, ref_base, ref_position
                    )
                )
            elif kind == "insertion":
                edit_details.append(
                    "Remove inserted sequence {} at observed position {}.".format(obs_base, obs_position)
                )
            elif kind == "deletion":
                edit_details.append(
                    "Restore deleted reference sequence {} at reference position {}.".format(
                        ref_base, ref_position
                    )
                )

        restoration_positions: set[int] = set()
        observed_change_positions: set[int] = set()
        for mutation in mutations:
            kind = mutation.get("type")
            reference_position = int(mutation.get("reference_position") or 1)
            observed_position = int(mutation.get("observed_position") or 1)
            reference_bases = str(mutation.get("original_base") or "")
            observed_bases = str(mutation.get("observed_base") or "")

            if kind == "substitution":
                restoration_positions.add(reference_position)
                observed_change_positions.add(observed_position)
            elif kind == "insertion":
                observed_change_positions.update(
                    range(observed_position, observed_position + len(observed_bases))
                )
                # The inserted bases do not exist in the restored sequence.
                # Mark the reference bases immediately flanking the restored junction.
                if reference_position > 1:
                    restoration_positions.add(reference_position - 1)
                if reference_position <= len(clean_ref):
                    restoration_positions.add(reference_position)
            elif kind == "deletion":
                restoration_positions.update(
                    range(reference_position, reference_position + len(reference_bases))
                )
                # The deleted interval collapses to a boundary in the observed
                # sequence, so mark the adjacent observed nucleotide(s).
                if observed_position > 1:
                    observed_change_positions.add(observed_position - 1)
                if observed_position <= len(clean_obs):
                    observed_change_positions.add(observed_position)
        candidates = [
            make_candidate(
                "cand_ref_full",
                "Full Reference Restoration",
                "Reference-guided restoration",
                clean_ref,
                edit_details,
                "This sequence exactly matches the supplied reference and is the best fit for the explicit objective of restoring reference identity.",
                "Reference agreement does not prove that the reference is appropriate for this sample or that restoration is clinically beneficial.",
                100.0,
                "Reference identity (objective fit, not probability)",
                "match_supplied_reference",
                100.0,
                changed_positions=sorted(restoration_positions),
                before_changed_positions=sorted(observed_change_positions),
            )
        ]

        has_indels = any(item.get("type") in ("insertion", "deletion") for item in mutations)
        substitutions = [item for item in mutations if item.get("type") == "substitution"]
        if len(mutations) > 1 and not has_indels:
            for index, mutation in enumerate(substitutions):
                position = int(mutation["observed_position"])
                if position < 1 or position > len(clean_obs):
                    continue
                partial = (
                    clean_obs[:position - 1]
                    + str(mutation["original_base"])
                    + clean_obs[position:]
                )
                partial_comparison = perform_pairwise_alignment(clean_ref, partial, reading_frame, table_id)
                identity = float(partial_comparison.get("identity_percent", 0.0))
                candidates.append(
                    make_candidate(
                        "cand_ref_step_{}".format(index + 1),
                        "Targeted restoration at position {}".format(position),
                        "Reference-guided restoration (single substitution)",
                        partial,
                        ["Observed position {}: {} -> {}.".format(
                            position, mutation["observed_base"], mutation["original_base"]
                        )],
                        "Restores one substitution while leaving other detected differences unchanged. This supports inspection of individual edits, not a claim that partial restoration is preferable.",
                        "Other differences remain. Ranking reflects only sequence identity to the supplied reference.",
                        identity,
                        "Reference identity (objective fit, not probability)",
                        "match_supplied_reference",
                        identity,
                        changed_positions=[int(mutation["reference_position"])],
                        before_changed_positions=[position],
                    )
                )

        candidates.sort(
            key=lambda item: (
                item["reference_identity_percent"] or 0.0,
                -item["edits_count"],
            ),
            reverse=True,
        )
        for rank, candidate in enumerate(candidates, start=1):
            candidate["rank"] = rank

        return {
            **result,
            "total_candidates": len(candidates),
            "candidates": candidates,
            "recommendation_status": "reference_restoration_candidates_available",
            "recommendation_notice": "The top candidate exactly matches the supplied reference. This ranking addresses reference identity only.",
            "ranking_basis": "Percentage identity to the supplied reference; not biological safety or clinical probability.",
            "safeguards_notice": "Confirm organism, locus, strand, transcript and reference provenance. Do not apply changes to biological material based only on this computational result.",
        }

    # MODE B: sequence design requires an explicitly confirmed coding context.
    if candidate_mode == "sequence_design":
        if not coding_context_confirmed:
            return {
                **result,
                "recommendation_status": "insufficient_coding_context",
                "recommendation_notice": "No codon-based design candidates were generated. Confirm that this is a coding sequence and that the selected reading frame is correct.",
                "safeguards_notice": "Without an established coding region and reading frame, protein-preserving codon design is not justified.",
            }
        if not preserve_protein:
            return {
                **result,
                "recommendation_status": "unsupported_design_objective",
                "recommendation_notice": "No general-purpose replacement was generated because protein preservation is disabled and no other validated design objective was supplied.",
                "safeguards_notice": "A sequence optimizer needs a specific and justified biological objective.",
            }

        result["strategies_used"] = ["Protein-preserving synonymous design"]
        synonymous_map: Dict[str, List[str]] = {}
        for codon, amino_acid in table.forward_table.items():
            synonymous_map.setdefault(amino_acid, []).append(codon)

        original_protein = _protein(clean_obs, reading_frame, table)
        gc_target = (gc_min + gc_max) / 2.0
        for codon_index in range(max(0, (len(clean_obs) - reading_frame) // 3)):
            start = reading_frame + codon_index * 3
            current_codon = clean_obs[start:start + 3]
            amino_acid = table.forward_table.get(current_codon)
            if not amino_acid:
                continue
            for alternative in synonymous_map.get(amino_acid, []):
                if alternative == current_codon:
                    continue
                proposed = clean_obs[:start] + alternative + clean_obs[start + 3:]
                if _protein(proposed, reading_frame, table) != original_protein:
                    continue
                proposed_gc = _gc(proposed)
                objective_score = 100.0 - min(100.0, abs(proposed_gc - gc_target) * 2.0)
                candidate = make_candidate(
                    "cand_syn_{}_{}".format(codon_index + 1, alternative),
                    "Synonymous design at codon {}".format(codon_index + 1),
                    "Protein-preserving synonymous design",
                    proposed,
                    ["Codon {} at position {}: {} -> {} ({} preserved).".format(
                        codon_index + 1, start + 1, current_codon, alternative, amino_acid
                    )],
                    "The alternative codon preserves the translated amino acid. Ranking reflects proximity to the requested GC target only.",
                    "Synonymous changes may affect splicing, expression, RNA structure and other processes. Preserved translation does not establish biological equivalence.",
                    objective_score,
                    "GC-target fit (objective fit, not probability)",
                    "preserve_protein_and_approach_gc_target",
                    changed_positions=[
                        start + offset + 1
                        for offset, (before, after) in enumerate(zip(current_codon, alternative))
                        if before != after
                    ],
                    before_changed_positions=[
                        start + offset + 1
                        for offset, (before, after) in enumerate(zip(current_codon, alternative))
                        if before != after
                    ],
                )
                if not candidate["constraint_violations"]:
                    candidates.append(candidate)
            if len(candidates) >= 12:
                break

        candidates.sort(key=lambda item: item["objective_fit_score"], reverse=True)
        for rank, candidate in enumerate(candidates, start=1):
            candidate["rank"] = rank

        return {
            **result,
            "total_candidates": len(candidates),
            "candidates": candidates,
            "recommendation_status": "design_candidates_available" if candidates else "no_candidate_meets_constraints",
            "recommendation_notice": "Candidates preserve the translated protein in the confirmed reading frame and are ranked only by the requested GC-target objective." if candidates else "No synonymous candidate met the requested constraints.",
            "ranking_basis": "GC-target fit among candidates preserving the translated protein; not biological safety or clinical probability.",
            "safeguards_notice": "These are sequence-design alternatives, not mutation repairs. Review organism-specific codon usage and regulatory context before experimental use.",
        }

    return {
        **result,
        "recommendation_status": "unsupported_candidate_mode",
        "recommendation_notice": "Choose reference_restoration or sequence_design.",
        "safeguards_notice": "No candidate was generated because the requested candidate mode is unsupported.",
    }
