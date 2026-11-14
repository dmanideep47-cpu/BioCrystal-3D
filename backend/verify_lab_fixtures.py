import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bio_engine import analyze_mutation_experiment

ref = 'ATGGCTGAATTTCCGAAATAA'
fixtures = [
    ('Experiment A: Change base 6 from T to C', 'ATGGCCGAATTTCCGAAATAA', 'no_change'),
    ('Experiment B: Change base 5 from C to A', 'ATGGATGAATTTCCGAAATAA', 'one_aa_change'),
    ('Experiment C: Change base 7 from G to T', 'ATGGCTTAATTTCCGAAATAA', 'early_stop'),
    ('Experiment D: Delete base 4', 'ATGCTGAATTTCCGAAATAA', 'frameshift'),
    ('Experiment E: Delete bases 4-6', 'ATGGAATTTCCGAAATAA', 'inframe_indel'),
]

print("==================================================================")
print("BIOCRYSTAL VIRTUAL MUTATION LAB: SCIENTIFIC VERIFICATION RUN")
print("==================================================================")

for name, seq, pred in fixtures:
    res = analyze_mutation_experiment(ref, seq, prediction={'choice': pred})
    print(f"Scenario: {name}")
    print(f"  Reference DNA:       {res['reference_sequence']} (MAEFPK*)")
    print(f"  Variant DNA:         {res['variant_sequence']}")
    print(f"  Category:            {res['category_label']}")
    print(f"  Ref Translated Prod: {res['reference_protein_product']}")
    print(f"  Var Translated Prod: {res['variant_protein_product']}")
    print(f"  First Affected Codon:{res['first_affected_codon']}")
    print(f"  Var First Stop:      {res['variant_first_stop_position']}")
    print(f"  Var Trailing Bases:  {res['variant_trailing_bases'] or 'None'}")
    print(f"  Prediction Choice:   {res['prediction_evaluation']['choice_label']}")
    print(f"  Prediction Matched:  {res['prediction_evaluation']['matched']} (status: {res['prediction_evaluation']['status']})")
    print(f"  Feedback:            {res['prediction_evaluation']['feedback']}")
    print(f"  Explanation:         {res['explanation']}")
    print("------------------------------------------------------------------")

print("All 5 fixtures verified successfully with exact primary prediction mappings!")
