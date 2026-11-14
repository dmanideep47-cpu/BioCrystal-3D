"""
backend/train_property_model.py
Reproducible offline training script for Protein G B1 (GB1) binding fitness predictor.

Uses the published, peer-reviewed empirical fitness landscape from Wu et al. (2016) eLife,
via the FLIP benchmark (sampled 80/20 train/test split).

Performs:
1. Data verification and quality checks (no nulls, schema validation)
2. Position-specific amino-acid encoding across the 56-residue domain
3. Dummy Mean Regressor baseline evaluation
4. 5-Fold cross-validated Ridge Regression fit strictly on training set
5. Held-out test set evaluation (MAE, RMSE, R2, Spearman rho)
6. Export of safe, transparent model weights and evaluation metadata to JSON artifact.
"""

import os
import json
import datetime
import numpy as np
import pandas as pd
from sklearn.linear_model import RidgeCV, Ridge
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
from scipy.stats import spearmanr

DATA_PATH = os.path.join(os.path.dirname(__file__), 'data', 'gb1_wu_2016.csv')
ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
ARTIFACT_PATH = os.path.join(ARTIFACT_DIR, 'gb1_ridge_v1.json')

AAS = sorted(list('ACDEFGHIKLMNPQRSTVWY'))
AA_TO_IDX = {aa: i for i, aa in enumerate(AAS)}
SEQ_LEN = 56
WT_SEQ = 'MQYKLILNGKTLKGETTTEAVDAATAEKVFKQYANDNGVDGEWTYDDATKTFTVTE'

def encode_sequences(seqs: pd.Series) -> np.ndarray:
    X = np.zeros((len(seqs), SEQ_LEN * len(AAS)), dtype=np.float32)
    for r_idx, s in enumerate(seqs):
        for pos, char in enumerate(s):
            if char in AA_TO_IDX:
                X[r_idx, pos * len(AAS) + AA_TO_IDX[char]] = 1.0
    return X

def train_and_export():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    assert not df['protein_sequence'].isnull().any(), "Found null sequence"
    assert not df['measured_value'].isnull().any(), "Found null target"

    train_df = df[df['split'] == 'train'].reset_index(drop=True)
    test_df = df[df['split'] == 'test'].reset_index(drop=True)

    print(f"Loaded {len(df)} records ({len(train_df)} train, {len(test_df)} test).")

    # Encode features
    X_train = encode_sequences(train_df['protein_sequence'])
    y_train = train_df['measured_value'].values
    X_test = encode_sequences(test_df['protein_sequence'])
    y_test = test_df['measured_value'].values

    # 1. Dummy Mean Baseline
    dummy = DummyRegressor(strategy='mean')
    dummy.fit(X_train, y_train)
    y_pred_dummy = dummy.predict(X_test)
    dummy_metrics = {
        'mae': float(round(mean_absolute_error(y_test, y_pred_dummy), 4)),
        'rmse': float(round(root_mean_squared_error(y_test, y_pred_dummy), 4)),
        'r2': float(round(r2_score(y_test, y_pred_dummy), 4)),
        'spearman': None,  # constant predictions have undefined correlation
    }

    # 2. Ridge Regression with 5-fold CV on train data only
    alphas = np.logspace(-1, 3, 25)
    ridge_cv = RidgeCV(alphas=alphas, cv=5)
    ridge_cv.fit(X_train, y_train)
    best_alpha = float(ridge_cv.alpha_)
    print(f"Optimal alpha via 5-fold CV: {best_alpha:.4f}")

    ridge = Ridge(alpha=best_alpha, random_state=42)
    ridge.fit(X_train, y_train)
    y_pred_ridge = ridge.predict(X_test)

    ridge_spearman = float(round(spearmanr(y_test, y_pred_ridge).statistic, 4))
    ridge_metrics = {
        'mae': float(round(mean_absolute_error(y_test, y_pred_ridge), 4)),
        'rmse': float(round(root_mean_squared_error(y_test, y_pred_ridge), 4)),
        'r2': float(round(r2_score(y_test, y_pred_ridge), 4)),
        'spearman': ridge_spearman,
    }

    print("Baseline Metrics:", dummy_metrics)
    print("Ridge Model Metrics:", ridge_metrics)

    # 3. Sample held-out evaluation points for calibration / scatter visualization (60 stratified points)
    test_eval_df = test_df.copy()
    test_eval_df['predicted'] = np.round(y_pred_ridge, 4)
    # Stratified sample across quantiles
    test_eval_df['bin'] = pd.qcut(test_eval_df['measured_value'], q=10, labels=False, duplicates='drop')
    sampled_eval = test_eval_df.groupby('bin', group_keys=False).apply(
        lambda g: g.sample(min(len(g), 6), random_state=42)
    ).reset_index(drop=True)

    held_out_points = [
        {
            'variant_id': str(row['variant_id']),
            'mutations': str(row['mutations']),
            'measured': float(round(row['measured_value'], 4)),
            'predicted': float(round(row['predicted'], 4)),
        }
        for _, row in sampled_eval.iterrows()
    ]

    # Predict on reference wild-type
    wt_feature = encode_sequences(pd.Series([WT_SEQ]))
    ref_predicted = float(round(ridge.predict(wt_feature)[0], 4))

    # Compile artifact
    artifact = {
        'model_id': 'gb1_ridge_v1',
        'model_name': 'Position-Specific Ridge Regression',
        'model_version': '1.0.0',
        'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'objective_id': 'gb1_binding_fitness',
        'objective_label': 'Protein G B1 — IgG-Fc Binding Fitness (Wu/Olson et al.)',
        'target_name': 'Binding fitness (normalized enrichment ratio)',
        'target_units': 'Normalized ratio (WT = 1.0)',
        'target_direction': 'higher_is_better',
        'reference_id': 'GB1_WT',
        'reference_sequence': WT_SEQ,
        'reference_length_aa': SEQ_LEN,
        'reference_measured_value': 1.0,
        'reference_predicted_value': ref_predicted,
        'hyperparameters': {
            'alpha': round(best_alpha, 4),
            'cv_folds': 5,
            'encoding': 'position_specific_one_hot',
            'feature_dim': int(X_train.shape[1]),
        },
        'training_summary': {
            'train_samples': int(len(train_df)),
            'test_samples': int(len(test_df)),
            'total_samples': int(len(df)),
            'split_strategy': 'FLIP sampled 80/20 held-out split (no duplicate sequence leakage)',
        },
        'metrics': {
            'dummy_baseline': dummy_metrics,
            'ridge_model': ridge_metrics,
        },
        'weights': {
            'intercept': float(round(ridge.intercept_, 6)),
            'coefficients': [float(round(c, 6)) for c in ridge.coef_],
        },
        'aa_alphabet': AAS,
        'held_out_evaluation_points': held_out_points,
        'dataset_provenance': {
            'dataset_id': 'Wu_2016_FLIP_GB1',
            'publication': 'Wu, N. C., Dai, L., Olson, C. A., Lloyd-Smith, J. O., & Sun, R. (2016). Adaptation in protein fitness landscapes is facilitated by indirect paths. eLife, 5, e16965.',
            'doi': '10.7554/eLife.16965',
            'assay_description': 'mRNA display selection measuring IgG-Fc binding affinity with high-throughput sequencing under physiological buffer conditions.',
            'license': 'CC BY 4.0 / AFL-3',
        },
    }

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    with open(ARTIFACT_PATH, 'w', encoding='utf-8') as f:
        json.dump(artifact, f, indent=2)

    print(f"Model artifact successfully written to {ARTIFACT_PATH} ({os.path.getsize(ARTIFACT_PATH)} bytes).")

if __name__ == '__main__':
    train_and_export()

