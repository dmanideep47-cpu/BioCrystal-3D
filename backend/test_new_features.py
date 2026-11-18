import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from bio_engine import (
    parse_fasta_content,
    compute_protein_biochemical_telemetry,
    generate_mutation_impact_summary,
    compare_two_variants,
    perform_pairwise_alignment,
)
from pdf_generator import generate_pdf_report

client = TestClient(app)

# ==============================================================================
# FEATURE 1: FASTA FILE PARSING TESTS
# ==============================================================================

def test_parse_fasta_valid_single_sequence():
    fasta_text = """>NM_004985.5 KRAS wildtype coding sequence
ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG
"""
    result = parse_fasta_content(fasta_text)
    assert result["valid"] is True
    assert result["count"] == 1
    assert result["error"] is None
    seq_item = result["sequences"][0]
    assert seq_item["id"] == "NM_004985.5"
    assert seq_item["sequence"] == "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    assert seq_item["length"] == 60
    assert 30.0 <= seq_item["gc_percent"] <= 50.0


def test_parse_fasta_valid_multi_sequence():
    fasta_text = """>seq1 Reference
ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG
>seq2 Variant A G12D
ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG
>seq3 Variant B G12V
ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGTTGGCGTAGGCAAGAGTGCCTTGACG
"""
    result = parse_fasta_content(fasta_text)
    assert result["valid"] is True
    assert result["count"] == 3
    assert len(result["sequences"]) == 3
    assert result["sequences"][0]["id"] == "seq1"
    assert result["sequences"][1]["id"] == "seq2"
    assert result["sequences"][2]["id"] == "seq3"


def test_parse_fasta_invalid_characters():
    fasta_text = """>invalid_seq
ATGACTGAATATAAACTTGTGGTAGTTGGAGCTG1234XYZ
"""
    result = parse_fasta_content(fasta_text)
    assert result["valid"] is False
    assert result["count"] == 0
    assert "Invalid FASTA format" in result["error"]


def test_parse_fasta_empty_and_no_header():
    # Empty string
    assert parse_fasta_content("")["valid"] is False
    # No fasta header
    assert parse_fasta_content("ATGACTGAATATAAACTTGT")["valid"] is False


def test_api_fasta_parse_json_and_file():
    # JSON body
    res = client.post("/api/fasta/parse", json={
        "fasta_content": ">test\nATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["count"] == 1

    # Invalid FASTA raises 400
    bad_res = client.post("/api/fasta/parse", json={"fasta_content": "INVALID_DNA_WITHOUT_HEADER"})
    assert bad_res.status_code == 400


# ==============================================================================
# FEATURE 2: MUTATION IMPACT SUMMARY TESTS
# ==============================================================================

def test_generate_mutation_impact_summary_missense():
    ref = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    var = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG"
    aln = perform_pairwise_alignment(ref, var)
    mutations = aln["mutations"]
    assert len(mutations) == 1

    impact = generate_mutation_impact_summary(
        mutations=mutations,
        reference_seq=ref,
        variant_seq=var,
        structure_mapping={"mapped": True, "pdb_id": "6OIM"},
        gene="KRAS",
        is_coding=True,
        reading_frame=0,
    )
    assert impact["has_mutations"] is True
    assert impact["total_mutations"] == 1
    assert "c.35G>A" in impact["primary_interpretation"] or "p.Gly12Asp" in impact["primary_interpretation"] or "Missense" in impact["primary_interpretation"]

    item = impact["items"][0]
    assert item["mutation_notation"] == "c.35G>A"
    assert item["codon_position"] == 12
    assert item["codon_change"] == "GGT → GAT"
    assert item["amino_acid_change"] == "p.Gly12Asp"
    assert item["consequence"] == "missense"
    assert item["creates_premature_stop"] is False
    assert item["changes_protein_length"] is False
    assert item["pdb_available"] is True
    assert item["pdb_id"] == "6OIM"
    assert "6OIM" in item["structure_provenance"]


def test_generate_mutation_impact_summary_nonsense():
    # Stop codon created at codon 2: TAC -> TAA
    ref = "ATGTACGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    var = "ATGTAAGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    aln = perform_pairwise_alignment(ref, var)
    impact = generate_mutation_impact_summary(
        mutations=aln["mutations"],
        reference_seq=ref,
        variant_seq=var,
        structure_mapping=None,
        gene="TEST",
        is_coding=True,
        reading_frame=0,
    )
    item = impact["items"][0]
    assert item["consequence"] == "nonsense"
    assert item["creates_premature_stop"] is True
    assert item["changes_protein_length"] is True
    assert item["pdb_available"] is False


def test_api_compare_includes_mutation_impact_summary():
    res = client.post("/api/compare", json={
        "reference_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
        "observed_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG",
        "gene": "KRAS",
        "is_coding": True,
        "reading_frame": 0,
    })
    assert res.status_code == 200
    data = res.json()
    assert "mutation_impact_summary" in data
    assert data["mutation_impact_summary"]["total_mutations"] == 1
    assert len(data["mutation_impact_summary"]["items"]) == 1
    assert data["mutation_impact_summary"]["items"][0]["mutation_notation"] == "c.35G>A"


# ==============================================================================
# FEATURE 3: DUAL VARIANT COMPARISON TESTS
# ==============================================================================

def test_compare_two_variants_kras():
    ref = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    var_a = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG"
    var_b = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGTTGGCGTAGGCAAGAGTGCCTTGACG"

    comp = compare_two_variants(
        reference_seq=ref,
        variant_a_seq=var_a,
        variant_b_seq=var_b,
        variant_a_name="KRAS G12D",
        variant_b_name="KRAS G12V",
        gene="KRAS",
        reading_frame=0,
    )
    assert comp["reference_length"] == len(ref)
    assert comp["variant_a"]["name"] == "KRAS G12D"
    assert comp["variant_b"]["name"] == "KRAS G12V"
    assert len(comp["rows"]) == 2

    # Check 13 metrics for row A
    row_a = comp["rows"][0]
    assert row_a["variant_label"] == "KRAS G12D"
    assert row_a["mutation_type"] == "substitution"
    assert row_a["mutation_notation"] == "c.35G>A"
    assert row_a["codon_change"] == "GGT → GAT"
    assert row_a["amino_acid_change"] == "p.Gly12Asp"
    assert row_a["mutation_consequence"].lower() == "missense"
    assert "Da" in row_a["protein_mw_change"]
    assert row_a["gravy_score_change"] != ""
    assert row_a["net_charge_change"] != ""
    assert "%" in row_a["gc_content_change"]
    assert "°C" in row_a["melting_temp_change"]
    assert "6OIM" in row_a["pdb_availability"]
    assert row_a["primary_interpretation"] != ""

    # Check 13 metrics for row B
    row_b = comp["rows"][1]
    assert row_b["variant_label"] == "KRAS G12V"
    assert row_b["mutation_notation"] == "c.35G>T"
    assert row_b["codon_change"] == "GGT → GTT"
    assert row_b["amino_acid_change"] == "p.Gly12Val"
    assert row_b["mutation_consequence"].lower() == "missense"

    # Conclusion must contrast G12D and G12V
    assert comp["conclusion"] != ""
    assert "G12D" in comp["conclusion"] or "polar" in comp["conclusion"] or "Asp" in comp["conclusion"]


def test_api_compare_variants_endpoint():
    res = client.post("/api/compare-variants", json={
        "reference_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
        "variant_a_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG",
        "variant_b_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGTTGGCGTAGGCAAGAGTGCCTTGACG",
        "variant_a_name": "KRAS G12D",
        "variant_b_name": "KRAS G12V",
        "gene": "KRAS",
        "reading_frame": 0,
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data["rows"]) == 2
    assert "conclusion" in data
    assert data["rows"][0]["variant_label"] == "KRAS G12D"
    assert data["rows"][1]["variant_label"] == "KRAS G12V"


# ==============================================================================
# FEATURE 4: PDF REPORT EXPORT TESTS WITH NEW FEATURES
# ==============================================================================

def test_pdf_report_with_fasta_impact_and_comparison():
    ref = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
    var_a = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG"
    var_b = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGTTGGCGTAGGCAAGAGTGCCTTGACG"

    aln = perform_pairwise_alignment(ref, var_a)
    impact = generate_mutation_impact_summary(
        mutations=aln["mutations"],
        reference_seq=ref,
        variant_seq=var_a,
        structure_mapping={"mapped": True, "pdb_id": "6OIM"},
        gene="KRAS",
    )
    comp = compare_two_variants(
        reference_seq=ref,
        variant_a_seq=var_a,
        variant_b_seq=var_b,
        variant_a_name="KRAS G12D",
        variant_b_name="KRAS G12V",
        gene="KRAS",
    )

    payload = {
        "analysis_id": "TEST-PDF-001",
        "original_sequence": ref,
        "current_sequence": var_a,
        "reference_sequence": ref,
        "gene": "KRAS",
        "accession": "NM_004985.5",
        "organism": "Homo sapiens",
        "sequence_type": "coding",
        "reading_frame": 0,
        "genetic_code": "Standard (NCBI Table 1)",
        "revision": 1,
        "edit_history": [],
        "alignment": aln,
        "structure_mapping": {"mapped": True, "pdb_id": "6OIM"},
        "mutation_impact_summary": impact,
        "variant_comparison": comp,
        "fasta_metadata": {
            "id": "NM_004985.5",
            "header": "KRAS wildtype",
            "sequence": ref,
            "length": len(ref),
            "gc_percent": 45.0,
        },
    }

    pdf_bytes = generate_pdf_report(payload)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 20000
    assert pdf_bytes.startswith(b"%PDF-")
