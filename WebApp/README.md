# BLOD WebApp
The BLOD web application provides a visualization of the cloud, along with metadata and FAIRness information. The backend of the web application offers RESTful APIs to programmatically retrieve this information.

## RESTful API Documentation
The backend of the BLOD offers RESTful APIs to programmatically retrieve information about the resources indexed in the catalog.

- Base URL: http://isislab.it:12280/che-cloud/api/CHe_cloud_data
- Content Type: application/json

### Endpoints
1. GET /get_all
Retrieve a list of the available dataset with all the relative metadata. Below a snippet of the response of the first element in the list.

**Response**
```JSON
{
    "_id": "Odeuropa",
    "identifier": "Odeuropa",
    "title": "Odeuropa Ontology",
    "doi": "10.1007/978-3-031-06981-9_23",
    "license": "CC-BY-4.0 license",
    "description": {
        "en": "The Odeuropa data model is an extension of CIDOC-CRM and CRMsci for representing odours and their experiences from a Cultural Heritage perspective. This ontology defines 13 classes and 10 properties."
    },
    "sparql": [
        {}
    ],
    "full_download": [
        {
            "title": "Odeuropa Ontology",
            "download_url": "https://github.com/Odeuropa/ontology/blob/master/odeuropa-ontology.owl",
            "description": ""
        }
    ],
    "website": "https://data.odeuropa.eu/ontology/",
    "domain": "cultural-heritage",
    "contact_point": {
            "name": "",
            "email": ""
    },
    "owner": {
        "name": "",
        "email": ""
    },
    "keywords": [
        "ontology"
    ],
    "newKeyword": "",
    "Image": "",
    "example": [],
    "other_download": [
        {
            "title": "Odeuropa GitHub",
            "access_url": "https://github.com/Odeuropa",
            "description": ""
        }
    ],
    "namespace": "",
    "links": [],
    "time": "",
    "triples": 0
},
```

---


2. GET /dataset_metadata/{id}
Retrieve the metadata for a specific dataset.

**Parameters:**
- id (string): Dataset ID

**Response:**

Same response as before, but metadata for only the Odeuropa dataset if its ID is passed as parameter.

---

3. GET /fairness_data/{id}
Retrieve all the FAIR scores for a specific dataset.

**Parameters:**
- id (string): Dataset ID

**Response:**
```JSON
{
    "KG id": "Odeuropa",
    "KG name": "Odeuropa Ontology",
    "KG SPARQL endpoint": "",
    "RDF dump link": "https://github.com/Odeuropa/ontology/blob/master/odeuropa-ontology.owl']",
    "Ontology": "True",
    "F1-M Unique and persistent ID": "1",
    "F1-D URIs dereferenceability": "0.0",
    "F2a-M - Metadata availability via standard primary sources": "1",
    "F2b-M Metadata availability for all the attributes covered in the FAIR score computation": "0.67",
    "F3-M Data referrable via a DOI": "1",
    "F4-M Metadata registered in a searchable engine": "0",
    "F score": "0.61",
    "A1-D Working access point(s)": "1.0",
    "A1-M Metadata availability via working primary sources": "0",
    "A1.2 Authentication & HTTPS support": "0.0",
    "A2-M Registered in search engines": "0",
    "A score": "0.25",
    "I1-D Standard & open representation format": "0",
    "I1-M Metadata are described with VoID/DCAT predicates": "1",
    "I2 Use of FAIR vocabularies": "0.0",
    "I3-D Degree of connection": "0",
    "I score": "0.25",
    "R1.1 Machine- or human-readable license retrievable via any primary source": "1",
    "R1.2 Publisher information, such as authors, contributors, publishers, and sources": "1",
    "R1.3-D Data organized in a standardized way": "0",
    "R1.3-M Metadata are described with VoID/DCAT predicates": "1",
    "R score": "0.75",
    "FAIR score": "1.86"
}
```

4. GET /all_ch_links
Retrieve the graph data structured as two lists: one for the nodes and one for the links. This format is directly compatible with the D3.js library for rendering the Cloud visualization. Below is a snippet of the response, showcasing a single element from each list (the complete response includes all nodes and links).

**Response:**
```JSON
"nodes": [
    {
        "id": "Odeuropa",
        "title": "Odeuropa Ontology",
        "url": "http://isislab.it:12280/BLOD/fairness-info?dataset_id=Odeuropa",
        "category": "Generic"
    },
],
"links": [
    {
        "source": "hungarian-national-library-catalog",
        "target": "viaf"
    },
]
```