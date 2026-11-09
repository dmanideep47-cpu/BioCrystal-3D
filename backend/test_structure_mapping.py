import unittest
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
                "original_amino_acid": {"code3": "Gly", "category": "special"},
                "observed_amino_acid": {"code3": "Cys", "category": "special"},
                "category": "missense",
            }
        ]
        res = map_mutations_to_structure(
            gene="KRAS",
            pdb_id="6OIM",
            mutations=mutations,
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
        self.assertEqual(mapping["impact_category"], "high")

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


if __name__ == "__main__":
    unittest.main()

