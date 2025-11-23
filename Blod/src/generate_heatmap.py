import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import numpy as np

# Load the CSV
df = pd.read_csv(f"../data/fairness_evaluation/CHe-Cloud_manually_picked.csv")

# Set KG id as index (for y-axis)
df.set_index("KG id", inplace=True)

# Select only numeric columns (the FAIR metrics)
numeric_df = df.select_dtypes(include=[np.number])

# Separate the last column (FAIR score)
metrics_only = numeric_df.iloc[:, :-1]  # all but FAIR score
last_column = numeric_df.iloc[:, -1]    # only FAIR score

# Shorten column names by cutting at the first space
short_columns = [col.split(" ")[0] for col in numeric_df.columns]
numeric_df.columns = short_columns
metrics_only.columns = short_columns[:-1]  # all but last column
last_column_name = short_columns[-1]

# Adatta la dimensione della figura al numero di righe
n_rows = len(numeric_df)
plt.figure(figsize=(14, max(6, n_rows * 0.4)))

# Plot the metrics (all but last column) with color normalization
ax = sns.heatmap(
    metrics_only,
    annot=True,
    cmap="Blues",
    vmin=metrics_only.min().min(),
    vmax=metrics_only.max().max(),
    cbar=False,
    yticklabels=True,
    linewidths=0.5,
    fmt=".2f"
)

# Add the last column to the figure (without coloring)
# First, get the current axes and expand them to accommodate the last column
pos = ax.get_position()
fig = plt.gcf()
pos.x1 = pos.x1 + 0.05  # Add some space for the last column
ax.set_position(pos)

# Manually add text for the last column
for i, value in enumerate(last_column):
    ax.text(len(metrics_only.columns) + 0.5, i + 0.5, f"{value:.2f}", 
            ha="center", va="center", fontweight="bold")

# Add text for the last column header
ax.text(len(metrics_only.columns) + 0.5, -0.3, last_column_name, 
        ha="center", va="center", fontweight="bold")

# Set the title and adjust other parameters
plt.title("Quality of Manually Refined Datasets.")

# Move x labels to the top
ax.xaxis.tick_top()
ax.xaxis.set_label_position('top')
plt.xticks(rotation=45, ha='left')

plt.tight_layout()

# Save the image
plt.savefig("../data/charts/CHe-Cloud_manually_picked.png", dpi=300, bbox_inches='tight')

# Show it
plt.show()