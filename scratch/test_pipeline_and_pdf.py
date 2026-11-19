import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import pypdf
from backend.analysis_pipeline import ScientificAnalysisPipeline, validate_analysis_consistency
from backend.pdf_generator import generate_pdf_report

def run_tests():
    ref_kras = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"
    var_kras = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"

    print("--- TEST 1: KRAS G12D (c.35G>A, p.Gly12Asp) ---")
    res1 = ScientificAnalysisPipeline.execute(reference_sequence=ref_kras, variant_sequence=var_kras, gene="KRAS")
    audit1 = validate_analysis_consistency(res1)
    print("Audit 1 valid:", audit1["is_valid"], "Errors:", audit1["errors"])
    assert audit1["is_valid"]
    assert res1["alignment"]["identity_percent"] < 100.0
    assert len(res1["alignment"]["mutations"]) == 1
    assert res1["translation"]["protein_differences"][0]["hgvs_p"] == "p.Gly12Asp"
    assert res1["structural_comparison"]["has_mutation"] is True
    assert res1["structural_comparison"]["variant"]["pdb_id"] == "6OIM"
    assert res1["thermodynamics"]["delta_tm"] != 0.0

    pdf1 = generate_pdf_report(res1)
    r1 = pypdf.PdfReader(io.BytesIO(pdf1))
    print(f"PDF 1 generated: {len(r1.pages)} pages, {len(pdf1)} bytes")
    assert len(r1.pages) == 9

    print("\n--- TEST 2: KRAS Wild-Type Identical ---")
    res2 = ScientificAnalysisPipeline.execute(reference_sequence=ref_kras, variant_sequence=ref_kras, gene="KRAS")
    audit2 = validate_analysis_consistency(res2)
    print("Audit 2 valid:", audit2["is_valid"], "Errors:", audit2["errors"])
    assert audit2["is_valid"]
    assert res2["alignment"]["identity_percent"] == 100.0
    assert len(res2["alignment"]["mutations"]) == 0
    assert len(res2["translation"]["protein_differences"]) == 0
    assert res2["structural_comparison"]["has_mutation"] is False
    assert res2["structural_comparison"]["rmsd"] == 0.0
    assert res2["thermodynamics"]["delta_tm"] == 0.0
    assert res2["thermodynamics"]["delta_dg"] == 0.0

    pdf2 = generate_pdf_report(res2)
    r2 = pypdf.PdfReader(io.BytesIO(pdf2))
    print(f"PDF 2 generated: {len(r2.pages)} pages, {len(pdf2)} bytes")
    assert len(r2.pages) == 9

    print("\nALL SCIENTIFIC PIPELINE & 9-PAGE PDF TESTS SUCCEEDED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
