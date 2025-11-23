from lodcloud_filter import LODCloudFilter

def main(create_jobs=False):
    lod_cloud_filter = LODCloudFilter()

    # Filter the LOD Cloud dataset by keywords inserted in the CH_keywords.json file, by analyzing the dataset metadata keywords
    lod_cloud_filter.filter_by_keywords()

    # Filter the LOD Cloud dataset by keywords inserted in the CH_keywords.json file, by analyzing the dataset metadata title and description
    lod_cloud_filter.filter_by_title_and_description()

    if create_jobs:

        # Filter the LOD Cloud dataset by using the OpenAI Batch API. This method creates the jobs. The model used is gpt4o-mini
        batch_job_id = lod_cloud_filter.filter_with_gpt()

        # Retrieve the results of the jobs created by the filter_with_gpt method
        lod_cloud_filter.retrieve_and_save_job_result(batch_job_id)

    # Create a JSON file with only cultural heritage dataset extracted with the different methods
    lod_cloud_filter.ch_lodcloud_merge(['../data/CHlodcloud_data_keyword.json','../data/CHlodcloud_data_title_description.json'])
    
    # Transform the GPT response into LOD Cloud data by applying the categories to the datasets metadata
    lod_cloud_filter.from_gpt_response_to_lodcloud_data()

    # Insert in the final JSON file the datasets that also for the GPT filter are cultural heritage datasets
    lod_cloud_filter.review_filtered_resources_with_gpt()


if __name__ == "__main__":
    main()