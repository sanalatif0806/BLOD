import requests
import json
import os
from dotenv import load_dotenv
load_dotenv()

# TODO: IDEA to prevent rto find the vocabs uri: try to deference the uri, and get the vacabulary title, then search for the title in FAIRsharing
class FAIRsharingInterface:
    def __init__(self):
        payload={"user": {"login":f"{os.getenv('username')}","password":f"{os.getenv('password')}"} }
        headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
        }
        response = requests.request("POST", 'https://api.fairsharing.org/users/sign_in', headers=headers, data=json.dumps(payload))
        data = response.json()
        print(data)
        self.jwt = data['jwt']
        

    def search_vocabs(self, query):

        url = f"https://api.fairsharing.org/search/fairsharing_records?q={query}&fairsharing_registry=standard"

        headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': "Bearer {0}".format(self.jwt),
        }

        response = requests.request("POST", url, headers=headers)

        print(response.text)

t = FAIRsharingInterface()
t.search_vocabs('https://www.w3.org/TR/skos-reference/')