import os
import json
import glob

def create_list_and_move(data_to_convert):

    lodcloud_data_list = []
    # Create a list of dictionaries
    for key in data_to_convert:
        item = data_to_convert[key]
        if '_id' in item and item['_id'] == '':
            item['_id'] = item['identifier']
        lodcloud_data_list.append(data_to_convert[key])

    absolute_path = os.path.abspath(os.path.join('..','..','WebApp/backend/'))
    with open(absolute_path + '/CHe_cloud_data.json', 'w') as f:
        json.dump(lodcloud_data_list, f, indent=4)

def merge_cloud_with_monitoring_requests(path_dataset_to_include_in_the_cloud):
    monitoring_requests_path = os.path.abspath(os.path.join('..','..','monitoring_requests/'))

    json_files = glob.glob(os.path.join(monitoring_requests_path, '*.json'))
    
    json_files.append(path_dataset_to_include_in_the_cloud)
    
    merged_data = {}
    for path in reversed(json_files):
        path = os.path.abspath(path)
        with open(path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            merged_data.update(data)
    
    return merged_data

che_cloud_data = merge_cloud_with_monitoring_requests('../data/only_CH_lodcloud/CHe_cloud_merged.json')
create_list_and_move(che_cloud_data)