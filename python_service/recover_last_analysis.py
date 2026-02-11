import requests
from bs4 import BeautifulSoup
import os
import tarfile
import pandas as pd
import shutil
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

BASE_URL = os.getenv('KGHeartBeat_URL')  # must end with "/"
BASE_DIR = '/data'

TAR_SAVE_PATH = os.path.join(BASE_DIR, "latest_file.tar.gz")
EXTRACT_DIR = os.path.join(BASE_DIR, "extracted_tar")
SAVED_CSV_PATH = os.path.join(BASE_DIR, "latest_quality_snapshot.csv")

MAX_AGE_DAYS = 14


# -------------------------------------------------------------
# Utility: check if local cached CSV is still fresh
# -------------------------------------------------------------
def is_csv_fresh(csv_path):
    if not os.path.exists(csv_path):
        return False
    mod_time = datetime.fromtimestamp(os.path.getmtime(csv_path))
    return datetime.now() - mod_time < timedelta(days=MAX_AGE_DAYS)


# -------------------------------------------------------------
# Get N-th last tar.gz file from remote URL
# -------------------------------------------------------------
def get_latest_tar_url(index_from_last=3):
    response = requests.get(BASE_URL)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    tar_links = [
        a['href'] for a in soup.find_all('a', href=True)
        if a['href'].endswith('.tar.gz')
    ]

    if len(tar_links) < index_from_last:
        raise Exception(
            f"Not enough .tar.gz files. Requested {index_from_last}, found {len(tar_links)}."
        )

    tar_links.sort(reverse=True)
    return BASE_URL + tar_links[index_from_last - 1]


# -------------------------------------------------------------
# Simple HTTP file downloader
# -------------------------------------------------------------
def download_file(url, save_path):
    resp = requests.get(url, stream=True)
    resp.raise_for_status()
    with open(save_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    return save_path


# -------------------------------------------------------------
# Extract tar.gz file
# -------------------------------------------------------------
def extract_tar(tar_path, extract_to):
    with tarfile.open(tar_path, "r:gz") as tar:
        tar.extractall(path=extract_to)


# -------------------------------------------------------------
# Search for any .csv inside extracted tar directory
# -------------------------------------------------------------
def find_csv_file(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".csv"):
                return os.path.join(root, file)
    raise FileNotFoundError("No CSV found in extracted archive.")


# -------------------------------------------------------------
# SAFEST VERSION OF load_latest_df()
# -------------------------------------------------------------
def load_latest_df(index_from_last=3):
    """
    Loads data with this priority:
    1. Fresh local CSV
    2. Remote tar.gz (index_from_last)
    3. Remote CSV (fallback)
    4. Safe empty DataFrame
    """

    # (1) Local cached CSV
    if is_csv_fresh(SAVED_CSV_PATH):
        try:
            print("[INFO] Using cached CSV.")
            return pd.read_csv(SAVED_CSV_PATH)
        except Exception as e:
            print("[WARN] Cached CSV unreadable:", e)

    # (2) Remote tar.gz
    try:
        print(f"[INFO] Downloading {index_from_last}-th last tar.gz...")
        tar_url = get_latest_tar_url(index_from_last)

        # Download & extract
        download_file(tar_url, TAR_SAVE_PATH)
        extract_tar(TAR_SAVE_PATH, EXTRACT_DIR)

        # Find CSV inside tar
        csv_file = find_csv_file(EXTRACT_DIR)
        shutil.copy(csv_file, SAVED_CSV_PATH)

        print("[INFO] Loaded CSV from tar.gz.")
        return pd.read_csv(SAVED_CSV_PATH)

    except Exception as e:
        print("[WARN] Tar.gz loading failed:", e)

    finally:
        # SAFE clean-up
        if os.path.exists(TAR_SAVE_PATH):
            os.remove(TAR_SAVE_PATH)
        if os.path.exists(EXTRACT_DIR):
            shutil.rmtree(EXTRACT_DIR, ignore_errors=True)

    # (3) Remote CSV fallback
    try:
        fallback_name = "latest_quality_snapshot.csv"
        csv_url = BASE_URL + fallback_name

        print("[INFO] Trying fallback CSV:", csv_url)
        download_file(csv_url, SAVED_CSV_PATH)

        print("[INFO] Loaded fallback remote CSV.")
        return pd.read_csv(SAVED_CSV_PATH)

    except Exception as e:
        print("[WARN] Remote fallback CSV unavailable:", e)

    # (4) FINAL fallback
    print("[ERROR] No data source available — returning empty DataFrame.")
    return pd.DataFrame({
        "station_id": [],
        "timestamp": [],
        "quality_score": [],
        "humidity": [],
        "temperature": [],
        "wind_speed": []
    })
