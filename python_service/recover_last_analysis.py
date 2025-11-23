import requests
from bs4 import BeautifulSoup
import os
import tarfile
import pandas as pd
import shutil
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

BASE_URL = os.getenv('KGHeartBeat_URL')
BASE_DIR = '/data'
TAR_SAVE_PATH = os.path.join(BASE_DIR, "latest_file.tar.gz")
EXTRACT_DIR = os.path.join(BASE_DIR, "extracted_tar")
SAVED_CSV_PATH = os.path.join(BASE_DIR, "latest_quality_snapshot.csv")
MAX_AGE_DAYS = 14

def is_csv_fresh(csv_path):
    if not os.path.exists(csv_path):
        return False
    mod_time = datetime.fromtimestamp(os.path.getmtime(csv_path))
    return datetime.now() - mod_time < timedelta(days=MAX_AGE_DAYS)

def get_latest_tar_url(index_from_last=3):
    response = requests.get(BASE_URL)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    tar_links = [a['href'] for a in soup.find_all('a', href=True) if a['href'].endswith('.tar.gz')]
    if len(tar_links) < index_from_last:
        raise Exception(f"Not enough .tar.gz files to select the {index_from_last}-th last.")
    tar_links.sort(reverse=True)
    return BASE_URL + tar_links[index_from_last - 1]

def download_tar(url, save_path):
    response = requests.get(url)
    response.raise_for_status()
    with open(save_path, 'wb') as f:
        f.write(response.content)

def extract_tar(tar_path, extract_to):
    with tarfile.open(tar_path, 'r:gz') as tar:
        tar.extractall(path=extract_to)

def find_csv_file(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".csv"):
                return os.path.join(root, file)
    raise Exception("No CSV file found in extracted archive.")

def load_latest_df(index_from_last=3):
    if is_csv_fresh(SAVED_CSV_PATH):
        return pd.read_csv(SAVED_CSV_PATH)
    
    try:
        latest_tar_url = get_latest_tar_url(index_from_last=index_from_last)
        download_tar(latest_tar_url, TAR_SAVE_PATH)
        extract_tar(TAR_SAVE_PATH, EXTRACT_DIR)
        csv_file_path = find_csv_file(EXTRACT_DIR)
        shutil.copy(csv_file_path, SAVED_CSV_PATH)  # Save CSV for reuse
        df = pd.read_csv(SAVED_CSV_PATH)
        return df
    except:
        return pd.read_csv(SAVED_CSV_PATH)
    finally:
        if os.path.exists(TAR_SAVE_PATH):
            os.remove(TAR_SAVE_PATH)
        if os.path.exists(EXTRACT_DIR):
            shutil.rmtree(EXTRACT_DIR)