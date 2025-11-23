import json
import csv
from itertools import chain, combinations
import pandas as pd
import os
from sklearn.metrics import cohen_kappa_score, precision_score, recall_score
import requests
import mimetypes
import filetype
import re
from SPARQLWrapper import *
from SPARQLWrapper import SPARQLWrapper
from xml.dom.minidom import Document
from fair_vocabularies import fair_vocabularies
from urllib.parse import urlparse
from collections import Counter
from LOD_Cloudify.lod_cloud_data_handler import LodCloudDataHandler

here = os.path.dirname(os.path.abspath(__file__))
import pandas as pd

def lodcloudjson_to_csv(lodcloud_json_file, csv_filename):

    with open(lodcloud_json_file, "r", encoding="utf-8") as file:
        data = json.load(file)

    with open(csv_filename, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = ["_id", "title", "keywords", "description", "topic", "url"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()

        for resource_id, resource_data in data.items():
            description = resource_data.get("description", {})
            description_text = description.get("en", "") if isinstance(description, dict) else ""
            description_text = description_text.replace("\n", " ") if description_text is not None else ""
            description_text = description_text.replace(",", " ")
            description_text = description_text.replace("\r", " ")

            writer.writerow({
                "_id": resource_data.get("_id", ""),
                "title": resource_data.get("title", ""),
                "keywords": "; ".join(resource_data.get("keywords", [])),  # Join keywords into a single string
                "description": description_text.strip(),
                "topic" : "" ,
                "url": f"https://lod-cloud.net/dataset/{resource_id}",
            })

def generate_subsets(keywords):
    """Generate all possible non-empty subsets of the keyword list."""
    return chain.from_iterable(combinations(keywords, r) for r in range(1, len(keywords) + 1))

def combine_csv_files(csv_file1,csv_file2,output_csv):
    csv1 = pd.read_csv(csv_file1)
    csv2 = pd.read_csv(csv_file2)

    csv1 = csv1.rename(columns={"topic": "Maria_Angela_Topic"})

    sort_column = "_id"

    csv1 = csv1.sort_values(by=sort_column).reset_index(drop=True)
    csv2 = csv2.sort_values(by=sort_column).reset_index(drop=True)

    csv1["Gabriele_Topic"] = csv2["topic"]

    csv1["Final_decision"] = ""

    csv1.to_csv(output_csv, index=False)

def calculate_cohen_kappa(csv_file1,csv_file2):

    df1 = pd.read_csv(csv_file1) 
    df2 = pd.read_csv(csv_file2)  

    # Specify the column name where annotations are stored
    maria_angela_topic = "topic"  # Replace with actual column name in annotator1.csv
    gabriele_topic = "topic"  # Replace with actual column name in annotator2.csv

    df1 = df1.sort_values(by='_id').reset_index(drop=True)
    df2 = df2.sort_values(by='_id').reset_index(drop=True)

    print(df1.shape, df2.shape)
    # Extract annotations
    annotator1 = df1[maria_angela_topic].tolist()
    annotator2 = df2[gabriele_topic].tolist()

    # Compute Cohen’s Kappa
    kappa = cohen_kappa_score(annotator1, annotator2)

    print(f"Cohen's Kappa: {kappa:.4f}")

def compare_csv_topics(file1, file2,file3, output_file,topic_disagrement_to_check):
    # Load the CSV files
    gabriele = pd.read_csv(file1).sort_values(by='_id').reset_index(drop=True)
    mariangela = pd.read_csv(file2).sort_values(by='_id').reset_index(drop=True)
    sana = pd.read_csv(file3).sort_values(by='_id').reset_index(drop=True)
    

    comparison_df = mariangela.copy()
    comparison_df = comparison_df.rename(columns={'topic': 'Mariangela_topic'})

    comparison_df['Gabriele_topic'] = gabriele['topic']
    comparison_df['Sana_topic'] = sana['Topic']


    disagreement_rows = comparison_df[
        (comparison_df['Gabriele_topic'] != comparison_df['Mariangela_topic']) |
        (comparison_df['Gabriele_topic'] != comparison_df['Sana_topic']) |
        (comparison_df['Mariangela_topic'] != comparison_df['Sana_topic'])
    ]

    cultural_heritage_disagreement = disagreement_rows[
        (disagreement_rows['Gabriele_topic'] == topic_disagrement_to_check) |
        (disagreement_rows['Mariangela_topic'] == topic_disagrement_to_check) |
        (disagreement_rows['Sana_topic'] == topic_disagrement_to_check)
    ]

    # Save to output CSV
    cultural_heritage_disagreement.to_csv(output_file, index=False)

def create_list_of_domains(lodcloud_data):
    domains = []
    for key in lodcloud_data:
        domains.append(lodcloud_data[key]['domain'])
    
    return domains

def calculate_precision_recall(gold_standard_path, dataset_to_verify_path):
    with open(os.path.join(here, gold_standard_path)) as f:
        gold_standard = json.load(f)
        gold_standard = {key: gold_standard[key] for key in sorted(gold_standard)}
        gold_standard_domains = create_list_of_domains(gold_standard)

    with open(os.path.join(here, dataset_to_verify_path)) as f:
        to_verify = json.load(f)
        to_verify = {key: to_verify[key] for key in sorted(to_verify)}
        to_verify_domains = create_list_of_domains(to_verify)

    # Find misclassified samples
    errors_tuple = []
    matched_tuple = []
    true_positive = []
    false_positive = []
    false_negative = []

    for kg, true_label, predicted_label in zip(sorted(gold_standard.keys()), gold_standard_domains, to_verify_domains):
        if true_label != predicted_label and predicted_label == 'cultural-heritage':
            false_positive.append(predicted_label)
            errors_tuple.append((kg, true_label, predicted_label))
        if true_label != predicted_label and true_label == 'cultural-heritage':
            false_negative.append(predicted_label)
            errors_tuple.append((kg, true_label, predicted_label))
        if true_label == predicted_label and 'cultural-heritage' in true_label:
            true_positive.append(predicted_label)
            matched_tuple.append((kg, true_label, predicted_label))
    
    precision_score = len(true_positive) / (len(true_positive) + len(false_positive))
    recall_score = len(true_positive) / (len(true_positive) + len(false_negative))
    
    print(f"Precision: {precision_score:.4f}")
    print(f"Recall: {recall_score:.4f}")

    # Print or return misclassified samples
    print("\nMisclassified Samples:")
    for kg, true_label, predicted_label in errors_tuple:
        print(f"KG: {kg}, Expected: {true_label}, Predicted: {predicted_label}")

    return errors_tuple

def filter_quality_data(lodcloud_data_path, quality_data_path, filtered_quality_data_path):
    kg_to_extract = []
    with open(os.path.join(here,lodcloud_data_path), "r", encoding="utf-8") as file:
        lodcloud_data = json.load(file)
        for key in lodcloud_data:
            kg_to_extract.append(key)

    df = pd.read_csv(quality_data_path)

    # Filter the DataFrame based on the 'id' column
    filtered_df = df[df['KG id'].isin(kg_to_extract)]

    # Save the filtered DataFrame to a new CSV file (optional)
    filtered_df.to_csv(os.path.join(here,filtered_quality_data_path), index=False)

def get_mime_type(url):
    """Infers the IANA media type (MIME type) from a download URL."""
    try:
        response = requests.head(url, allow_redirects=True, timeout=5)
        if 'Content-Type' in response.headers:
            return response.headers['Content-Type']
    except requests.RequestException:
        pass 
    
    mime_type, _ = mimetypes.guess_type(url)
    if mime_type:
        return mime_type
    
    try:
        response = requests.get(url, stream=True, timeout=5)
        kind = filetype.guess(response.raw.read(1024))  # Read first 1024 bytes
        if kind:
            return kind.mime
    except requests.RequestException:
        pass  # If request fails, return None
    
    return None  # Could not determine MIME type

def recover_doi_from_lodcloud(kg_id,path_to_lodcloud_data_to_use = '../data/only_CH_lodcloud/CHe_cloud_merged.json'):
    with open(os.path.join(here,path_to_lodcloud_data_to_use), "r", encoding="utf-8") as file:
        lodcloud_data = json.load(file)
        
    kg_metadata = lodcloud_data[kg_id]
    doi = kg_metadata.get('doi','')
    if doi != '':
        return 1
    else:
        return 0

def check_publisher_info(row):
    author_query = 1 if pd.notna(row['Author (query)']) and row['Author (query)'] not in ['[]', '-'] else 0
    
    author_metadata = 0
    if pd.notna(row['Author (metadata)']) and row['Author (metadata)'] not in [False,'False']:
        if not re.fullmatch(r"Name:\s*absent,\s*email:\s*absent", row['Author (metadata)'], re.IGNORECASE):
            author_metadata = 1
    
    contributors = 1 if pd.notna(row['Contributor']) and row['Contributor'] not in ['[]', '-'] else 0

    publishers = 1 if pd.notna(row['Publisher']) and row['Publisher'] not in ['[]', '-'] else 0

    sources = 0
    if pd.notna(row['Sources']) and row['Sources'] not in ['-', '']:
        # Extract values after "Web:", "Name:", and "Email:"
        matches = re.findall(r"(?:Web|Name|Email):\s*([^,]+)", row['Sources'], re.IGNORECASE)
        # Check if any extracted value is not "absent" or empty
        if any(value.strip().lower() not in ["absent", "", 'Absent'] for value in matches):
            sources = 1
    

    return 1 if author_query or author_metadata or contributors or  publishers or sources else 0

def check_if_ontology(kg_id,path_to_lodcloud_data_to_use = '../data/only_CH_lodcloud/CHe_cloud_merged.json'):
    with open(os.path.join(here,path_to_lodcloud_data_to_use), "r", encoding="utf-8") as file:
        lodcloud_data = json.load(file)
        
    kg_metadata = lodcloud_data[kg_id]
    keywords = kg_metadata.get('keywords','')
    if 'ontology' in keywords:
        return True
    else: 
        return False
    
def check_meta_in_sparql(endpoint_url):
    sparql = SPARQLWrapper(endpoint_url)
    query = """
    PREFIX void: <http://rdfs.org/ns/void#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX dcat: <http://www.w3.org/ns/dcat#>

    SELECT DISTINCT ?s
    WHERE {
    {
        ?s a void:Dataset .
    }
    UNION
    {
        ?s a dcat:Dataset .
    }
    }
    """
    sparql.setQuery(query)
    sparql.setTimeout(300)
    sparql.setReturnFormat(JSON)
    try:
        results = sparql.query().convert()
        if isinstance(results,dict):
            result = results.get('results')
            bindings = result.get('bindings')
            if isinstance(bindings,list) and len(bindings) > 0:
                return 1
            else:
                return 0
        elif isinstance(results,Document):
            li = []
            literalList = results.getElementsByTagName('literal')
            numTags = results.getElementsByTagName("literal").length
            for i in range(numTags):
                if literalList[i].firstChild is not None:
                    literal = literalList[i].firstChild.nodeValue
                    li.append(literal)
            if len(li) > 0:
                return 1
            else:
                return 0
    except:
        return 0

def get_sparql_url(kg_id,path_to_lodcloud_data_to_use = '../data/only_CH_lodcloud/CHe_cloud_merged.json'):
    with open(os.path.join(here,path_to_lodcloud_data_to_use), "r", encoding="utf-8") as file:
        lodcloud_data = json.load(file)
        
    kg_metadata = lodcloud_data[kg_id]
    try:
        sparql_url = kg_metadata['sparql'][0]['access_url']
        if sparql_url:
            return sparql_url
        else: 
            return ''
    except:
        return ''

def check_if_fair_vocabs(vocabs):
    vocabs = vocabs.replace('[','')
    vocabs = vocabs.replace(']','')
    vocabs = vocabs.split(',')
    total_vocabs = len(vocabs)
    fair_vocabularies_defined = []
    for vocab in vocabs:
        vocab = vocab.strip()
        vocab = vocab.replace("'","")
        vocab = vocab.replace('"',"")
        if vocab in fair_vocabularies:
            fair_vocabularies_defined.append(vocab)
    return len(fair_vocabularies_defined) / total_vocabs if total_vocabs > 0 else 0

def compare_fairness_on_manually_refined(no_manually_refined_path='../data/fairness_evaluation/CHe-Cloud_no_refined.csv', manually_refined_path='../data/fairness_evaluation/CHe-Cloud_manually_refined.csv'):
    no_manually_refined_df = pd.read_csv(no_manually_refined_path)
    manually_refined_df = pd.read_csv(manually_refined_path)

    common_kg_ids = no_manually_refined_df["KG id"].isin(manually_refined_df["KG id"])

    df1_filtered = no_manually_refined_df[common_kg_ids].copy()
    df2_filtered = manually_refined_df[manually_refined_df["KG id"].isin(no_manually_refined_df["KG id"])].copy()

    df2_filtered["KG id"] = df2_filtered["KG id"] + "_refined"

    merged_df = pd.concat([df1_filtered, df2_filtered]).sort_values(by="KG id").reset_index(drop=True)

    merged_df.to_csv('../data/fairness_evaluation/CHe-Cloud_no_manually_refined_vs_manually_refined.csv', index=False)

def find_search_engine_from_keywords(kg_id,path_to_lodcloud_data_to_use = '../data/only_CH_lodcloud/CHe_cloud_merged.json'):
    with open(os.path.join(here,path_to_lodcloud_data_to_use), "r", encoding="utf-8") as file:
        lodcloud_data = json.load(file)
    kg_metadata = lodcloud_data[kg_id]
    keywords = kg_metadata.get('keywords','')
    for keyword in keywords:
        keyword = keyword.strip()
        if any(k in keyword for k in ['github', 'zenodo', 'fairsharing']):
            return 1
    return 0


def check_at_least_sparql_on(sparql_url):
    '''
    Check if the SPARQL endpoint return a 200 status, also if the sparql editor is not interoperable
    '''
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(sparql_url, headers=headers, timeout=10,verify=False)

        if 200 <= response.status_code < 300:
            return 1
        else:
            return 0
        
    except requests.exceptions.RequestException as e:
        # Handle any exceptions that may occur
        return 0

def merge_fairness_evaluation(che_cloud_data,che_cloud_manually_refined,manually_picked):
    original_df = pd.read_csv(che_cloud_data)
    refined_df = pd.read_csv(che_cloud_manually_refined)
    additional_df = pd.read_csv(manually_picked)
    original_df.set_index("KG id", inplace=True)
    refined_df.set_index("KG id", inplace=True)

    original_df.update(refined_df)

    original_df.reset_index(inplace=True)

    new_rows = additional_df[~additional_df['KG id'].isin(original_df['KG id'])]

    final_df = pd.concat([original_df, new_rows], ignore_index=True)

    final_df.to_csv('../data/fairness_evaluation/CHe-Cloud_merged(lodcloud+refined+manually_picked).csv', index=False)