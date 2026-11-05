import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app


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
            "reading_frame": 0
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["alignment"]["mutation_count"], 1)
        mut = data["alignment"]["mutations"][0]
        self.assertEqual(mut["reference_position"], 9)
        self.assertEqual(mut["category"], "synonymous")

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


if __name__ == "__main__":
    unittest.main()

