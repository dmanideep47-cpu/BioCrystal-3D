import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dna_structure_builder import build_b_dna_pdb, parse_pdb_atoms
from dna_biophysics import compute_dna_biophysics, santalucia_thermodynamics, mismatch_free_energy_penalty


class TestDNABiophysicsAndStructure(unittest.TestCase):

    def test_build_b_dna_pdb_basic(self):
        seq = "ATGC"
        pdb_text, _, metrics = build_b_dna_pdb(seq)
        self.assertIn("HEADER    DNA DOUBLE HELIX", pdb_text)
        self.assertIn("COMPND    MOL_ID: 1; MOLECULE: B-DNA DUPLEX", pdb_text)
        self.assertIn("TER", pdb_text)
        self.assertIn("END", pdb_text)
        
        # Verify both Chain A and Chain B are present
        self.assertIn(" A ", pdb_text)
        self.assertIn(" B ", pdb_text)
        
        # Check atoms
        atoms = parse_pdb_atoms(pdb_text)
        self.assertGreater(len(atoms), 0)
        # 4 bp: DA(21)+DT(20)+DG(22)+DC(19) = 82 on chain A, identical on chain B = 164 atoms
        self.assertEqual(len(atoms), 164)
        self.assertEqual(metrics["base_pairs"], 4)

    def test_build_b_dna_pdb_with_mutations(self):
        seq = "ATGACTGAATAT"
        mutations = [
            {"reference_position": 3, "reference_bases": "G", "observed_bases": "T", "category": "missense"}
        ]
        pdb_text, mapped_residues, _ = build_b_dna_pdb(seq, mutations=mutations)
        self.assertIn("REMARK 200 MUTATION 1: REF_POS=3", pdb_text)
        # Mutated nucleotide atoms should have higher B-factor
        atoms = parse_pdb_atoms(pdb_text)
        mutated_atoms = [a for a in atoms if a["chain"] == "A" and a["res_seq"] == 3]
        self.assertTrue(all(a["b_factor"] >= 45.0 for a in mutated_atoms))

    def test_santalucia_thermodynamics(self):
        # Known sequence: CGCG
        # All GC pairs, high stability
        thermo_gc = santalucia_thermodynamics("CGCGCGCG")
        self.assertLess(thermo_gc["delta_g_37_kcal_mol"], 0)
        self.assertGreater(thermo_gc["melting_temperature_c"], 40.0)

        # High AT sequence has lower Tm
        thermo_at = santalucia_thermodynamics("ATATATAT")
        self.assertLess(thermo_at["melting_temperature_c"], thermo_gc["melting_temperature_c"])

    def test_mismatch_destabilization(self):
        # GT wobble mismatch should be penalizing
        penalty = mismatch_free_energy_penalty("TG", "GT")
        self.assertGreaterEqual(penalty, 0.0)

    def test_compute_dna_biophysics_full(self):
        seq = "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG"
        mutations = [
            {"reference_position": 34, "reference_bases": "G", "observed_bases": "T", "category": "missense"}
        ]
        res = compute_dna_biophysics(seq, mutations=mutations)
        self.assertIn("thermodynamics", res)
        self.assertIn("morphometrics", res)
        self.assertIn("spectroscopic_profile", res)
        self.assertIn("swiss_radar_scores", res)

        thermo = res["thermodynamics"]
        self.assertIn("delta_h_kcal_mol", thermo)
        self.assertIn("delta_s_cal_mol_k", thermo)
        self.assertIn("delta_g_37_kcal_mol", thermo)
        self.assertIn("melting_temperature_c", thermo)

        morph = res["morphometrics"]
        self.assertEqual(morph["base_pairs"], len(seq))
        self.assertAlmostEqual(morph["helical_pitch_angstrom"], 33.8)
        self.assertAlmostEqual(morph["duplex_diameter_angstrom"], 20.0)

        spectro = res["spectroscopic_profile"]
        self.assertGreater(spectro["molar_extinction_260_m_cm"], 100000)
        self.assertGreater(spectro["a260_conversion_ug_ml"], 30.0)

        radar = res["swiss_radar_scores"]
        self.assertTrue(0 <= radar["biocrystal_dna_index"] <= 100)
        self.assertTrue(0 <= radar["thermostability"] <= 100)
        self.assertTrue(0 <= radar["duplex_rigidity"] <= 100)


if __name__ == "__main__":
    unittest.main()
