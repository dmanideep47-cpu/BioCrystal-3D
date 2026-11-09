"""Regression tests for alignment-aware nucleotide and codon coordinates."""
try:
    from backend.bio_engine import perform_pairwise_alignment
except ImportError:
    from bio_engine import perform_pairwise_alignment


def test_substitution_after_insertion_uses_observed_codon_coordinates():
    reference = "ATGGCTACTTAA"
    observed = "ATGAGCTACTGAA"  # Insert A after reference position 3; downstream T -> G.

    result = perform_pairwise_alignment(reference, observed, reading_frame=0)
    insertion = next(item for item in result["mutations"] if item["type"] == "insertion")
    substitution = next(item for item in result["mutations"] if item["type"] == "substitution")

    assert insertion["reference_position"] == 4
    assert insertion["observed_position"] == 4
    assert substitution["reference_position"] == 10
    assert substitution["observed_position"] == 11
    assert substitution["reference_codon"] == "TAA"
    assert substitution["observed_codon"] == "TGA"
    assert substitution["category"] == "nonsense"


def test_substitution_without_complete_codon_context_is_not_called_synonymous():
    result = perform_pairwise_alignment("ATGGCTAA", "CTGGCTAA", reading_frame=1)
    substitution = next(item for item in result["mutations"] if item["type"] == "substitution")

    assert substitution["category"] == "non_coding"
    assert substitution["reference_codon"] is None
    assert substitution["observed_codon"] is None
