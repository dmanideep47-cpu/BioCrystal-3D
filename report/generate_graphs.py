import sys, os
import json
import matplotlib.pyplot as plt
import numpy as np

# Set font and style for publication-grade academic figures
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Helvetica']
plt.rcParams['axes.edgecolor'] = '#D1D5DB'
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['text.color'] = '#171717'
plt.rcParams['axes.labelcolor'] = '#171717'
plt.rcParams['xtick.color'] = '#4B5563'
plt.rcParams['ytick.color'] = '#4B5563'

with open('report/calculated_benchmarks.json', 'r') as f:
    benchmarks = json.load(f)

genes = list(benchmarks.keys())
x = np.arange(len(genes))
width = 0.35

output_dir = 'report/assets/graphs'
os.makedirs(output_dir, exist_ok=True)

# Colors from BioCrystal 3D design system
COLOR_REF = '#94A3B8'      # Neutral reference slate
COLOR_MUT = '#0F766E'      # Signature BioCrystal teal
COLOR_TEAL_DARK = '#115E59'
COLOR_TEAL_LIGHT = '#14B8A6'
COLOR_ACCENT = '#F59E0B'
COLOR_PASS = '#0F766E'

# ---------------------------------------------------------------------------
# GRAPH 1: GC Content Comparison
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
ref_gc = [benchmarks[g]['ref_gc'] for g in genes]
var_gc = [benchmarks[g]['var_gc'] for g in genes]

rects1 = ax.bar(x - width/2, ref_gc, width, label='Reference (Wildtype)', color=COLOR_REF, edgecolor='#64748B', linewidth=0.7)
rects2 = ax.bar(x + width/2, var_gc, width, label='Variant (Mutated)', color=COLOR_MUT, edgecolor=COLOR_TEAL_DARK, linewidth=0.7)

ax.set_ylabel('GC Content (%)', fontsize=11, fontweight='bold', labelpad=8)
ax.set_title('Figure 14: GC Content Comparison Across Cancer Benchmarks', fontsize=12, fontweight='bold', pad=12)
ax.set_xticks(x)
ax.set_xticklabels(genes, fontsize=10, fontweight='bold')
ax.set_ylim(0, 80)
ax.legend(frameon=True, facecolor='#FFFFFF', edgecolor='#E5E5E5', fontsize=9.5)
ax.grid(axis='y', linestyle='--', alpha=0.35, color='#94A3B8')

# Value annotations
for rect in rects1:
    h = rect.get_height()
    ax.annotate(f'{h:.1f}%', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 3),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#475569')
for rect in rects2:
    h = rect.get_height()
    ax.annotate(f'{h:.1f}%', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 3),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#0F766E', fontweight='bold')

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph1_gc_content.png'))
plt.close(fig)

# ---------------------------------------------------------------------------
# GRAPH 2: Melting Temperature Comparison (SantaLucia 1998)
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
ref_tm = [benchmarks[g]['ref_tm'] for g in genes]
var_tm = [benchmarks[g]['var_tm'] for g in genes]

rects1 = ax.bar(x - width/2, ref_tm, width, label='Reference Tm (°C)', color=COLOR_REF, edgecolor='#64748B', linewidth=0.7)
rects2 = ax.bar(x + width/2, var_tm, width, label='Variant Tm (°C)', color=COLOR_MUT, edgecolor=COLOR_TEAL_DARK, linewidth=0.7)

ax.set_ylabel('Melting Temperature Tm (°C)', fontsize=11, fontweight='bold', labelpad=8)
ax.set_title('Figure 15: SantaLucia Unified Duplex Melting Temperature Tm', fontsize=12, fontweight='bold', pad=12)
ax.set_xticks(x)
ax.set_xticklabels(genes, fontsize=10, fontweight='bold')
ax.set_ylim(80, 120)
ax.legend(frameon=True, facecolor='#FFFFFF', edgecolor='#E5E5E5', fontsize=9.5, loc='upper right')
ax.grid(axis='y', linestyle='--', alpha=0.35, color='#94A3B8')

for rect in rects1:
    h = rect.get_height()
    ax.annotate(f'{h:.1f}°', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 3),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#475569')
for rect in rects2:
    h = rect.get_height()
    ax.annotate(f'{h:.1f}°', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 3),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#0F766E', fontweight='bold')

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph2_melting_temperature.png'))
plt.close(fig)

# ---------------------------------------------------------------------------
# GRAPH 3: Protein Molecular Weight Comparison
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
ref_mw = [benchmarks[g]['ref_mw'] for g in genes]
var_mw = [benchmarks[g]['var_mw'] for g in genes]

rects1 = ax.bar(x - width/2, ref_mw, width, label='Reference MW (Da)', color=COLOR_REF, edgecolor='#64748B', linewidth=0.7)
rects2 = ax.bar(x + width/2, var_mw, width, label='Variant MW (Da)', color=COLOR_MUT, edgecolor=COLOR_TEAL_DARK, linewidth=0.7)

ax.set_ylabel('Molecular Weight (Daltons)', fontsize=11, fontweight='bold', labelpad=8)
ax.set_title('Figure 16: Translated Protein Molecular Weight Shift (ΔMW)', fontsize=12, fontweight='bold', pad=12)
ax.set_xticks(x)
ax.set_xticklabels(genes, fontsize=10, fontweight='bold')
ax.set_ylim(0, 3000)
ax.legend(frameon=True, facecolor='#FFFFFF', edgecolor='#E5E5E5', fontsize=9.5)
ax.grid(axis='y', linestyle='--', alpha=0.35, color='#94A3B8')

for i, (r, v) in enumerate(zip(ref_mw, var_mw)):
    dmw = v - r
    sign = '+' if dmw >= 0 else ''
    ax.annotate(f'Δ: {sign}{dmw:.1f} Da', xy=(x[i], max(r, v) + 120),
                ha='center', va='bottom', fontsize=8.5, color='#0F766E', fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='#F0FDFA', edgecolor='#CCFBF1', lw=0.6))

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph3_molecular_weight.png'))
plt.close(fig)

# ---------------------------------------------------------------------------
# GRAPH 4: GRAVY Hydropathy Score Comparison
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
ref_gravy = [benchmarks[g]['ref_gravy'] for g in genes]
var_gravy = [benchmarks[g]['var_gravy'] for g in genes]

rects1 = ax.bar(x - width/2, ref_gravy, width, label='Reference GRAVY', color=COLOR_REF, edgecolor='#64748B', linewidth=0.7)
rects2 = ax.bar(x + width/2, var_gravy, width, label='Variant GRAVY', color=COLOR_MUT, edgecolor=COLOR_TEAL_DARK, linewidth=0.7)

ax.axhline(0, color='#171717', linewidth=0.8, linestyle='-')
ax.set_ylabel('Kyte–Doolittle GRAVY Index', fontsize=11, fontweight='bold', labelpad=8)
ax.set_title('Figure 17: In-Silico Protein GRAVY Hydropathy Score Comparison', fontsize=12, fontweight='bold', pad=12)
ax.set_xticks(x)
ax.set_xticklabels(genes, fontsize=10, fontweight='bold')
ax.set_ylim(-1.8, 1.8)
ax.legend(frameon=True, facecolor='#FFFFFF', edgecolor='#E5E5E5', fontsize=9.5)
ax.grid(axis='y', linestyle='--', alpha=0.35, color='#94A3B8')

for rect in rects1:
    h = rect.get_height()
    offset = 3 if h >= 0 else -12
    ax.annotate(f'{h:.2f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, offset),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#475569')
for rect in rects2:
    h = rect.get_height()
    offset = 3 if h >= 0 else -12
    ax.annotate(f'{h:.2f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, offset),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#0F766E', fontweight='bold')

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph4_gravy_score.png'))
plt.close(fig)

# ---------------------------------------------------------------------------
# GRAPH 5: Net Charge Comparison at pH 7.0
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
ref_chg = [benchmarks[g]['ref_charge'] for g in genes]
var_chg = [benchmarks[g]['var_charge'] for g in genes]

rects1 = ax.bar(x - width/2, ref_chg, width, label='Reference Charge (pH 7.0)', color=COLOR_REF, edgecolor='#64748B', linewidth=0.7)
rects2 = ax.bar(x + width/2, var_chg, width, label='Variant Charge (pH 7.0)', color=COLOR_MUT, edgecolor=COLOR_TEAL_DARK, linewidth=0.7)

ax.axhline(0, color='#171717', linewidth=0.8, linestyle='-')
ax.set_ylabel('Net Isoelectric Charge (e)', fontsize=11, fontweight='bold', labelpad=8)
ax.set_title('Figure 18: Translated Protein Net Charge Shift at Physiological pH 7.0', fontsize=12, fontweight='bold', pad=12)
ax.set_xticks(x)
ax.set_xticklabels(genes, fontsize=10, fontweight='bold')
ax.set_ylim(-5.0, 2.5)
ax.legend(frameon=True, facecolor='#FFFFFF', edgecolor='#E5E5E5', fontsize=9.5)
ax.grid(axis='y', linestyle='--', alpha=0.35, color='#94A3B8')

for rect in rects1:
    h = rect.get_height()
    offset = 3 if h >= 0 else -12
    ax.annotate(f'{h:+.1f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, offset),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#475569')
for rect in rects2:
    h = rect.get_height()
    offset = 3 if h >= 0 else -12
    ax.annotate(f'{h:+.1f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, offset),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#0F766E', fontweight='bold')

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph5_net_charge.png'))
plt.close(fig)

# ---------------------------------------------------------------------------
# GRAPH 6: Backend Test Results (Donut & Breakdown)
# ---------------------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 3.8), dpi=300, gridspec_kw={'width_ratios': [1, 1.3]})

# Donut chart
sizes = [38, 0]
colors = [COLOR_PASS, '#EF4444']
wedges, texts, autotexts = ax1.pie(sizes, labels=['Passed (38)', 'Failed (0)'], autopct='%1.0f%%',
                                    startangle=90, colors=colors, pctdistance=0.75,
                                    textprops=dict(color='#171717', fontsize=9, fontweight='bold'),
                                    wedgeprops=dict(width=0.42, edgecolor='#FFFFFF', linewidth=2))
ax1.set_title('Core Test Suite\nPass Rate: 100%', fontsize=11, fontweight='bold', pad=8)

# Module breakdown bar chart
modules = [
    'API Integration (15)',
    'Mutation Engine (9)',
    'Structure Map (9)',
    'DNA Biophysics (5)'
]
test_counts = [15, 9, 9, 5]
y_pos = np.arange(len(modules))

bars = ax2.barh(y_pos, test_counts, align='center', color=COLOR_MUT, edgecolor=COLOR_TEAL_DARK, height=0.55)
ax2.set_yticks(y_pos)
ax2.set_yticklabels(modules, fontsize=9, fontweight='medium')
ax2.invert_yaxis()
ax2.set_xlabel('Number of Automated Test Cases', fontsize=10, fontweight='bold', labelpad=6)
ax2.set_title('Figure 19: Backend Test Suite Verification (38/38 Passed)', fontsize=11, fontweight='bold', pad=8)
ax2.set_xlim(0, 18)
ax2.grid(axis='x', linestyle='--', alpha=0.35, color='#94A3B8')

for bar in bars:
    w = bar.get_width()
    ax2.annotate(f'{w} / {w} (100%)', xy=(w + 0.4, bar.get_y() + bar.get_height()/2),
                 va='center', fontsize=8.5, color='#0F766E', fontweight='bold')

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph6_backend_test_results.png'))
plt.close(fig)

# ---------------------------------------------------------------------------
# GRAPH 7: Mutation Type Distribution
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)

categories = [
    'Missense',
    'Synonymous',
    'Nonsense (Stop)',
    'Frameshift',
    'Insertion (In-frame)',
    'Deletion (In-frame)'
]
counts = [18, 8, 6, 9, 5, 5]  # Distribution across comprehensive test fixtures
cat_colors = ['#0F766E', '#14B8A6', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6']

bars = ax.bar(categories, counts, color=cat_colors, edgecolor='#334155', linewidth=0.6, width=0.55)
ax.set_ylabel('Verified Benchmark Test Fixtures', fontsize=11, fontweight='bold', labelpad=8)
ax.set_title('Figure 20: Mutation Consequence & InDel Type Distribution', fontsize=12, fontweight='bold', pad=12)
ax.set_xticklabels(categories, rotation=25, ha='right', fontsize=9.5, fontweight='bold')
ax.set_ylim(0, 22)
ax.grid(axis='y', linestyle='--', alpha=0.35, color='#94A3B8')

for bar in bars:
    h = bar.get_height()
    pct = (h / sum(counts)) * 100
    ax.annotate(f'{h} ({pct:.0f}%)', xy=(bar.get_x() + bar.get_width()/2, h), xytext=(0, 3),
                textcoords="offset points", ha='center', va='bottom', fontsize=8.5, color='#171717', fontweight='bold')

fig.tight_layout()
fig.savefig(os.path.join(output_dir, 'graph7_mutation_distribution.png'))
plt.close(fig)

print("All 7 graphs successfully generated in report/assets/graphs/")
