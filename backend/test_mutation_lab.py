"""
Test Suite: BioCrystal Virtual Mutation Lab Educational Engine
Verifies Section 14 requirements:
- Reference fixture translation
- Synonymous fixture
- Missense fixture
- Stop-gained fixture
- Single-base deletion (frameshift)
- Three-base deletion (in-frame)
- Single-base insertion (frameshift)
- Three-base insertion (in-frame)
- Initial start-codon alteration
- Sequence with no stop
- Incomplete trailing codon
- Unchanged sequence
- Input validation & normalization
- Prediction evaluation
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bio_engine import analyze_mutation_experiment, validate_dna_sequence
from fastapi.testclient import TestClient
from main import app


class TestMutationLabScientificFixtures(unittest.TestCase):
    def setUp(self):
        self.ref_seq = "ATGGCTGAATTTCCGAAATAA"

    def test_01_reference_fixture_translation(self):
        """Reference DNA: ATGGCTGAATTTCCGAAATAA translates to MAEFPK*"""
        res = analyze_mutation_experiment(self.ref_seq, self.ref_seq)
        self.assertTrue(res["success"])
        self.assertEqual(res["reference_codons"], ["ATG", "GCT", "GAA", "TTT", "CCG", "AAA", "TAA"])
        self.assertEqual(res["reference_translation"], "MAEFPK*")
        self.assertEqual(res["reference_protein_product"], "MAEFPK")
        self.assertEqual(res["reference_first_stop_position"], 7)
        self.assertEqual(res["mutation_category"], "unchanged")

    def test_02_synonymous_fixture(self):
        """Position 6: T -> C (GCT -> GCC), translation remains MAEFPK*"""
        var_seq = "ATGGCCGAATTTCCGAAATAA"
        pred = {"choice": "no_change", "rationale": "GCC is synonymous with GCT for Alanine"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertEqual(res["variant_translation"], "MAEFPK*")
        self.assertEqual(res["variant_protein_product"], "MAEFPK")
        self.assertEqual(res["mutation_category"], "synonymous")
        self.assertEqual(res["first_affected_codon"], 2)
        self.assertIn("specifies the same amino acid", res["explanation"])
        self.assertTrue(res["prediction_evaluation"]["matched"])

    def test_03_missense_fixture(self):
        """Position 5: C -> A (GCT -> GAT), translation becomes MDEFPK*"""
        var_seq = "ATGGATGAATTTCCGAAATAA"
        pred = {"choice": "one_aa_change", "rationale": "GAT encodes Aspartic Acid instead of Alanine"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertEqual(res["variant_translation"], "MDEFPK*")
        self.assertEqual(res["variant_protein_product"], "MDEFPK")
        self.assertEqual(res["mutation_category"], "missense")
        self.assertEqual(res["first_affected_codon"], 2)
        self.assertIn("specifies a different amino acid", res["explanation"])
        self.assertTrue(res["prediction_evaluation"]["matched"])

    def test_04_stop_gained_fixture(self):
        """Position 7: G -> T (GAA -> TAA), translated product before stop: MA"""
        var_seq = "ATGGCTTAATTTCCGAAATAA"
        pred = {"choice": "early_stop", "rationale": "TAA is a stop codon"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertEqual(res["variant_translation"], "MA*FPK*")
        self.assertEqual(res["variant_protein_product"], "MA")
        self.assertEqual(res["variant_first_stop_position"], 3)
        self.assertEqual(res["mutation_category"], "stop_gained")
        self.assertIn("introduces an earlier stop codon", res["explanation"])
        self.assertTrue(res["prediction_evaluation"]["matched"])

    def test_05_single_base_deletion_frameshift(self):
        """Delete pos 4 (G) -> 20 bp -> ATG CTG AAT TTC CGA AAT AA (MLNFRN + trailing AA)"""
        var_seq = "ATGCTGAATTTCCGAAATAA"
        pred = {"choice": "frameshift", "rationale": "Deleting 1 base changes reading frame"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertEqual(res["variant_codons"], ["ATG", "CTG", "AAT", "TTC", "CGA", "AAT"])
        self.assertEqual(res["variant_trailing_bases"], "AA")
        self.assertEqual(res["variant_translation"], "MLNFRN")
        self.assertIsNone(res["variant_first_stop_position"])
        self.assertEqual(res["mutation_category"], "frameshift")
        self.assertTrue(res["prediction_evaluation"]["matched"])
        # Check notes
        notes_str = " ".join(res["notes"])
        self.assertIn("No in-frame stop codon occurs", notes_str)
        self.assertIn("Trailing incomplete codon (+2 nt: AA)", notes_str)

    def test_06_three_base_deletion_inframe(self):
        """Delete pos 4-6 (GCT) -> 18 bp -> ATG GAA TTT CCG AAA TAA (MEFPK*) with inframe_indel prediction"""
        var_seq = "ATGGAATTTCCGAAATAA"
        pred = {"choice": "inframe_indel", "rationale": "Removing 3 bases preserves downstream frame"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertEqual(res["variant_translation"], "MEFPK*")
        self.assertEqual(res["variant_protein_product"], "MEFPK")
        self.assertEqual(res["mutation_category"], "inframe_indel")
        self.assertIn("downstream reading frame is preserved", res["explanation"])
        self.assertTrue(res["prediction_evaluation"]["matched"])
        self.assertEqual(res["prediction_evaluation"]["status"], "correct")

    def test_06b_three_base_deletion_diverged_prediction(self):
        """Regression test for missing answer option investigation:
        When a student previously guessed 'one_aa_change' for in-frame deletion,
        it diverged because in-frame deletion removes codons, rather than substituting one residue.
        """
        var_seq = "ATGGAATTTCCGAAATAA"
        pred = {"choice": "one_aa_change", "rationale": "Guessing single AA substitution"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertEqual(res["mutation_category"], "inframe_indel")
        self.assertFalse(res["prediction_evaluation"]["matched"])
        self.assertEqual(res["prediction_evaluation"]["status"], "diverged")
        self.assertIn("Your prediction was 'One amino acid is replaced', but the experiment resulted in In-frame Deletion", res["prediction_evaluation"]["feedback"])

    def test_07_single_base_insertion_frameshift(self):
        """Insert 1 base (T) after pos 3 -> frameshift"""
        var_seq = "ATG TGCTGAATTTCCGAAATAA".replace(" ", "")
        res = analyze_mutation_experiment(self.ref_seq, var_seq)
        self.assertTrue(res["success"])
        self.assertEqual(res["mutation_category"], "frameshift")

    def test_08_three_base_insertion_inframe(self):
        """Insert 3 bases (GCC) after pos 3 -> in-frame insertion"""
        var_seq = "ATG GCC GCTGAATTTCCGAAATAA".replace(" ", "")
        res = analyze_mutation_experiment(self.ref_seq, var_seq)
        self.assertTrue(res["success"])
        self.assertEqual(res["mutation_category"], "inframe_indel")
        self.assertIn("downstream reading frame is preserved", res["explanation"])

    def test_09_start_codon_alteration(self):
        """Alter initial ATG -> GTG: warning must be produced"""
        var_seq = "GTGGCTGAATTTCCGAAATAA"
        res = analyze_mutation_experiment(self.ref_seq, var_seq)
        self.assertTrue(res["success"])
        self.assertTrue(res["start_codon_changed"])
        notes_str = " ".join(res["notes"])
        self.assertIn("The starting codon has changed. Fixed-frame translation is shown, but biological initiation is not modeled.", notes_str)

    def test_10_sequence_with_no_stop(self):
        """Coding sequence with no stop codon"""
        ref_no_stop = "ATGGCTGAA"
        res = analyze_mutation_experiment(ref_no_stop, ref_no_stop)
        self.assertTrue(res["success"])
        self.assertIsNone(res["variant_first_stop_position"])
        notes_str = " ".join(res["notes"])
        self.assertIn("No in-frame stop codon occurs", notes_str)

    def test_11_incomplete_trailing_codon(self):
        """Coding sequence with 1 trailing nucleotide"""
        ref_trailing = "ATGGCTGAATTTCCGAAATAAG"  # 22 bp -> +1 nt
        res = analyze_mutation_experiment(ref_trailing, ref_trailing)
        self.assertTrue(res["success"])
        self.assertEqual(res["variant_trailing_bases"], "G")
        notes_str = " ".join(res["notes"])
        self.assertIn("Trailing incomplete codon (+1 nt: G)", notes_str)

    def test_12_validation_and_normalization(self):
        """Lowercase and whitespace normalization, invalid characters, empty input"""
        # Lowercase & spaces
        res = analyze_mutation_experiment("  atggctgaatttccgaaataa  ", "atg gct gaa ttt ccg aaa taa")
        self.assertTrue(res["success"])
        self.assertEqual(res["reference_sequence"], self.ref_seq)

        # Invalid characters (e.g. 'Z', 'U')
        res_inv = analyze_mutation_experiment("ATGGCTZ", self.ref_seq)
        self.assertFalse(res_inv["success"])
        self.assertIn("Reference sequence invalid", res_inv["errors"][0])

        # Empty input
        res_empty = analyze_mutation_experiment("", self.ref_seq)
        self.assertFalse(res_empty["success"])

    def test_13_prediction_not_sure(self):
        """Student selects 'not_sure' -> non-blocking, status is 'not_sure', NOT marked as an incorrect scientific claim"""
        var_seq = "ATGGCCGAATTTCCGAAATAA"
        pred = {"choice": "not_sure", "rationale": "I want to observe the outcome first"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertIsNone(res["prediction_evaluation"]["matched"])
        self.assertEqual(res["prediction_evaluation"]["status"], "not_sure")
        self.assertIn("Exploring without a prior hypothesis", res["prediction_evaluation"]["feedback"])

    def test_14_intentionally_wrong_prediction(self):
        """Student predicts 'early_stop' for synonymous mutation -> status is 'diverged'"""
        var_seq = "ATGGCCGAATTTCCGAAATAA"
        pred = {"choice": "early_stop", "rationale": "Guessing early stop"}
        res = analyze_mutation_experiment(self.ref_seq, var_seq, prediction=pred)
        self.assertTrue(res["success"])
        self.assertFalse(res["prediction_evaluation"]["matched"])
        self.assertEqual(res["prediction_evaluation"]["status"], "diverged")
        self.assertIn("Your prediction was 'Translation stops earlier', but the experiment resulted in Synonymous", res["prediction_evaluation"]["feedback"])


class TestMutationLabAPIEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_api_experiment_analyze_endpoint(self):
        payload = {
            "reference_sequence": "ATGGCTGAATTTCCGAAATAA",
            "variant_sequence": "ATGGATGAATTTCCGAAATAA",
            "prediction": {
                "choice": "one_aa_change",
                "rationale": "C->A mutation at pos 5"
            },
            "reading_frame": 0,
            "table_id": 1,
        }
        response = self.client.post("/api/experiment/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["mutation_category"], "missense")
        self.assertTrue(data["prediction_evaluation"]["matched"])


if __name__ == "__main__":
    unittest.main()
