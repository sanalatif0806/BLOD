import recover_last_analysis
from dotenv import load_dotenv
import os
import requests
from punctual_quality_evaluation import PunctualQualityEvaluation
import numpy as np

load_dotenv()

checloud_url = os.getenv('CHeCLOUD_URL')

class GenerateWeatherStationData:
    def __init__(self):
        # Recover the third last quality analysis from KGHeartBeat
        df = recover_last_analysis.load_latest_df(3)

        # Recover the dataset's ID in the CHeCLOUD
        response = requests.get(f'{checloud_url}/BLOD/get_all')
        self.che_cloud_dataset = response.json()
        che_cloud_identifiers = [dataset['identifier'] for dataset in self.che_cloud_dataset]

        # Mantain in the df only the KG quality of the datasets in CHeCLOUD
        self.checloud_df = df[df['KG id'].isin(che_cloud_identifiers)]
        self.checloud_df = PunctualQualityEvaluation(self.checloud_df)

    def group_by_metric_value(self,metric_name):
        value = self.checloud_df.group_by_value(metric_name)
        
        return value.to_dict()
    
    def group_by_metric_value_list(self, metric_name):
        value = self.checloud_df.count_elements_by_type(metric_name)
        result = {k: v for k, v in zip(value[0], value[1]) if k}

        return result

    def generate_boxplot_values(self, metric_name):
        min_value = self.checloud_df.analysis_data[metric_name].min()
        q1_value = self.checloud_df.analysis_data[metric_name].quantile(0.25)
        median_value = self.checloud_df.analysis_data[metric_name].median()
        q3_value = self.checloud_df.analysis_data[metric_name].quantile(0.75)
        max_value = self.checloud_df.analysis_data[metric_name].max()

        boxplot_data = {
            'min' : min_value,
            'q1' : q1_value,
            'median' : median_value,
            'q3' : q3_value,
            'max' : max_value
        }

        cleaned_dict = convert_np_floats(boxplot_data)

        return cleaned_dict
    
    def generate_count_statistics(self):
        ontologies = 0
        kgs = 0
        tangible = 0
        intangible = 0
        natural = 0
        generic = 0
        for datasets in self.che_cloud_dataset:
            keywords = datasets['keywords']
            if 'ontology' in keywords:
                ontologies += 1
            else:
                kgs += 1
            if 'ch-tangible' in keywords:
                tangible += 1
            if 'ch-intangible' in keywords:
                intangible += 1
            if 'ch-natural' in keywords:
                natural += 1
            if 'ch-generic' in keywords:
                generic += 1
        
        
        return {
            'datasets' : kgs,
            'ontologies' : ontologies,
            'tangible' : tangible,
            'intangible' : intangible,
            'natural' : natural,
            'generic' : generic
        }
    
    def extract_values_in_column(self, columns):
        """
        Extract the values from the specified columns in the analysis_data DataFrame.
        """
        result = self.checloud_df.extract_values_in_column(columns)

        return result.to_dict(orient='records')
    

def convert_np_floats(obj):
    if isinstance(obj, dict):
        return {k: convert_np_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_np_floats(v) for v in obj]
    elif isinstance(obj, np.generic):
        return float(obj)
    else:
        return obj
