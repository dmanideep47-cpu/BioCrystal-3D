import os
import sys
import unittest
from io import BytesIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from pypdf import PdfReader
from main import app
from pdf_generator import generate_pdf_report
from dna_structure_builder import parse_pdb_atoms


class TestBioCrystalAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_endpoint(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["version"], "3.0.0")

    def test_02_validate_endpoint(self):
        res = self.client.post("/api/validate", json={"sequence": "ATGGCTACTGGTTAA"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["is_valid"])
        self.assertEqual(data["length"], 15)

    def test_03_mutate_endpoint(self):
        res = self.client.post("/api/mutate", json={
            "sequence": "ATGGCTACTGGTTAA",
            "type": "substitution",
            "position": 9,
            "new_bases": "G"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["category"], "synonymous")
        self.assertEqual(data["mutated_codon"], "ACG")

    def test_04_analyze_endpoint(self):
        res = self.client.post("/api/analyze", json={"sequence": "ATGGCTACTGGTTAA"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("validation", data)
        self.assertIn("codons", data)
        self.assertIn("exploratory", data)
        self.assertEqual(len(data["codons"]), 5)

    def test_05_compare_endpoint(self):
        res = self.client.post("/api/compare", json={
            "reference_sequence": "ATGGCTACTGGTTAA",
            "observed_sequence": "ATGGCTACGGGTTAA",
            "reading_frame": 0,
            "is_coding": True,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["alignment"]["mutation_count"], 1)
        mut = data["alignment"]["mutations"][0]
        self.assertEqual(mut["reference_position"], 9)
        self.assertEqual(mut["category"], "synonymous")

    def test_compare_without_coding_context_omits_amino_acid_claims(self):
        res = self.client.post("/api/compare", json={
            "reference_sequence": "ATGGCTACTGGTTAA",
            "observed_sequence": "ATGGCTACGGGTTAA",
        })
        self.assertEqual(res.status_code, 200)
        mutation = res.json()["alignment"]["mutations"][0]
        self.assertEqual(mutation["category"], "non_coding")
        self.assertIsNone(mutation["reference_codon"])
        self.assertEqual(mutation["original_amino_acid"]["code3"], "Unk")

    def test_compare_maps_only_curated_reference_to_verified_pdb_residue(self):
        reference = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
        observed = reference[:33] + "T" + reference[34:]
        response = self.client.post("/api/compare", json={
            "reference_sequence": reference,
            "observed_sequence": observed,
            "gene": "KRAS",
            "pdb_id": "6OIM",
            "is_coding": True,
        })
        self.assertEqual(response.status_code, 200)
        structure = response.json()["structure_mapping"]
        self.assertTrue(structure["mapped"])
        self.assertEqual(structure["mappings"][0]["residue_number"], 12)
        self.assertEqual(structure["mappings"][0]["pdb_residue"], "C")

    def test_06_annotate_endpoint(self):
        res = self.client.post("/api/annotate", json={"sequence": "ATGGCTACTGGTTAA"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("composition", data)
        self.assertIn("reading_frames", data)
        self.assertIn("limitations_notice", data)

    def test_07_recommend_endpoint(self):
        res = self.client.post("/api/recommend", json={
            "reference_sequence": "ATGGCTACTGGTTAA",
            "observed_sequence": "ATGGCTACGGGTTAA",
            "reading_frame": 0,
            "constraints": {
                "target_gc_min": 40.0,
                "target_gc_max": 60.0,
                "preserve_protein": True
            }
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total_candidates"], 0)
        top = data["candidates"][0]
        self.assertEqual(top["sequence"], "ATGGCTACTGGTTAA")
        self.assertEqual(top["strategy"], "Reference Restoration")

    def test_08_export_pdf_endpoint(self):
        res = self.client.post("/api/export-pdf", json={
            "original_sequence": "ATGGCTACGGGTTAA",
            "reference_sequence": "ATGGCTACTGGTTAA",
            "gc_percent": 46.7,
            "at_percent": 53.3,
            "melting_temp": 44.5,
            "molecular_weight_kda": 4.67,
            "mutations_list": [{
                "reference_position": 9,
                "observed_position": 9,
                "original_base": "T",
                "observed_base": "G",
                "type": "substitution",
                "reference_codon": "ACT",
                "observed_codon": "ACG",
                "category_label": "Synonymous (Silent)"
            }]
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "application/pdf")
        self.assertGreater(len(res.content), 1000)

    def test_pdf_has_four_pages_for_small_and_large_analyses(self):
        for variant_count in (0, 250):
            reference = "A" * max(15, variant_count)
            observed = "C" * max(15, variant_count)
            mutations = [
                {
                    "type": "substitution",
                    "reference_position": position,
                    "observed_position": position,
                    "reference_bases": "A",
                    "observed_bases": "C",
                    "original_base": "A",
                    "observed_base": "C",
                    "category": "non_coding",
                    "category_label": "Sequence substitution",
                }
                for position in range(1, variant_count + 1)
            ]
            alignment = {
                "aligned_reference": reference,
                "aligned_observed": observed,
                "identity_percent": 0.0 if variant_count else 100.0,
                "alignment_score": -2.0 * variant_count,
                "method": "Test alignment fixture",
                "mutations": mutations,
            }
            report = generate_pdf_report({
                "analysis_id": f"BC-PDF-{variant_count}",
                "analysis_timestamp": "2026-11-09T12:00:00Z",
                "original_sequence": observed,
                "current_sequence": observed,
                "reference_sequence": reference,
                "reference_name": "PDF page-count test reference",
                "gene": "Test locus",
                "organism": "Synthetic test data",
                "accession": "TEST-001",
                "sequence_type": "unknown",
                "analysis_context": {"sequence_type": "unknown"},
                "alignment": alignment,
                "structure_mapping": {"mapped": False, "reason": "Not supplied in test fixture."},
            })
            reader = PdfReader(BytesIO(report))
            self.assertEqual(len(reader.pages), 4, f"PDF with {variant_count} variants must have four pages")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            self.assertNotIn("\ufffd", text)
            self.assertIn("09 Nov 2026, 12:00 UTC", text)
            if variant_count > 7:
                self.assertIn(f"Showing 6 of {variant_count} variants", text)
                self.assertIn(f"first 180 of {variant_count}", text)

    def test_09_dna_biophysics_endpoint(self):
        res = self.client.post("/api/dna/biophysics", json={
            "sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
            "mutations": [
                {"reference_position": 34, "reference_bases": "G", "observed_bases": "T", "category": "missense"}
            ],
            "na_molar": 0.050,
            "mg_molar": 0.0015,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("thermodynamics", data)
        self.assertIn("morphometrics", data)
        self.assertIn("spectroscopic_profile", data)
        self.assertIn("swiss_radar_scores", data)
        self.assertGreater(data["thermodynamics"]["melting_temperature_c"], 50.0)
        self.assertGreater(data["swiss_radar_scores"]["biocrystal_dna_index"], 50.0)

    def test_10_dna_structure_endpoint(self):
        res = self.client.post("/api/dna/structure", json={
            "sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
            "gene": "KRAS",
            "mutations": [
                {"reference_position": 34, "reference_bases": "G", "observed_bases": "T", "category": "missense"}
            ],
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["mapped"])
        self.assertEqual(data["structure_type"], "idealized_dna_duplex")
        self.assertTrue(data["pdb_id"].startswith("DNA_"))
        self.assertIn("ATOM", data["pdb_data"])
        self.assertEqual(len(data["mappings"]), 1)
        self.assertEqual(data["mappings"][0]["mutation_ref_pos"], 34)

    def test_11_compare_returns_exact_dna_structure(self):
        observed_sequence = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTTGTGGCGTAGGCAAGAGTGCCTTGACG"
        res = self.client.post("/api/compare", json={
            "reference_sequence": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
            "observed_sequence": observed_sequence,
            "gene": "KRAS",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("dna_structure", data)
        self.assertIn("dna_biophysics", data)
        dna_struct = data["dna_structure"]
        self.assertTrue(dna_struct["mapped"])
        self.assertEqual(dna_struct["structure_type"], "idealized_dna_duplex")
        self.assertIn("pdb_data", dna_struct)
        chain_a_sequence = [
            atom["res_name"][-1]
            for atom in parse_pdb_atoms(dna_struct["pdb_data"])
            if atom["chain"] == "A" and atom["atom_name"] == "P"
        ]
        self.assertEqual("".join(chain_a_sequence), observed_sequence)

    def test_compare_models_observed_sequence_and_maps_indel_context(self):
        cases = [
            ("ATGC", "ATGGC", "insertion", False, 1, "c.2_3insG"),
            ("ATGGC", "ATGC", "deletion", True, 1, "c.3delG"),
            ("ATGC", "ATGGGC", "insertion", False, 2, "c.2_3insGG"),
            ("ATGGGC", "ATGC", "deletion", True, 1, "c.3_4delGG"),
        ]
        for reference, observed, expected_type, is_gap_context, mapping_count, dna_variant in cases:
            with self.subTest(reference=reference, observed=observed):
                response = self.client.post("/api/compare", json={
                    "reference_sequence": reference,
                    "observed_sequence": observed,
                    "is_coding": False,
                })
                self.assertEqual(response.status_code, 200)
                data = response.json()
                structure = data["dna_structure"]
                chain_a_sequence = [
                    atom["res_name"][-1]
                    for atom in parse_pdb_atoms(structure["pdb_data"])
                    if atom["chain"] == "A" and atom["atom_name"] == "P"
                ]
                self.assertEqual("".join(chain_a_sequence), observed)
                self.assertEqual(data["alignment"]["mutations"][0]["type"], expected_type)
                self.assertEqual(len(structure["mappings"]), mapping_count)
                self.assertTrue(all(mapping["mutation_type"] == expected_type for mapping in structure["mappings"]))
                self.assertTrue(all(mapping["is_gap_context"] == is_gap_context for mapping in structure["mappings"]))
                self.assertEqual(structure["mappings"][0]["dna_variant"], dna_variant)


if __name__ == "__main__":
    unittest.main()
