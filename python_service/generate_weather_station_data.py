import recover_last_analysis
from dotenv import load_dotenv
import os
import requests
from punctual_quality_evaluation import PunctualQualityEvaluation
import numpy as np
import logging
import time

load_dotenv()

# Use environment variable (works in Docker)
checloud_url = os.getenv("BACKEND_URL", "http://backend:5005")


class GenerateWeatherStationData:
    def __init__(self):
        self.checloud_df = None
        self.che_cloud_dataset = []

        try:
            # -------------------------
            # 1️⃣ Load quality dataframe
            # -------------------------
            df = None
            try:
                df = recover_last_analysis.load_latest_df(3)
                print(f"Loaded 3rd latest dataframe: {df.shape if df is not None else 'None'}")
            except Exception as e:
                print(f"Error loading 3rd latest df: {e}, trying 1st latest")
                try:
                    df = recover_last_analysis.load_latest_df(1)
                except Exception as e2:
                    print(f"Error loading 1st latest df: {e2}")

            if df is None:
                print("Failed to load dataframe")
                return

            # -------------------------
            # 2️⃣ Fetch datasets from backend
            # -------------------------
            self.che_cloud_dataset = self._fetch_datasets_with_retry()

            if not self.che_cloud_dataset:
                print("No datasets loaded from backend")
                return

            print(f"Loaded {len(self.che_cloud_dataset)} datasets from backend")

            # -------------------------
            # 3️⃣ Extract identifiers
            # -------------------------
            che_cloud_identifiers = [
                dataset['identifier']
                for dataset in self.che_cloud_dataset
                if 'identifier' in dataset
            ]

            # -------------------------
            # 4️⃣ Detect correct ID column in df
            # -------------------------
            possible_columns = ['KG id', 'identifier', 'kg_id', 'dataset_id']
            id_column = None

            for col in possible_columns:
                if col in df.columns:
                    id_column = col
                    break

            if not id_column:
                print("No matching ID column found in dataframe")
                self.checloud_df = None
                return

            print(f"Using '{id_column}' as ID column for filtering")

            # -------------------------
            # 5️⃣ Filter dataframe
            # -------------------------
            self.checloud_df = df[df[id_column].isin(che_cloud_identifiers)]
            print(f"Filtered dataframe to {len(self.checloud_df)} matching datasets")

            if len(self.checloud_df) == 0:
                print("Warning: No matching datasets after filtering")
                self.checloud_df = None
                return

            # -------------------------
            # 6️⃣ Apply quality evaluation
            # -------------------------
            try:
                self.checloud_df = PunctualQualityEvaluation(self.checloud_df)
            except Exception as e:
                print(f"Error in PunctualQualityEvaluation: {e}")
                self.checloud_df = None

        except Exception as e:
            print(f"Unexpected error in initialization: {e}")
            self.checloud_df = None
            self.che_cloud_dataset = []

    # ------------------------------------------------
    # Retry backend fetch (important for Docker startup timing)
    # ------------------------------------------------
    def _fetch_datasets_with_retry(self, retries=10, delay=3):
        for attempt in range(retries):
            try:
                response = requests.get(f'{checloud_url}/BLOD/get_all', timeout=10)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Attempt {attempt + 1}/{retries} failed: {e}")
                time.sleep(delay)
        return []

    # ------------------------------------------------
    # Dashboard Methods
    # ------------------------------------------------
    def group_by_metric_value(self, metric_name):
        if self.checloud_df is None:
            return {}
        try:
            value = self.checloud_df.group_by_value(metric_name)
            return value.to_dict()
        except Exception as e:
            print(f"Error in group_by_metric_value for {metric_name}: {e}")
            return {}

    def group_by_metric_value_list(self, metric_name):
        if self.checloud_df is None:
            return {}
        try:
            value = self.checloud_df.count_elements_by_type(metric_name)
            result = {k: v for k, v in zip(value[0], value[1]) if k}
            return result
        except Exception as e:
            print(f"Error in group_by_metric_value_list for {metric_name}: {e}")
            return {}

    def generate_boxplot_values(self, metric_name):
        if self.checloud_df is None or not hasattr(self.checloud_df, 'analysis_data'):
            return {'min': 0, 'q1': 0, 'median': 0, 'q3': 0, 'max': 0}

        try:
            if metric_name not in self.checloud_df.analysis_data.columns:
                print(f"Metric {metric_name} not found in analysis_data")
                return {'min': 0, 'q1': 0, 'median': 0, 'q3': 0, 'max': 0}

            min_value = self.checloud_df.analysis_data[metric_name].min()
            q1_value = self.checloud_df.analysis_data[metric_name].quantile(0.25)
            median_value = self.checloud_df.analysis_data[metric_name].median()
            q3_value = self.checloud_df.analysis_data[metric_name].quantile(0.75)
            max_value = self.checloud_df.analysis_data[metric_name].max()

            return convert_np_floats({
                'min': min_value,
                'q1': q1_value,
                'median': median_value,
                'q3': q3_value,
                'max': max_value
            })

        except Exception as e:
            print(f"Error generating boxplot for {metric_name}: {e}")
            return {'min': 0, 'q1': 0, 'median': 0, 'q3': 0, 'max': 0}

    def generate_count_statistics(self):
        if not self.che_cloud_dataset:
            return {
                'datasets': 0,
                'ontologies': 0,
                'Clinical & Patient Data': 0,
                'Omics & Molecular Data': 0,
                'Medical Imaging & Signals': 0,
                'Public Health & Surveillance': 0,
                'Biobank & Research Data': 0,
                'Behavioral & Social Data': 0,
                'Terminologies & Metadata': 0
            }

        ontologies = 0
        kgs = 0
        category_counts = {
            'Clinical & Patient Data': 0,
            'Omics & Molecular Data': 0,
            'Medical Imaging & Signals': 0,
            'Public Health & Surveillance': 0,
            'Biobank & Research Data': 0,
            'Behavioral & Social Data': 0,
            'Terminologies & Metadata': 0
        }

        for dataset in self.che_cloud_dataset:
            keywords = dataset.get('keywords', [])
            if 'ontology' in keywords:
                ontologies += 1
            else:
                kgs += 1

            for category in category_counts:
                if category in keywords:
                    category_counts[category] += 1

        return {
            'datasets': kgs,
            'ontologies': ontologies,
            **category_counts
        }

    def extract_values_in_column(self, columns):
        if self.checloud_df is None:
            return []
        try:
            result = self.checloud_df.extract_values_in_column(columns)
            return result.to_dict(orient='records')
        except Exception as e:
            print(f"Error extracting values in column {columns}: {e}")
            return []


def convert_np_floats(obj):
    if isinstance(obj, dict):
        return {k: convert_np_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_np_floats(v) for v in obj]
    elif isinstance(obj, (np.integer, np.floating)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj