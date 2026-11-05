import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bio_engine import (
    validate_dna_sequence,
    translate_dna,
    classify_mutation,
    perform_pairwise_alignment,
    perform_exploratory_analysis,
    generate_correction_candidates,
    get_amino_acid_info,
)


class TestBioCrystalMutationEngine(unittest.TestCase):

    def test_01_normal_sequence_translation(self):
        """TEST 1: Normal sequence validation, codon parsing, and polypeptide translation."""
        seq = "ATGGCTACTGGTTAA"
        val = validate_dna_sequence(seq)
        self.assertTrue(val["is_valid"])
        self.assertEqual(val["length"], 15)

        codons = translate_dna(seq)
        self.assertEqual(len(codons), 5)

        triplets = [c["triplet"] for c in codons]
        self.assertEqual(triplets, ["ATG", "GCT", "ACT", "GGT", "TAA"])

        amino_acids = [c["amino_acid"]["name"] for c in codons]
        expected_aa = ["Methionine", "Alanine", "Threonine", "Glycine", "Stop Codon"]
        self.assertEqual(amino_acids, expected_aa)

        code1_seq = "".join(c["amino_acid"]["code1"] for c in codons)
        self.assertEqual(code1_seq, "MATG*")

    def test_02_known_substitution(self):
        """TEST 2: Known synonymous substitution at position 9 (T -> G)."""
        ref = "ATGGCTACTGGTTAA"
        obs = "ATGGCTACGGGTTAA"

        res = perform_pairwise_alignment(ref, obs)
        self.assertEqual(res["mutation_count"], 1)

        mut = res["mutations"][0]
        self.assertEqual(mut["type"], "substitution")
        self.assertEqual(mut["reference_position"], 9)
        self.assertEqual(mut["observed_position"], 9)
        self.assertEqual(mut["original_base"], "T")
        self.assertEqual(mut["observed_base"], "G")
        self.assertEqual(mut["reference_codon"], "ACT")
        self.assertEqual(mut["observed_codon"], "ACG")
        self.assertEqual(mut["original_amino_acid"]["code3"], "Thr")
        self.assertEqual(mut["observed_amino_acid"]["code3"], "Thr")
        self.assertEqual(mut["category"], "synonymous")

    def test_03_reference_restoration(self):
        """TEST 3: Reference restoration proposals returning mutated sequence back to wild-type."""
        ref = "ATGGCTACTGGTTAA"
        obs = "ATGGCTACGGGTTAA"

        rec = generate_correction_candidates(ref_seq=ref, obs_seq=obs)
        candidates = rec["candidates"]
        self.assertGreater(len(candidates), 0)

        # Full restoration candidate should match reference exactly
        full_restore = next((c for c in candidates if c["strategy"] == "Reference Restoration"), None)
        self.assertIsNotNone(full_restore)
        self.assertEqual(full_restore["sequence"], ref)
        self.assertEqual(full_restore["edits_count"], 1)
        self.assertIn("Revert pos 9: G -> T", full_restore["edits_detail"][0])

    def test_04_frameshift(self):
        """TEST 4: Frameshift classification for indels not divisible by 3."""
        ref = "ATGGCTACTGGTTAA"
        # 1-bp insertion at position 8
        obs_ins = "ATGGCTACCTCGGTTAA"
        diff_ins = classify_mutation(ref, "insertion", 8, "C")
        self.assertEqual(diff_ins["category"], "frameshift")
        self.assertIn("alters reading frame", diff_ins["description"])

        # Pairwise alignment of a 1-bp insertion
        obs_ins_seq = "ATGGCTACTTGGTTAA"
        align_ins = perform_pairwise_alignment(ref, obs_ins_seq)
        ins_mut = next(m for m in align_ins["mutations"] if m["type"] == "insertion")
        self.assertEqual(ins_mut["category"], "frameshift")

        # 1-bp deletion
        diff_del = classify_mutation(ref, "deletion", 7, "A")
        self.assertEqual(diff_del["category"], "frameshift")

    def test_05_invalid_sequence_handling(self):
        """TEST 5: Detection and reporting of invalid nucleotide characters."""
        invalid_seq = "ATGGXYZTAA"
        val = validate_dna_sequence(invalid_seq)
        self.assertFalse(val["is_valid"])
        self.assertEqual(val["invalid_characters"], ["X", "Y", "Z"])
        self.assertTrue(any("Invalid character" in err for err in val["errors"]))

    def test_06_sequence_only_exploratory_analysis(self):
        """TEST 6: Exploratory sequence-only analysis without false mutation assertions."""
        seq = "ATGGCTACTGGTTAA"
        expl = perform_exploratory_analysis(seq)

        # Basic biophysical properties
        self.assertTrue(expl["validation"]["is_valid"])
        self.assertEqual(expl["composition"]["counts"]["A"], 4)
        self.assertEqual(expl["composition"]["counts"]["T"], 5)
        self.assertEqual(expl["composition"]["counts"]["G"], 4)
        self.assertEqual(expl["composition"]["counts"]["C"], 2)

        # Reading frames & ORF
        self.assertGreaterEqual(len(expl["reading_frames"]), 3)
        self.assertGreaterEqual(len(expl["orfs"]), 1)
        top_orf = expl["orfs"][0]
        self.assertEqual(top_orf["protein_sequence"], "MATG*")

        # Explicit limitation notice requirement
        self.assertIn("limitations_notice", expl)
        self.assertIn("without an authoritative reference", expl["limitations_notice"])

    def test_07_synonymous_alternative(self):
        """TEST 7: Verify ACT and ACG both translate to Threonine under standard code."""
        aa_act = get_amino_acid_info("ACT")
        aa_acg = get_amino_acid_info("ACG")
        aa_acc = get_amino_acid_info("ACC")
        aa_aca = get_amino_acid_info("ACA")

        self.assertEqual(aa_act["code3"], "Thr")
        self.assertEqual(aa_acg["code3"], "Thr")
        self.assertEqual(aa_acc["code3"], "Thr")
        self.assertEqual(aa_aca["code3"], "Thr")
        self.assertEqual(aa_act["name"], "Threonine")
        self.assertEqual(aa_acg["name"], "Threonine")


if __name__ == "__main__":
    unittest.main()
