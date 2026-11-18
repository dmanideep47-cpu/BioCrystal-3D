import sys, os
sys.path.insert(0, os.path.abspath('.'))
import json
from backend.bio_engine import (
    align_sequences_nw,
    detect_and_classify_mutations,
    translate_in_silico,
    compute_protein_physicochemical_properties,
    calculate_nearest_neighbor_thermodynamics,
    BENCHMARK_PRESETS
)

results = {}

for k, v in BENCHMARK_PRESETS.items():
    ref = v['reference']
    mut = v['mutated']
    gene = v['gene']
    name = v['name']
    
    align = align_sequences_nw(ref, mut)
    mutations = detect_and_classify_mutations(align['aligned_ref'], align['aligned_obs'], ref, mut)
    ref_trans = translate_in_silico(ref)
    mut_trans = translate_in_silico(mut)
    ref_props = compute_protein_physicochemical_properties(ref_trans.get('protein_sequence', ''))
    mut_props = compute_protein_physicochemical_properties(mut_trans.get('protein_sequence', ''))
    ref_thermo = calculate_nearest_neighbor_thermodynamics(ref)
    mut_thermo = calculate_nearest_neighbor_thermodynamics(mut)
    
    results[k] = {
        'name': name,
        'gene': gene,
        'ref_gc': round(ref_thermo.get('gc_content_percent', ref_thermo.get('gc_content', 0.0)), 2),
        'mut_gc': round(mut_thermo.get('gc_content_percent', mut_thermo.get('gc_content', 0.0)), 2),
        'ref_tm': round(ref_thermo.get('melting_temperature_celsius', ref_thermo.get('melting_temperature_c', 0.0)), 2),
        'mut_tm': round(mut_thermo.get('melting_temperature_celsius', mut_thermo.get('melting_temperature_c', 0.0)), 2),
        'ref_dg': round(ref_thermo.get('gibbs_free_energy_kcal_mol', 0.0), 2),
        'mut_dg': round(mut_thermo.get('gibbs_free_energy_kcal_mol', 0.0), 2),
        'ref_mw': round(ref_props.get('molecular_weight_da', 0.0), 2),
        'mut_mw': round(mut_props.get('molecular_weight_da', 0.0), 2),
        'ref_gravy': round(ref_props.get('gravy_score', 0.0), 3),
        'mut_gravy': round(mut_props.get('gravy_score', 0.0), 3),
        'ref_charge': round(ref_props.get('net_charge_ph7', 0.0), 2),
        'mut_charge': round(mut_props.get('net_charge_ph7', 0.0), 2),
        'mutations': [
            {
                'consequence': m.get('mutation_consequence'),
                'type': m.get('type'),
                'orig_aa': m.get('original_amino_acid'),
                'mut_aa': m.get('mutated_amino_acid'),
                'codon_pos': m.get('codon_number'),
                'hgvsc': m.get('hgvsc_nomenclature'),
                'hgvsp': m.get('hgvsp_nomenclature')
            }
            for m in mutations
        ]
    }

print(json.dumps(results, indent=2))
with open('report/benchmark_metrics.json', 'w') as f:
    json.dump(results, f, indent=2)
