import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

df = pd.read_csv('fairness_results FAIR Checker.csv')

# Metadata measures (no -D suffix in FAIR Checker)
metadata_cols = {
    'F1A':   'F1A_score',
    'F2A':   'F2A_score',
    'F2B':   'F2B_score',
    'A1.2':  'A1.2_score',
    'I2':    'I2_score',
    'R1.1':  'R1.1_score',
    'R1.2':  'R1.2_score',
    'R1.3':  'R1.3_score',
}

# Data measures
data_cols = {
    'F1B':   'F1B_score',
    'A1.1':  'A1.1_score',
    'I1':    'I1_score',
    'I3':    'I3_score',
}

def get_series(df, cols):
    return {
        label: pd.to_numeric(df[col], errors='coerce').dropna().values
        for label, col in cols.items()
    }

metadata_data = get_series(df, metadata_cols)
data_data = get_series(df, data_cols)

def make_boxplot(series_dict, title, color, fig_size=(12, 5)):
    labels = list(series_dict.keys())
    data = [series_dict[k] for k in labels]

    fig, ax = plt.subplots(figsize=fig_size)

    ax.boxplot(
        data,
        labels=labels,
        patch_artist=True,
        notch=False,
        showfliers=True,
        flierprops=dict(
            marker='o', markersize=8, alpha=1,
            markerfacecolor='none',
            markeredgecolor='black',
            markeredgewidth=0.5,
        ),
        medianprops=dict(color='black', linewidth=0.7),
        boxprops=dict(facecolor=color, edgecolor='black', linewidth=0.7),
        whiskerprops=dict(color='black', linewidth=0.7),
        capprops=dict(color='black', linewidth=0.7),
    )

    ax.set_ylabel('Score', fontsize=14)
    ax.set_title(title, fontsize=13, pad=12)
    ax.tick_params(axis='x', labelsize=12)
    ax.tick_params(axis='y', labelsize=12)
    ax.yaxis.grid(False)
    ax.xaxis.grid(False)
    ax.set_facecolor('white')
    fig.patch.set_facecolor('white')

    for spine in ax.spines.values():
        spine.set_linewidth(0.7)
        spine.set_color('black')

    fig.tight_layout()
    return fig

fig1 = make_boxplot(metadata_data, 'Metadata-related FAIR measures', '#677c7b')
fig1.savefig('fc_fair_metadata_measures.png', dpi=150, bbox_inches='tight')

fig2 = make_boxplot(data_data, 'Data-related FAIR measures', '#607D7B', fig_size=(8, 5))
fig2.savefig('fc_fair_data_measures.png', dpi=150, bbox_inches='tight')

plt.show()