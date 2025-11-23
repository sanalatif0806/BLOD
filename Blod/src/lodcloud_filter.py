import json
import requests
import os
from openai import OpenAI
from dotenv import load_dotenv
import utils
from itertools import combinations
import re
import csv
load_dotenv()
openai_api_key = os.getenv('OPENAI_API_KEY')

here = os.path.dirname(os.path.abspath(__file__))

class LODCloudFilter:
    def __init__(self):
        """
        Initializes the instance by attempting to fetch the latest LOD cloud data from the specified URL.
        
        If the data is successfully fetched, it is saved to a local JSON file. If the fetch fails, 
        the method attempts to load the data from the local JSON file instead.

        Attributes:
            lodcloud_data (dict): The LOD cloud data loaded from the URL or local file.
        """
        try:
            response = requests.get("https://lod-cloud.net/versions/2024-12-31/lod-data.json")
            self.lodcloud_data = response.json()
            with open(os.path.join(here,'../data/lodcloud_data.json'), "w", encoding="utf-8") as file:
                json.dump(self.lodcloud_data, file)
        except:
            with open(os.path.join(here,'../data/lodcloud_data.json'), "r", encoding="utf-8") as file:
                self.lodcloud_data = json.load(file)
    
    def write_filtered_data(self, data, filter_type):
        """
        Writes the filtered data to a JSON file.

        Args:
            data (dict): The data to be written to the file.
            filter_type (str): The type of filter applied to the data, used to name the output file.
        """
        with open(os.path.join(here,f'../data/CHlodcloud_data_{filter_type}.json'), "w", encoding="utf-8") as file:
            json.dump(data, file,indent=4)
    
    def update_lodcloud_data(self, data):
        with open(os.path.join(here,'../data/CH_lodcloud_data.json'), "w", encoding="utf-8") as file:
            json.dump(data, file)

    def filter_by_keywords(self):
        """
        Filters the LOD cloud data by keywords specified in CH_keywords and updates the metadata.
        This method reads a list of keywords from a JSON file located at '../data/CH_keywords.json'.
        It then iterates through the LOD cloud data and checks if any of the keywords are present
        in the metadata of each knowledge graph (KG). If a keyword is found, the KG is added to the
        filtered results and the keyword 'cultural-heritage' is appended to its metadata keywords.
        """
        filtered_kgs = {}
        ch_keywords = json.load(open(os.path.join(here,'../data/CH_keywords.json'), "r", encoding="utf-8"))
        ch_keywords = ch_keywords['keywords']
        kgs_in_lodcloud = self.lodcloud_data.keys()
        for kg in kgs_in_lodcloud:
            kg_metadata = self.lodcloud_data[kg]
            kg_metadata_keywords = kg_metadata['keywords']
            for keyword in ch_keywords:
                if keyword in kg_metadata_keywords and 'cultural-heritage' not in kg_metadata_keywords:
                    kg_metadata['keywords'].append("cultural-heritage")
                    kg_metadata['domain'] = 'cultural-heritage'
                    filtered_kgs[kg] = kg_metadata

        print(f"Extracted {len(filtered_kgs.keys())} resources by analyzing keywords in the dataset metadata")
        self.write_filtered_data(filtered_kgs, "keyword")
        #self.update_lodcloud_data(self.lodcloud_data)    

    def filter_by_title_and_description(self):
        """
        Filters the LOD cloud data by checking if any of the keywords from the 
        'CH_keywords.json' file are present in the title or description of each 
        knowledge graph's metadata. If a keyword is found, the knowledge graph 
        is added to the filtered results and tagged with "cultural-heritage".
        The filtered results are then written to a file and the LOD cloud data 
        is updated accordingly.
        """
        filtered_kgs = {}
        ch_keywords = json.load(open(os.path.join(here,'../data/CH_keywords.json'), "r", encoding="utf-8"))
        ch_keywords = ch_keywords['keywords']
        for kg in self.lodcloud_data.keys():
            kg_metadata = self.lodcloud_data[kg]
            kg_metadata_title = kg_metadata['title']
            kg_metadata_description = kg_metadata['description']
            kg_metadata_keywords = kg_metadata['keywords']
            for keyword in ch_keywords:
                if keyword in kg_metadata_title or keyword in kg_metadata_description or keyword in kg_metadata_keywords:
                    kg_metadata['keywords'].append("cultural-heritage")
                    kg_metadata['domain'] = 'cultural-heritage'
                    filtered_kgs[kg] = kg_metadata 

        print(f"Extracted {len(filtered_kgs.keys())} resources by analyzing title and description in the dataset metadata")
        self.write_filtered_data(filtered_kgs, "title_description")    
        #self.update_lodcloud_data(self.lodcloud_data)
    

    def filter_by_title_description_and_keywords(self,keywords):
        """
        Filters the LOD cloud data by checking if any of the keywords are present in the title, description or keywords
        of each knowledge graph's metadata. If a keyword is found, the knowledge graph 
        is added to the filtered results and tagged with "cultural-heritage".
        The filtered results are then written to a file and the LOD cloud data 
        is updated accordingly.
        """
        filtered_kgs = {}
        for kg in self.lodcloud_data.keys():
            kg_metadata = self.lodcloud_data[kg]
            kg_metadata_title = kg_metadata.get('title', '').lower()
            kg_metadata_description = kg_metadata.get('description', '')
            if isinstance(kg_metadata_description, dict):
                kg_metadata_description = kg_metadata_description.get('en','')
            else:
                kg_metadata_description = ''
            if isinstance(kg_metadata_description, str):
                kg_metadata_description = kg_metadata_description.lower()
            else:
                kg_metadata_description = ''
            kg_metadata_keywords = [kw.lower() for kw in kg_metadata.get('keywords', [])]

            matched = False
            for keyword in keywords:
                    keyword_lower = keyword.lower()
                    pattern = r'\b' + re.escape(keyword_lower) + r'\b' 

                    if (re.search(pattern, kg_metadata_title, re.IGNORECASE) or 
                        re.search(pattern, kg_metadata_description, re.IGNORECASE) or
                        any(re.search(pattern, kw, re.IGNORECASE) for kw in kg_metadata_keywords)):
        
                        matched = True
            if matched:
                kg_metadata['keywords'].append("cultural-heritage")
                kg_metadata['domain'] = 'cultural-heritage'
                filtered_kgs[kg] = kg_metadata 

        print(f"Extracted {len(filtered_kgs.keys())} resources by analyzing title and description in the dataset metadata")
        self.write_filtered_data(filtered_kgs, "title_description_optimal_keywords")    
        #self.update_lodcloud_data(self.lodcloud_data)


    def find_optimal_subset_of_keywords(self,keywords):
        filtered_kgs = {}
        results = {}
        kgs_recovered_by_keywords = {}
        keyword_subsets = utils.generate_subsets(keywords)
        for subset in keyword_subsets:
            print("Processing subset:", subset)
            subset_key = ", ".join(subset) 
            filtered_kgs = []
            kgs_recovered_by_keywords[subset] = {}

            for kg in self.lodcloud_data.keys():
                kg_metadata = self.lodcloud_data[kg]
                kg_metadata_title = kg_metadata.get('title', '').lower()
                kg_metadata_description = kg_metadata.get('description', '')
                if isinstance(kg_metadata_description, dict):
                    kg_metadata_description = kg_metadata_description.get('en','')
                else:
                    kg_metadata_description = ''
                if isinstance(kg_metadata_description, str):
                    kg_metadata_description = kg_metadata_description.lower()
                else:
                    kg_metadata_description = ''
                kg_metadata_keywords = [kw.lower() for kw in kg_metadata.get('keywords', [])]
            
                matched = False
                for keyword in subset:
                    keyword_lower = keyword.lower()
                    pattern = r'\b' + re.escape(keyword_lower) + r'\b' 

                    if (re.search(pattern, kg_metadata_title, re.IGNORECASE) or 
                        re.search(pattern, kg_metadata_description, re.IGNORECASE) or
                        any(re.search(pattern, kw, re.IGNORECASE) for kw in kg_metadata_keywords)):
                        
                        kgs_recovered_by_keywords[subset][keyword] = kgs_recovered_by_keywords[subset].get(keyword, 0) + 1
                        matched = True  
                if matched:
                    filtered_kgs.append(kg_metadata['_id'])

            # Store the count of datasets retrieved for this subset
            results[subset_key] = len(filtered_kgs)
        
        # Find the maximum dataset retrieval count
        max_datasets = max(results.values(), default=0)

        # Find the smallest subset that retrieves this max number of datasets
        optimal_subset = min(
            [subset for subset, count in results.items() if count == max_datasets], 
            key=len
        )
        
        optimal_subset_tuple = tuple(keyword.strip() for keyword in optimal_subset.split(","))
        number_kg_by_keywords = kgs_recovered_by_keywords[optimal_subset_tuple]
        
        print(f"Optimal keyword set: {optimal_subset} -> Datasets Retrieved: {max_datasets}")
        print(f"Number of datasets retrieved by each keyword in the optimal subset: {number_kg_by_keywords}")

        return optimal_subset, max_datasets, number_kg_by_keywords

    def ch_lodcloud_merge(self,path_of_data_to_intersect):
        """
        Mergs the provided data in order to create a JSON file with only the cultural-heritage resources extracted with the different filter methods.

        Args:
            path_of_data_to_intersect (list): A list of file paths containing the data to be intersected with the LOD cloud data.
        """
        merged_data = {}
        for path in path_of_data_to_intersect:
            ch_lodcloud_data = json.load(open(os.path.join(here,path), "r", encoding="utf-8"))
            for kg in ch_lodcloud_data.keys():
                if kg in self.lodcloud_data.keys():
                    self.lodcloud_data[kg]["keywords"] = list(dict.fromkeys(self.lodcloud_data[kg]["keywords"]))
                    merged_data[kg] = self.lodcloud_data[kg]
        print(f"Extracted {len(merged_data.keys())} resources by joining all methods used")
        self.write_filtered_data(merged_data, "union")


    def filter_with_gpt(self):
        """
        Creates a batch job using the OpenAI API to filter the LOD cloud data using the GPT-4o mini model.
        """
        client = OpenAI(api_key=openai_api_key)
        categorize_prompt = '''
            I give you some description and title about dataset in the Linked Open Data Cloud, I have to categorize it as Cultural Heritage or Not.  
            For datasets that are Cultural Heritage, you also need to further specify whether it is tangible, Intangible, Natural Heritage and finally those that define thesaurus and data models, classify them as Generic.  
            You will be provided with a dataset description, title and the id, and you will output a json object containinig the following information:
            {
                "id": "dataset_id",
                "category": "Cultural Heritage",
                "sub_category": "#"
            }
            If the dataset is not part of the Cultural Heritage category, do not enter the "category" key. If the dataset is of type Cultural Heritage, but you cannot define the sub category, do not enter the key “sub_category”.
        '''
        tasks = []
        for index, kg in enumerate(self.lodcloud_data.keys()):
            kg_metadata = self.lodcloud_data[kg]
            kg_data_prompt = f"dataset_id: {kg}\nTitle: {kg_metadata['title']}\nDescription: {kg_metadata['description']['en']}"
            task = {
                "custom_id": f"task-{index}",
                "method": "POST",
                "url": "/v1/chat/completions",
                "body": {
                    "model": "gpt-4o-mini",
                    "temperature": 0.1,
                    "response_format": { 
                        "type": "json_object"
                    },
                    "messages": [
                        {
                            "role": "system",
                            "content": categorize_prompt
                        },
                        {
                            "role": "user",
                            "content": kg_data_prompt
                        }
                    ],
                }
            }
            tasks.append(task)
       
        with open(os.path.join(here,'../data/gpt_tasks.jsonl'), 'w') as file:
            for obj in tasks:
                file.write(json.dumps(obj) + '\n')
        
        batch_file = client.files.create(
            file=open(os.path.join(here,'../data/gpt_tasks.jsonl'), "rb"),
            purpose="batch"
        )

        print(batch_file)
        
        batch_job = client.batches.create(
            input_file_id=batch_file.id,
            endpoint="/v1/chat/completions",
            completion_window="24h"
        )

        batch_job = client.batches.retrieve(batch_job.id)
        print(batch_job)

        return batch_job.id

    def retrieve_and_save_job_result(self, job_id):
        """
        Retrieves the results of a batch job created with the OpenAI API and saves them to a local JSON file.
        """
        client = OpenAI(api_key=openai_api_key)
        batch_job = client.batches.retrieve(job_id)
        result_file_id = batch_job.output_file_id
        result = client.files.content(result_file_id).content

        result_file_name = os.path.join(here,'../data/batch_job_results.jsonl')
        with open(result_file_name, 'wb') as file:
            file.write(result)

        results = []
        with open(result_file_name, 'r') as file:
            for line in file:
                json_object = json.loads(line.strip())
                results.append(json_object)
        
        json_results = []
        for result in results:
            json_response = result['response']['body']['choices'][0]['message']['content']
            json_results.append(json.loads(json_response))
        
        with open(os.path.join(here,'../data/gpt_results.json'), "w", encoding="utf-8") as file:
            json.dump(json_results, file)
    
    def review_filtered_resources_with_gpt(self):
        reviwed_data = {}
        union_data = json.load(open(os.path.join(here,'../data/CHlodcloud_data_union.json'), "r", encoding="utf-8"))
        gpt_filtered_data = json.load(open(os.path.join(here,'../data/CHlodcloud_data_gpt_filtered.json'), "r", encoding="utf-8"))  
        for kg in union_data.keys():
            if kg in gpt_filtered_data.keys():
                reviwed_data[kg] = gpt_filtered_data[kg]
        print(f"Extracted {len(reviwed_data.keys())} resources by intersecting the GPT-4o mini results with the union of all methods used")

        self.write_filtered_data(reviwed_data, "reviewed_by_chatgpt")
        self.update_lodcloud_data(reviwed_data)
    
    def from_gpt_response_to_lodcloud_data(self):
        """
        Transforms the GPT response into LOD Cloud data by applying the categories to the datasets metadata.
        """
        filtered_kgs = {}
        gpt_results = json.load(open(os.path.join(here,'../data/gpt_results.json'), "r", encoding="utf-8"))
        for result in gpt_results:
            kg_id = result['id']
            if 'category' in result:
                kg_metadata = self.lodcloud_data[kg_id]
                if 'cultural-heritage' not in kg_metadata['keywords']:
                    kg_metadata['keywords'].append('cultural-heritage')
                    kg_metadata['domain'] = 'cultural-heritage'
                if 'sub_category' in result:
                    sub_category = result['sub_category']
                    kg_metadata['keywords'].append(f"cultural-heritage-{sub_category.lower()}")
                filtered_kgs[kg_id] = kg_metadata

        print(f"Extracted {len(filtered_kgs.keys())} resources by using GPT-4o mini to categorize the datasets")
        self.write_filtered_data(filtered_kgs, "gpt_filtered")
        #self.update_lodcloud_data(self.lodcloud_data)

    def convert_final_CSV_annotated(self, input_csv_path):
        
        with open(input_csv_path, 'r', encoding='utf-8') as file:
            
            reader = csv.DictReader(file)
            CH_KGs = set()

            ch_lodcloud_filtered = {}

            for row in reader:
                kg_id = row["_id"]
                for key in self.lodcloud_data.keys():
                    if kg_id == self.lodcloud_data[key]['_id']:
                        kg_metadata = self.lodcloud_data[key]
                        kg_metadata['domain'] = 'cultural-heritage'
                        kg_metadata['keywords'].append('cultural-heritage')

                        # TODO: Also the subcategory we have to choose
                        #kg_metadata['keywords'].append(f"cultural-heritage-{sub_category.lower()}")

                        #KGs Metadata enrichment based on manual inspection
                        is_ontology = row["Only ontology?"]
                        if is_ontology == "Yes":  
                            if 'ontology' not in kg_metadata['keywords']:
                                kg_metadata['keywords'].append('ontology')

                        links_status = row["GAB - Decision after inspection of the dataset"]
                        if links_status == 'no working links':
                            kg_metadata['keywords'].append('no_working_links')
                        if links_status == 'ch no links available':
                            kg_metadata['keywords'].append('no_links_provided')

                        no_ld = row["No LD"]
                        if no_ld == 'Yes':
                            kg_metadata['keywords'].append('no_linked_data')
                
                        # Update KGs with the new links founded
                        new_link = row["New link for the resource"]
                        if new_link != '':
                            kg_metadata['website'] = new_link.strip()
                
                        new_sparql_endpoint = row["New SPARQL URL"]
                        if new_sparql_endpoint != '':
                            lodcloud_sparql_endpoint = [{
                                "title": "SPARQL Endpoint",
                                "description": "",
                                "access_url": new_sparql_endpoint.strip(),
                                "status" : "OK"
                            }]
                            kg_metadata['sparql'] = lodcloud_sparql_endpoint
                
                        new_rdf_dump = row["New RDF Dump"]
                        lodcloud_other_downloads = kg_metadata.get('other_download', [])
                        if new_rdf_dump != '':
                            new_rdf_dump_links = new_rdf_dump.split(";")
                            for link in new_rdf_dump_links:
                                media_type = utils.get_mime_type(link.strip())
                                if not media_type:
                                    media_type = ''
                                lodcloud_rdf_dump = {
                                    "media_type": media_type,
                                    "description": "RDF dump manually discovered",
                                    "access_url": link.strip(),
                                    "status" : "OK",
                                    "title": "RDF Dump",
                                    "mirror" : [],
                                }
                                lodcloud_other_downloads.append(lodcloud_rdf_dump)
                            kg_metadata['other_download'] = lodcloud_other_downloads
                        
                        keywords = row["keywords"]
                        keywords = [kw.replace("'", "").strip() for kw in keywords.split(';')]
                        if 'tangible' in keywords:
                            kg_metadata['keywords'].append('ch-tangible')
                        if 'intangible' in keywords:
                            kg_metadata['keywords'].append('ch-intangible')
                        if 'natural' in keywords:
                            kg_metadata['keywords'].append('ch-natural')
                        if 'generic' in keywords:
                            kg_metadata['keywords'].append('ch-generic')
                        

                        ch_lodcloud_filtered[key] = self.lodcloud_data[key]

                        break
        self.write_filtered_data(ch_lodcloud_filtered, "manual_selected")

    def merge_cultural_heritage_datasets_with_other_from_lodcloud(self,file_to_merge):
        json_to_merge = json.load(open(os.path.join(here,file_to_merge), "r", encoding="utf-8"))

        for kg in self.lodcloud_data:
            if kg in json_to_merge:
                self.lodcloud_data[kg] = json_to_merge[kg]

        filename = os.path.basename(file_to_merge)
        with open(os.path.join(here,f'../data/Complete-{filename}'), "w", encoding="utf-8") as file:
            json.dump(self.lodcloud_data, file,indent=4)

    def merge_cultural_heritage_datasets_with_other_from_lodcloud(self,file_to_merge):
        json_to_merge = json.load(open(os.path.join(here,file_to_merge), "r", encoding="utf-8"))

        for kg in self.lodcloud_data:
            if kg in json_to_merge:
                self.lodcloud_data[kg] = json_to_merge[kg]

        filename = os.path.basename(file_to_merge)
        with open(os.path.join(here,f'../data/Complete-{filename}'), "w", encoding="utf-8") as file:
            json.dump(self.lodcloud_data, file,indent=4)

l = LODCloudFilter()
#l.merge_cultural_heritage_datasets_with_other_from_lodcloud('../data/keywords_from_SLR/CHlodcloud_data_title_description_optimal_keywords_no_history.json')
#l.convert_final_CSV_annotated(os.path.join(here,'../data/manually_annotated_kgs/LODCloud_CH_Final_Selection.csv'))
#l.merge_cultural_heritage_datasets_with_other_from_lodcloud('../data/CHlodcloud_data_title_description_optimal_keywords_no_history.json')
'''
ch_keywords = json.load(open(os.path.join(here,'../data/CH_keywords.json'), "r", encoding="utf-8"))
ch_optimal_subset = json.load(open(os.path.join(here,'../data/CH_optimal_subsets.json'), "r", encoding="utf-8"))

optimal_subset, max_datasets, number_kg_by_keywords = l.find_optimal_subset_of_keywords(ch_keywords['generic'])
ch_optimal_subset.setdefault('generic', {})
ch_optimal_subset['generic'] = {
    "optimal_subset" : optimal_subset,
    "KGs retrieved" : max_datasets,
    "KGs by keywords" : number_kg_by_keywords
}

with open(os.path.join(here,'../data/CH_optimal_subsets.json'), "w", encoding="utf-8") as file:
    json.dump(ch_optimal_subset, file,indent=4)'
'''
#optimal_keywords = json.load(open(os.path.join(here,'../data/keywords_from_SLR/CH_optimal_keywords.json'), "r", encoding="utf-8"))
#optimal_keywords = optimal_keywords['optimal_keywords']
#l.filter_by_title_description_and_keywords(keywords=optimal_keywords)

l.convert_final_CSV_annotated(os.path.join(here,'../data/manually_annotated_kgs/LODCloud_CH_Final_Selection.csv'))