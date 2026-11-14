import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from structure_engine import fetch_pdb_file, map_mutations_to_structure, GENE_STRUCTURE_REGISTRY


class TestStructureEngine(unittest.TestCase):
    def test_fetch_pdb_cached(self):
        # 6OIM should be cached
        pdb_content = fetch_pdb_file("6OIM")
        self.assertIsNotNone(pdb_content)
        self.assertTrue("ATOM" in pdb_content or "HEADER" in pdb_content)

    def test_map_kras_g12c(self):
        # Test KRAS G12C mutation mapping (c.34G>T -> p.Gly12Cys)
        mutations = [
            {
                "type": "substitution",
                "reference_position": 34,
                "observed_position": 34,
                "original_base": "G",
                "observed_base": "T",
                "original_amino_acid": {"code1": "G", "code3": "Gly", "category": "special"},
                "observed_amino_acid": {"code1": "C", "code3": "Cys", "category": "special"},
                "category": "missense",
            }
        ]
        res = map_mutations_to_structure(
            gene="KRAS",
            pdb_id="6OIM",
            mutations=mutations,
            reference_sequence=GENE_STRUCTURE_REGISTRY["KRAS"]["coding_sequence"],
            is_coding=True,
            reading_frame=0
        )
        self.assertTrue(res["mapped"])
        self.assertEqual(res["pdb_id"], "6OIM")
        self.assertEqual(res["chain"], "A")
        self.assertEqual(len(res["mappings"]), 1)
        mapping = res["mappings"][0]
        self.assertEqual(mapping["residue_number"], 12)
        self.assertEqual(mapping["original_residue"], "Gly")
        self.assertEqual(mapping["mutated_residue"], "Cys")
        self.assertIn("P-loop", mapping["structural_region"])
        self.assertEqual(mapping["pdb_residue"], "C")
        self.assertTrue(mapping["pdb_matches_observed_residue"])
        self.assertNotIn("impact_category", mapping)

    def test_map_requires_exact_curated_reference(self):
        result = map_mutations_to_structure(
            gene="KRAS",
            pdb_id="6OIM",
            mutations=[],
            reference_sequence="ATGGCT",
            is_coding=True,
        )
        self.assertFalse(result["mapped"])
        self.assertIn("does not exactly match", result["reason"])

    def test_map_hbb_uses_verified_pdb_residue_number(self):
        result = map_mutations_to_structure(
            gene="HBB",
            pdb_id="1A3N",
            reference_sequence=GENE_STRUCTURE_REGISTRY["HBB"]["coding_sequence"],
            mutations=[{
                "type": "substitution",
                "reference_position": 20,
                "original_amino_acid": {"code1": "E", "code3": "Glu"},
                "observed_amino_acid": {"code1": "V", "code3": "Val"},
            }],
            is_coding=True,
        )
        self.assertTrue(result["mapped"])
        self.assertEqual(result["mappings"][0]["residue_number"], 6)
        self.assertEqual(result["mappings"][0]["pdb_residue"], "E")
        self.assertFalse(result["mappings"][0]["pdb_matches_observed_residue"])

    def test_map_non_coding_unavailable(self):
        # Non-coding should be honestly marked unavailable
        res = map_mutations_to_structure(
            gene="KRAS",
            pdb_id="6OIM",
            mutations=[],
            is_coding=False,
            reading_frame=0
        )
        self.assertFalse(res["mapped"])
        self.assertEqual(res["status"], "Structural mapping unavailable")
        self.assertIn("Non-coding", res["reason"])

    def test_map_unknown_gene_unavailable(self):
        # Unknown gene with no PDB
        res = map_mutations_to_structure(
            gene="UNKNOWN_GENE_XYZ",
            pdb_id=None,
            mutations=[],
            is_coding=True,
            reading_frame=0
        )
        self.assertFalse(res["mapped"])
        self.assertEqual(res["status"], "Structural mapping unavailable")


    def test_dna_structure_generation_and_caching(self):
        from structure_engine import generate_dna_structure_mapping
        seq = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
        mutations = [{
            "type": "substitution",
            "reference_position": 34,
            "original_base": "G",
            "observed_base": "T",
        }]
        res = generate_dna_structure_mapping(seq, mutations=mutations, gene="KRAS")
        self.assertTrue(res["mapped"])
        self.assertTrue(res["pdb_id"].startswith("DNA_"))
        self.assertEqual(res["chain"], "A")
        self.assertEqual(len(res["mappings"]), 1)
        self.assertEqual(res["mappings"][0]["residue_number"], 34)
        self.assertEqual(res["mappings"][0]["original_residue"], "DG")
        self.assertEqual(res["mappings"][0]["mutated_residue"], "DT")
        
        # Verify fetch_pdb_file retrieves the generated DNA structure
        cached_pdb = fetch_pdb_file(res["pdb_id"])
        self.assertIsNotNone(cached_pdb)
        self.assertIn("ATOM", cached_pdb)
        self.assertIn("COMPND", cached_pdb)
        self.assertIn("CONECT", cached_pdb)

    def test_dna_structure_cache_key_includes_deletion_span(self):
        from structure_engine import generate_dna_structure_mapping

        sequence = "ATGC"
        single_deletion = generate_dna_structure_mapping(sequence, mutations=[{
            "type": "deletion",
            "reference_position": 3,
            "reference_end_position": 3,
            "observed_position": 3,
            "original_base": "G",
            "observed_base": "-",
        }])
        double_deletion = generate_dna_structure_mapping(sequence, mutations=[{
            "type": "deletion",
            "reference_position": 3,
            "reference_end_position": 4,
            "observed_position": 3,
            "original_base": "GG",
            "observed_base": "-",
        }])

        self.assertNotEqual(single_deletion["pdb_id"], double_deletion["pdb_id"])
        self.assertEqual(single_deletion["mappings"][0]["dna_variant"], "c.3delG")
        self.assertEqual(double_deletion["mappings"][0]["dna_variant"], "c.3_4delGG")

    def test_user_short_sequence_molecular_structure_unavailable(self):
        # User test sequence: 15 bp coding for Met-Ala-Thr-Gly-Stop
        # Pos 9: T -> G (ACT -> ACG, synonymous)
        # Should not invent a protein structure and return "Molecular structure unavailable for this sequence."
        res = map_mutations_to_structure(
            gene="DEMO-1",
            pdb_id=None,
            mutations=[{
                "type": "substitution",
                "reference_position": 9,
                "original_base": "T",
                "observed_base": "G",
                "original_amino_acid": {"code1": "T", "code3": "Thr"},
                "observed_amino_acid": {"code1": "T", "code3": "Thr"},
                "category": "synonymous",
            }],
            reference_sequence="ATGGCTACTGGTTAA",
            is_coding=True,
            reading_frame=0,
        )
        self.assertFalse(res["mapped"])
        self.assertIsNone(res["pdb_id"])
        self.assertEqual(len(res["mappings"]), 0)
        self.assertIn("Molecular structure unavailable for this sequence", res["reason"])
        self.assertIn("4 amino acids", res["reason"])


if __name__ == "__main__":
    unittest.main()
