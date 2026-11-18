import sys, os
sys.path.insert(0, os.path.abspath('.'))
import json
from backend.bio_engine import (
    perform_pairwise_alignment,
    translate_dna,
    compute_protein_biochemical_telemetry,
    gc_fraction
)
from backend.dna_biophysics import santalucia_thermodynamics

benchmarks = {
    "KRAS G12D": {
        "gene": "KRAS",
        "hgvsc": "c.35G>A",
        "hgvsp": "p.Gly12Asp",
        "ref": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACG",
        "var": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGATGGCGTAGGCAAGAGTGCCTTGACG",
        "pdb_id": "6OIM",
        "consequence": "Missense mutation",
        "aa_change": "Glycine to Aspartic acid"
    },
    "BRAF V600E": {
        "gene": "BRAF",
        "hgvsc": "c.1799T>A",
        "hgvsp": "p.Val600Glu",
        "ref": "ATGGCGGCGCTGAGCGGTGGCGGTGGTGGTTGCTTGGTGGTGGAGATATTTGGT",
        "var": "ATGGCGGCGCTGAGCGGTGGCGGTGGTGGTTGCTTGGTGGTGGAGATATATGGT",
        "pdb_id": "4EHE",
        "consequence": "Missense mutation",
        "aa_change": "Valine to Glutamic acid"
    },
    "EGFR L858R": {
        "gene": "EGFR",
        "hgvsc": "c.2573T>G",
        "hgvsp": "p.Leu858Arg",
        "ref": "ATGCACCATCGAGATCTGCAGCTCTTCACACAGATAATGAAGACTGACATATGGAGCTGA",
        "var": "ATGCACCATCGAGATCGGCAGCTCTTCACACAGATAATGAAGACTGACATATGGAGCTGA",
        "pdb_id": "2ITX",
        "consequence": "Missense mutation",
        "aa_change": "Leucine to Arginine"
    },
    "TP53 R273H": {
        "gene": "TP53",
        "hgvsc": "c.818G>A",
        "hgvsp": "p.Arg273His",
        "ref": "ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGA",
        "var": "ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCACGA",
        "pdb_id": "1TUP",
        "consequence": "Missense mutation",
        "aa_change": "Arginine to Histidine"
    }
}

calculated = {}

for name, b in benchmarks.items():
    ref_seq = b["ref"]
    var_seq = b["var"]
    
    # 1. Alignment
    aln = perform_pairwise_alignment(ref_seq, var_seq)
    
    # 2. Translation
    ref_codons = translate_dna(ref_seq, reading_frame=0)
    var_codons = translate_dna(var_seq, reading_frame=0)
    
    ref_protein = "".join(c["amino_acid"]["code1"] for c in ref_codons if not c["is_stop"])
    var_protein = "".join(c["amino_acid"]["code1"] for c in var_codons if not c["is_stop"])
    
    # 3. Protein telemetry
    ref_props = compute_protein_biochemical_telemetry(ref_protein)
    var_props = compute_protein_biochemical_telemetry(var_protein)
    
    # 4. Thermodynamics
    ref_thermo = santalucia_thermodynamics(ref_seq)
    var_thermo = santalucia_thermodynamics(var_seq)
    
    # 5. GC content
    ref_gc = round(gc_fraction(ref_seq) * 100, 2)
    var_gc = round(gc_fraction(var_seq) * 100, 2)
    
    calculated[name] = {
        "gene": b["gene"],
        "hgvsc": b["hgvsc"],
        "hgvsp": b["hgvsp"],
        "pdb_id": b["pdb_id"],
        "consequence": b["consequence"],
        "aa_change": b["aa_change"],
        "ref_len": len(ref_seq),
        "var_len": len(var_seq),
        "ref_gc": ref_gc,
        "var_gc": var_gc,
        "ref_tm": round(ref_thermo["melting_temperature_c"], 2),
        "var_tm": round(var_thermo["melting_temperature_c"], 2),
        "ref_dh": round(ref_thermo["delta_h_kcal_mol"], 2),
        "var_dh": round(var_thermo["delta_h_kcal_mol"], 2),
        "ref_ds": round(ref_thermo["delta_s_cal_mol_k"], 2),
        "var_ds": round(var_thermo["delta_s_cal_mol_k"], 2),
        "ref_dg": round(ref_thermo["delta_g_37_kcal_mol"], 2),
        "var_dg": round(var_thermo["delta_g_37_kcal_mol"], 2),
        "ref_protein": ref_protein,
        "var_protein": var_protein,
        "ref_mw": round(ref_props["mass_da"], 2),
        "var_mw": round(var_props["mass_da"], 2),
        "ref_gravy": round(ref_props["gravy"], 3),
        "var_gravy": round(var_props["gravy"], 3),
        "ref_charge": round(ref_props["net_charge"], 2),
        "var_charge": round(var_props["net_charge"], 2),
        "mutations_count": len(aln.get("mutations", []))
    }

print(json.dumps(calculated, indent=2))
with open("report/calculated_benchmarks.json", "w") as f:
    json.dump(calculated, f, indent=2)
print("Data successfully generated and saved to report/calculated_benchmarks.json")
