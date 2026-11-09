"""Regression tests for the BioCrystal explainable candidate engine."""
import pytest

try:
    from backend.candidate_engine import generate_correction_candidates
except ImportError:  # pytest may be launched with backend as the working directory.
    from candidate_engine import generate_correction_candidates


REFERENCE = "ATGGCTACTGGTTAA"
OBSERVED_T9G = "ATGGCTACGGGTTAA"


def test_reference_restoration_returns_exact_reference_candidate():
    result = generate_correction_candidates(
        ref_seq=REFERENCE,
        obs_seq=OBSERVED_T9G,
        constraints={"reference_context_confirmed": True},
    )

    assert result["recommendation_status"] == "reference_restoration_candidates_available"
    assert result["candidates"][0]["sequence"] == REFERENCE
    assert result["candidates"][0]["reference_identity_percent"] == 100.0
    assert result["candidates"][0]["score_label"].startswith("Reference identity")
    assert "probability" in result["ranking_basis"]
    assert result["candidates"][0]["edits_count"] == 1
    assert any("9" in edit for edit in result["candidates"][0]["edits_detail"])


def test_reference_restoration_requires_reference_context_confirmation():
    result = generate_correction_candidates(
        ref_seq=REFERENCE,
        obs_seq=OBSERVED_T9G,
        constraints={"reference_context_confirmed": False},
    )

    assert result["recommendation_status"] == "reference_context_not_confirmed"
    assert result["candidates"] == []


def test_identical_sequences_do_not_generate_restoration_candidate():
    result = generate_correction_candidates(
        ref_seq=REFERENCE,
        obs_seq=REFERENCE,
        constraints={"reference_context_confirmed": True},
    )

    assert result["recommendation_status"] == "no_differences_found"
    assert result["candidates"] == []


def test_sequence_design_requires_confirmed_coding_context():
    result = generate_correction_candidates(
        ref_seq=None,
        obs_seq="ATGGCTACTTAA",
        constraints={"candidate_mode": "sequence_design", "preserve_protein": True},
    )

    assert result["recommendation_status"] == "insufficient_coding_context"
    assert result["candidates"] == []


def test_confirmed_synonymous_design_preserves_translation():
    sequence = "ATGGCTACTTAA"
    result = generate_correction_candidates(
        ref_seq=None,
        obs_seq=sequence,
        constraints={
            "candidate_mode": "sequence_design",
            "coding_context_confirmed": True,
            "preserve_protein": True,
            "target_gc_min": 0,
            "target_gc_max": 100,
        },
    )

    assert result["recommendation_status"] == "design_candidates_available"
    assert result["candidates"]
    for candidate in result["candidates"]:
        assert candidate["protein_sequence"] == "MA*T"
        assert candidate["protein_preserved"] is True
        assert not candidate["constraint_violations"]


def test_invalid_reference_does_not_produce_restoration():
    result = generate_correction_candidates(
        ref_seq="ATGXYZ",
        obs_seq=OBSERVED_T9G,
        constraints={"reference_context_confirmed": True},
    )

    assert result["recommendation_status"] == "invalid_reference_sequence"
    assert result["candidates"] == []


def test_invalid_observed_sequence_does_not_produce_candidate():
    result = generate_correction_candidates(
        ref_seq=REFERENCE,
        obs_seq="ATGXYZ",
        constraints={"reference_context_confirmed": True},
    )

    assert result["recommendation_status"] == "invalid_observed_sequence"
    assert result["candidates"] == []
