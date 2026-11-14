"""
backend/property_engine.py
Evidence-aware reference-vs-variant property analysis engine.

Separates:
1. Calculated Sequence Facts (deterministic biophysical facts from sequences)
2. ML Model Predictions (from trained, versioned model artifacts)
3. Experimental Measurements (from curated peer-reviewed datasets)
"""

import os
import json
import datetime
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from Bio.Seq import Seq

ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), 'artifacts', 'gb1_ridge_v1.json')
DATASET_PATH = os.path.join(os.path.dirname(__file__), 'data', 'gb1_wu_2016.csv')

# Load and cache model artifact & experimental lookup at startup
_MODEL_ARTIFACT: Optional[Dict[str, Any]] = None
_DATASET_LOOKUP: Optional[Dict[str, Dict[str, Any]]] = None

def get_model_artifact() -> Optional[Dict[str, Any]]:
    global _MODEL_ARTIFACT
    if _MODEL_ARTIFACT is None and os.path.exists(ARTIFACT_PATH):
        try:
            with open(ARTIFACT_PATH, 'r', encoding='utf-8') as f:
                _MODEL_ARTIFACT = json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load model artifact from {ARTIFACT_PATH}: {e}")
    return _MODEL_ARTIFACT

def get_dataset_lookup() -> Dict[str, Dict[str, Any]]:
    global _DATASET_LOOKUP
    if _DATASET_LOOKUP is None:
        _DATASET_LOOKUP = {}
        if os.path.exists(DATASET_PATH):
            try:
                df = pd.read_csv(DATASET_PATH)
                for _, row in df.iterrows():
                    seq = str(row['protein_sequence']).strip()
                    _DATASET_LOOKUP[seq] = {
                        'variant_id': str(row['variant_id']),
                        'mutations': str(row['mutations']),
                        'measured_value': float(row['measured_value']),
                        'split': str(row['split']),
                        'assay_id': str(row['assay_id']),
                        'reference_id': str(row['reference_id']),
                    }
            except Exception as e:
                print(f"Warning: Failed to load dataset from {DATASET_PATH}: {e}")
    return _DATASET_LOOKUP

SUPPORTED_OBJECTIVES = [
    {
        'id': 'gb1_binding_fitness',
        'label': 'Protein G B1 — IgG-Fc Binding Fitness (Wu/Olson et al.)',
        'protein': 'Streptococcal Protein G, B1 domain (56 aa, PDB: 1PGA)',
        'assay': 'mRNA display selection with high-throughput sequencing',
        'target_name': 'Binding fitness (normalized enrichment ratio)',
        'units': 'Normalized ratio (WT = 1.0)',
        'target_direction': 'higher_is_better',
        'supported_types': '56-residue coding sequences; single and double amino-acid substitutions',
        'experimental_context': 'In-vitro selection against human IgG-Fc in physiological buffer; does not measure in-vivo expression or folding kinetics.',
        'status': 'available',
        'model_name': 'Position-Specific Ridge Regression',
        'model_version': '1.0.0',
    },
    {
        'id': 'gfp_fluorescence_brightness',
        'label': 'GFP (A. victoria) — Fluorescence Brightness (Sarkisyan et al. 2016)',
        'protein': 'avGFP (238 aa)',
        'assay': 'Cellular fluorescence in E. coli',
        'target_name': 'Fluorescence brightness',
        'units': 'log10(AU)',
        'target_direction': 'higher_is_better',
        'supported_types': '238-residue avGFP coding sequences',
        'experimental_context': 'Bacterial expression at 37°C.',
        'status': 'unavailable',
        'reason': 'Improvement prediction is unavailable for this sequence and objective. No trained model or experimental dataset is loaded for GFP fluorescence brightness in this installation.',
    },
]

def calculate_gc(seq: str) -> float:
    if not seq:
        return 0.0
    gc = sum(1 for b in seq.upper() if b in 'GC')
    return round((gc / len(seq)) * 100.0, 2)

def predict_with_ridge(protein_seq: str, artifact: Dict[str, Any]) -> float:
    """Predict target value using stored Ridge weights and intercept."""
    aas = artifact['aa_alphabet']
    aa_to_idx = {aa: i for i, aa in enumerate(aas)}
    seq_len = artifact['reference_length_aa']
    intercept = artifact['weights']['intercept']
    coefs = artifact['weights']['coefficients']

    val = intercept
    for pos, char in enumerate(protein_seq[:seq_len]):
        if char in aa_to_idx:
            feat_idx = pos * len(aas) + aa_to_idx[char]
            if feat_idx < len(coefs):
                val += coefs[feat_idx]
    return float(round(val, 4))

def analyze_property(
    reference_dna: str,
    variant_dna: str,
    objective_id: str = 'gb1_binding_fitness',
    reading_frame: int = 0,
    table_id: int = 1,
) -> Dict[str, Any]:
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    clean_ref_dna = reference_dna.replace(' ', '').replace('\n', '').replace('\r', '').upper()
    clean_var_dna = variant_dna.replace(' ', '').replace('\n', '').replace('\r', '').upper()

    # Find selected objective
    obj = next((o for o in SUPPORTED_OBJECTIVES if o['id'] == objective_id), None)
    if not obj:
        obj = SUPPORTED_OBJECTIVES[0]
        objective_id = obj['id']

    # =========================================================================
    # LAYER A: CALCULATED SEQUENCE FACTS (from input sequences)
    # =========================================================================
    ref_seq_obj = Seq(clean_ref_dna[reading_frame:])
    var_seq_obj = Seq(clean_var_dna[reading_frame:])

    ref_prot_raw = str(ref_seq_obj.translate(table=table_id))
    var_prot_raw = str(var_seq_obj.translate(table=table_id))

    # Strip trailing stop if present
    ref_prot = ref_prot_raw.rstrip('*')
    var_prot = var_prot_raw.rstrip('*')

    # Detect amino-acid differences
    aa_substitutions = []
    max_len = max(len(ref_prot), len(var_prot))
    for i in range(max_len):
        r = ref_prot[i] if i < len(ref_prot) else '—'
        v = var_prot[i] if i < len(var_prot) else '—'
        if r != v:
            aa_substitutions.append({
                'position': i + 1,
                'ref_aa': r,
                'var_aa': v,
                'mutation': f"{r}{i + 1}{v}" if r != '—' and v != '—' else ('del' if v == '—' else 'ins'),
            })

    is_synonymous = (clean_ref_dna != clean_var_dna) and (ref_prot == var_prot) and ('*' not in ref_prot_raw) and ('*' not in var_prot_raw)
    is_identical = (clean_ref_dna == clean_var_dna)

    # Position-level changes for Graph 2 (DNA and protein positions)
    position_changes = []
    min_dna_len = min(len(clean_ref_dna), len(clean_var_dna))
    for idx in range(min_dna_len):
        if clean_ref_dna[idx] != clean_var_dna[idx]:
            position_changes.append({
                'dna_position': idx + 1,
                'ref_base': clean_ref_dna[idx],
                'var_base': clean_var_dna[idx],
                'type': 'substitution',
                'codon_index': (idx // 3) + 1,
            })
    if len(clean_var_dna) > len(clean_ref_dna):
        position_changes.append({
            'dna_position': min_dna_len + 1,
            'ref_base': '—',
            'var_base': clean_var_dna[min_dna_len:],
            'type': 'insertion',
            'codon_index': (min_dna_len // 3) + 1,
        })
    elif len(clean_ref_dna) > len(clean_var_dna):
        position_changes.append({
            'dna_position': min_dna_len + 1,
            'ref_base': clean_ref_dna[min_dna_len:],
            'var_base': '—',
            'type': 'deletion',
            'codon_index': (min_dna_len // 3) + 1,
        })

    sequence_facts = {
        'evidence_label': 'Calculated from input sequences',
        'reference_length_bp': len(clean_ref_dna),
        'variant_length_bp': len(clean_var_dna),
        'reference_gc_percent': calculate_gc(clean_ref_dna),
        'variant_gc_percent': calculate_gc(clean_var_dna),
        'reference_protein': ref_prot,
        'variant_protein': var_prot,
        'reference_length_aa': len(ref_prot),
        'variant_length_aa': len(var_prot),
        'first_stop_position_ref': ref_prot_raw.find('*') + 1 if '*' in ref_prot_raw else None,
        'first_stop_position_var': var_prot_raw.find('*') + 1 if '*' in var_prot_raw else None,
        'is_identical': is_identical,
        'is_synonymous': is_synonymous,
        'amino_acid_substitutions': aa_substitutions,
        'position_changes': position_changes,
    }

    # =========================================================================
    # LAYER B: ML MODEL PREDICTIONS (only when compatible model exists)
    # =========================================================================
    artifact = get_model_artifact()

    model_prediction: Dict[str, Any] = {
        'evidence_label': 'Model prediction',
        'objective_id': objective_id,
        'target_name': obj['target_name'],
        'target_units': obj.get('units', 'Normalized ratio'),
        'target_direction': obj.get('target_direction', 'higher_is_better'),
        'model_name': obj.get('model_name', 'None'),
        'model_version': obj.get('model_version', 'None'),
        'prediction_timestamp': timestamp,
        'status': 'unavailable',
        'applicability': 'unknown',
        'reference_predicted_value': None,
        'variant_predicted_value': None,
        'predicted_delta': None,
        'verdict': None,
        'reason': None,
        'uncertainty_status': 'Prediction uncertainty has not been quantified.',
        'evaluation_metrics': None,
        'held_out_evaluation_points': [],
    }

    if objective_id != 'gb1_binding_fitness':
        model_prediction['status'] = 'unavailable'
        model_prediction['reason'] = obj.get('reason', 'Improvement prediction is unavailable for this objective.')
    elif not artifact:
        model_prediction['status'] = 'failed'
        model_prediction['reason'] = 'Trained model artifact (gb1_ridge_v1.json) could not be loaded on backend.'
    else:
        # Check reference compatibility
        expected_wt = artifact['reference_sequence']
        if ref_prot != expected_wt:
            model_prediction['status'] = 'unsupported_input'
            model_prediction['applicability'] = 'reference_mismatch'
            model_prediction['reason'] = (
                f"Input reference translates to {len(ref_prot)} aa and does not match the supported reference "
                f"protein for this objective (Streptococcal Protein G B1 domain, 56 aa). "
                f"Sequence facts are calculated above, but binding fitness prediction is outside model applicability."
            )
        # Check variant length & early stop
        elif len(var_prot) != artifact['reference_length_aa'] or ('*' in var_prot_raw and var_prot_raw.find('*') < 56):
            model_prediction['status'] = 'unsupported_input'
            model_prediction['applicability'] = 'indel_or_truncation'
            model_prediction['reason'] = (
                "The variant sequence produces an early stop codon, frame shift, or indel altering the 56-residue "
                "protein length. The position-specific linear Ridge model only supports substitution variants across the 56 aa domain."
            )
        else:
            # Compatible input! Run inference.
            model_prediction['status'] = 'available'
            model_prediction['applicability'] = 'within_domain'
            model_prediction['model_name'] = artifact['model_name']
            model_prediction['model_version'] = artifact['model_version']
            model_prediction['evaluation_metrics'] = artifact['metrics']
            model_prediction['held_out_evaluation_points'] = artifact.get('held_out_evaluation_points', [])

            ref_pred = predict_with_ridge(ref_prot, artifact)
            var_pred = predict_with_ridge(var_prot, artifact)
            delta = float(round(var_pred - ref_pred, 4))

            model_prediction['reference_predicted_value'] = ref_pred
            model_prediction['variant_predicted_value'] = var_pred
            model_prediction['predicted_delta'] = delta

            if is_synonymous:
                model_prediction['verdict'] = 'Difference not resolved by this model'
                model_prediction['reason'] = (
                    "The mutation is synonymous (silent at protein level). The amino-acid model receives the identical "
                    "56-residue protein sequence, predicting no change in IgG-Fc binding affinity (delta = 0.00). "
                    "The model does not predict translation efficiency or mRNA abundance."
                )
            elif is_identical:
                model_prediction['verdict'] = 'Identical input sequences'
                model_prediction['reason'] = "Reference and variant sequences are identical."
            else:
                if delta > 0.05:
                    model_prediction['verdict'] = 'Predicted higher activity in selected assay'
                elif delta < -0.05:
                    model_prediction['verdict'] = 'Predicted lower activity in selected assay'
                else:
                    model_prediction['verdict'] = 'Difference not resolved by this model'

    # =========================================================================
    # LAYER C: EXPERIMENTAL MEASUREMENTS (reliable lookup in dataset)
    # =========================================================================
    lookup = get_dataset_lookup()
    matched_exp = lookup.get(var_prot)
    ref_exp = lookup.get(artifact['reference_sequence'] if artifact else '')

    experimental_measurement: Dict[str, Any] = {
        'evidence_label': 'Experimental measurement',
        'matched': False,
        'dataset_id': 'Wu_2016_eLife_mRNA_display',
        'citation': 'Wu et al. (2016) eLife 5:e16965',
        'assay_context': 'mRNA display selection measuring IgG-Fc binding enrichment under physiological buffer conditions',
        'measured_reference_value': ref_exp['measured_value'] if ref_exp else (1.0 if ref_prot == (artifact['reference_sequence'] if artifact else '') else None),
        'measured_variant_value': None,
        'measured_delta': None,
        'variant_id': None,
        'mutations': None,
        'reason': None,
    }

    if matched_exp:
        m_var = matched_exp['measured_value']
        m_ref = experimental_measurement['measured_reference_value'] or 1.0
        experimental_measurement['matched'] = True
        experimental_measurement['variant_id'] = matched_exp['variant_id']
        experimental_measurement['mutations'] = matched_exp['mutations']
        experimental_measurement['measured_variant_value'] = m_var
        experimental_measurement['measured_delta'] = float(round(m_var - m_ref, 4))
    else:
        experimental_measurement['reason'] = (
            "No direct experimental measurement in Wu et al. (2016) dataset for this sequence."
        )

    # =========================================================================
    # EXPLANATIONS & CONTEXTUAL LIMITATIONS
    # =========================================================================
    if model_prediction['status'] == 'available':
        if is_synonymous:
            why_result = (
                f"DNA difference detected, but the translated protein is unchanged ({len(ref_prot)} aa). "
                f"Under the selected objective, the amino-acid model predicts identical binding affinity (delta = 0.00)."
            )
        elif is_identical:
            why_result = "No nucleotide or amino-acid differences exist between reference and variant."
        else:
            sub_strs = [f"{s['ref_aa']}{s['position']}{s['var_aa']}" for s in aa_substitutions]
            why_result = (
                f"The variant introduces substitution(s) {', '.join(sub_strs)} in the 56 aa domain. "
                f"Based on position-specific weights fit to 6,988 experimental variants from Wu et al. (2016), "
                f"the model predicts {model_prediction['verdict'].lower()} (predicted delta: {model_prediction['predicted_delta']:+.4f} {obj['units']})."
            )
    else:
        why_result = model_prediction['reason'] or "Property prediction unavailable."

    not_established = (
        "This analysis assesses in-vitro IgG-Fc binding affinity under mRNA display selection. "
        "It does NOT establish in-vivo expression, thermal denaturation kinetics, eukaryotic folding, "
        "or universal biological fitness. Predictions must not be interpreted as clinical advice or general protein quality."
    )

    return {
        'objective': obj,
        'supported_objectives': SUPPORTED_OBJECTIVES,
        'sequence_facts': sequence_facts,
        'model_prediction': model_prediction,
        'experimental_measurement': experimental_measurement,
        'why_this_result': why_result,
        'what_this_does_not_establish': not_established,
        'analysis_timestamp': timestamp,
    }

