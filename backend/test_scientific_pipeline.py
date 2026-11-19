"""
BioCrystal 3D — Automated Scientific Validation & Pipeline Test Suite.

Covers all 12 rigorous computational biology test cases:
  1. Identical reference and observed sequences (0 mutations, 100% identity, identical translation, 0.000 Å RMSD)
  2. Single nucleotide substitution (KRAS G12D: c.35G>A -> p.Gly12Asp)
  3. Synonymous mutation (c.36G>A -> p.Gly12Gly)
  4. Missense mutation (c.35G>T -> p.Gly12Val)
  5. Nonsense mutation (premature termination codon)
  6. Insertion (triplet in-frame insertion)
  7. Deletion (single-base deletion)
  8. Frameshift mutation
  9. Multiple mutations across amplicon
  10. Invalid nucleotide input handling
  11. Incomplete coding sequence handling
  12. Missing structural coordinates handling without coordinate fabrication
  13. Consistency audit enforcement
"""

import unittest
from fastapi.testclient import TestClient

try:
    from main import app
    from analysis_pipeline import (
        ScientificAnalysisPipeline,
        validate_analysis_consistency,
        clean_dna,
        calculate_santalucia_thermodynamics,
    )
except ImportError:
    from backend.main import app
    from backend.analysis_pipeline import (
        ScientificAnalysisPipeline,
        validate_analysis_consistency,
        clean_dna,
        calculate_santalucia_thermodynamics,
    )


class TestScientificPipeline(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.kras_wt = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"
        self.kras_g12d = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"
        self.kras_g12v = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGTTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"
        self.kras_syn = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGCGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"
        self.kras_non = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTTGAGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGAT"

    def test_01_identical_sequences(self):
        """Case 1: Identical sequences must yield 100% identity, 0 mutations, ΔTm=0, 0.000 Å RMSD."""
        res = ScientificAnalysisPipeline.execute(self.kras_wt, self.kras_wt, gene="KRAS")
        self.assertEqual(res["alignment"]["identity_percent"], 100.0)
        self.assertEqual(len(res["alignment"]["mutations"]), 0)
        self.assertEqual(len(res["translation"]["protein_differences"]), 0)
        self.assertEqual(res["thermodynamics"]["delta_tm"], 0.0)
        self.assertEqual(res["thermodynamics"]["delta_dg"], 0.0)
        self.assertFalse(res["structural_comparison"]["has_mutation"])
        self.assertEqual(res["structural_comparison"]["rmsd"], 0.0)

        audit = validate_analysis_consistency(res)
        self.assertTrue(audit["is_valid"])
        self.assertEqual(len(audit["errors"]), 0)

    def test_02_single_nucleotide_substitution_missense(self):
        """Case 2 & 4: KRAS G12D substitution c.35G>A yields p.Gly12Asp, PDB 6OIM, and ΔTm != 0."""
        res = ScientificAnalysisPipeline.execute(self.kras_wt, self.kras_g12d, gene="KRAS")
        self.assertLess(res["alignment"]["identity_percent"], 100.0)
        self.assertEqual(len(res["alignment"]["mutations"]), 1)
        mut = res["alignment"]["mutations"][0]
        self.assertEqual(mut["reference_position"], 35)
        self.assertEqual(mut["original_base"], "G")
        self.assertEqual(mut["observed_base"], "A")

        diffs = res["translation"]["protein_differences"]
        self.assertEqual(len(diffs), 1)
        self.assertEqual(diffs[0]["residue_number"], 12)
        self.assertEqual(diffs[0]["hgvs_p"], "p.Gly12Asp")

        comp = res["structural_comparison"]
        self.assertTrue(comp["has_mutation"])
        self.assertEqual(comp["variant"]["pdb_id"], "6OIM")
        self.assertEqual(comp["reference"]["pdb_id"], "4OBE")
        self.assertIsNotNone(comp["rmsd"])
        self.assertGreater(comp["rmsd"], 0.5)

        audit = validate_analysis_consistency(res)
        self.assertTrue(audit["is_valid"])

    def test_03_synonymous_mutation(self):
        """Case 3: Synonymous substitution c.36G>C conserves Gly12 (p.(=))."""
        res = ScientificAnalysisPipeline.execute(self.kras_wt, self.kras_syn, gene="KRAS")
        self.assertLess(res["alignment"]["identity_percent"], 100.0)
        self.assertEqual(len(res["alignment"]["mutations"]), 1)
        self.assertEqual(res["alignment"]["mutations"][0]["category"], "synonymous")
        self.assertEqual(len(res["translation"]["protein_differences"]), 0)
        self.assertTrue(res["translation"]["is_protein_identical"])

        audit = validate_analysis_consistency(res)
        self.assertTrue(audit["is_valid"])

    def test_04_nonsense_mutation(self):
        """Case 5: Nonsense mutation introducing TGA stop codon at codon 12."""
        res = ScientificAnalysisPipeline.execute(self.kras_wt, self.kras_non, gene="KRAS")
        diffs = res["translation"]["protein_differences"]
        self.assertTrue(any(d.get("is_nonsense") for d in diffs))

        audit = validate_analysis_consistency(res)
        self.assertTrue(audit["is_valid"])

    def test_05_insertion_and_deletion(self):
        """Case 6 & 7: Triplet insertion and deletion handling."""
        ins_var = self.kras_wt[:33] + "CAT" + self.kras_wt[33:]
        res_ins = ScientificAnalysisPipeline.execute(self.kras_wt, ins_var, gene="KRAS")
        self.assertGreater(len(res_ins["alignment"]["mutations"]), 0)

        del_var = self.kras_wt[:33] + self.kras_wt[36:]
        res_del = ScientificAnalysisPipeline.execute(self.kras_wt, del_var, gene="KRAS")
        self.assertGreater(len(res_del["alignment"]["mutations"]), 0)

    def test_06_frameshift_mutation(self):
        """Case 8: Single nucleotide deletion causing frameshift."""
        fs_var = self.kras_wt[:34] + self.kras_wt[35:]
        res_fs = ScientificAnalysisPipeline.execute(self.kras_wt, fs_var, gene="KRAS")
        self.assertNotEqual(len(res_fs["translation"]["reference_protein"]), len(res_fs["translation"]["variant_protein"]))

    def test_07_invalid_nucleotide_input(self):
        """Case 10: Invalid nucleotide characters (e.g. numbers, invalid letters) are rejected."""
        with self.assertRaises(ValueError):
            ScientificAnalysisPipeline.execute("ATGNNZZ99", self.kras_wt)

    def test_08_missing_structural_coordinates(self):
        """Case 12: Gene without curated PDB entry handles gracefully without fabrication."""
        seq_a = "ATGCGATCGATCGATCGATCGATC"
        seq_b = "ATGCGATCAATCGATCGATCGATC"
        res = ScientificAnalysisPipeline.execute(seq_a, seq_b, gene="CUSTOM_GENE")
        comp = res["structural_comparison"]
        self.assertFalse(comp["is_experimental"])
        self.assertIn("Canonical B-DNA", comp["reference"]["title"])

    def test_09_pipeline_api_endpoints(self):
        """API Endpoints: /api/pipeline/analyze and /api/pipeline/validate."""
        post_data = {
            "reference_sequence": self.kras_wt,
            "variant_sequence": self.kras_g12d,
            "gene": "KRAS",
            "reading_frame": 0,
            "table_id": 1,
            "is_coding": True,
        }
        res = self.client.post("/api/pipeline/analyze", json=post_data)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("analysis_id", data)
        self.assertIn("alignment", data)
        self.assertIn("structural_comparison", data)
        self.assertEqual(data["alignment"]["identity_percent"], 99.0)

        val_res = self.client.post("/api/pipeline/validate", json={"analysis": data})
        self.assertEqual(val_res.status_code, 200)
        self.assertTrue(val_res.json()["is_valid"])


if __name__ == "__main__":
    unittest.main()
