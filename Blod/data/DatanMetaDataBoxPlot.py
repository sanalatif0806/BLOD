import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

df = pd.read_csv('KGHEARTBEAT FAIR Quality assessment.csv', usecols=range(31), low_memory=False)

# Metadata measures
metadata_cols = {
    'F1-M':   'F1-M Unique and persistent ID',
    'F2a-M':  'F2a-M - Metadata availability via standard primary sources',
    'F2b-M':  'F2b-M Metadata availability for all the attributes covered in the FAIR score computation',
    'F3-M':   'F3-M Data referrable via a DOI',
    'F4-M':   'F4-M Metadata registered in a searchable engine',
    'A1-M':   'A1-M Metadata availability via working primary sources',
    'A2-M':   'A2-M Registered in search engines',
    'R1.1':   'R1.1 Machine- or human-readable license retrievable via any primary source',
    'R1.2':   'R1.2 Publisher information such as authors-contributors-publishers and sources',
    'R1.3-M': 'R1.3-M Metadata are described with VoID/DCAT predicates',
    'I1-M':   'I1-M Metadata are described with VoID/DCAT predicates',
    'I2':     'I2 Use of FAIR vocabularies',
}

# Data measures
data_cols = {
    'F1-D':   'F1-D URIs dereferenceability',
    'A1-D':   'A1-D Working access point(s)',
    'R1.3-D': 'R1.3-D Data organized in a standardized way',
    'I1-D':   'I1-D Standard & open representation format',
    'I3-D':   'I3-D Degree of connection',
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

    bp = ax.boxplot(
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
fig1.savefig('fair_metadata_measures.png', dpi=150, bbox_inches='tight')

fig2 = make_boxplot(data_data, 'Data-related FAIR measures', '#607D7B', fig_size=(8, 5))
fig2.savefig('fair_data_measures.png', dpi=150, bbox_inches='tight')

plt.show()