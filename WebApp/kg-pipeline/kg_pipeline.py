#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              BLOD Knowledge Graph Pipeline — kg_pipeline.py                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Converts any MongoDB JSON export + optional FAIR CSV into a full RDF KG    ║
║  and loads it into a Fuseki triplestore automatically.                       ║
║                                                                              ║
║  USAGE:                                                                      ║
║    # Full pipeline (convert + load)                                          ║
║    python kg_pipeline.py --json BLOD.json --fair fairness-data.csv          ║
║                                                                              ║
║    # Convert only (don't load to Fuseki)                                     ║
║    python kg_pipeline.py --json BLOD.json --no-load                         ║
║                                                                              ║
║    # Load existing .nt file to Fuseki                                        ║
║    python kg_pipeline.py --load-only blod_knowledge_graph.nt               ║
║                                                                              ║
║    # Custom output paths                                                     ║
║    python kg_pipeline.py --json data.json --out-dir ./output               ║
║                                                                              ║
║    # Custom Fuseki settings                                                  ║
║    python kg_pipeline.py --json BLOD.json \                                 ║
║      --fuseki-url http://localhost:3030 \                                    ║
║      --fuseki-dataset blod \                                                 ║
║      --fuseki-password mypassword                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

REQUIREMENTS:
    pip install rdflib pandas requests

REUSABILITY:
    This script is designed to work with ANY dataset that follows the BLOD
    MongoDB schema. To adapt for a different dataset:
      1. Edit FIELD_MAP to match your JSON field names
      2. Edit FAIR_SCORE_COLUMNS to match your FAIR CSV column names
      3. Edit BASE_URI to your own namespace
      4. Edit HEALTH_CATEGORIES if your categories differ
"""

import argparse
import json
import math
import os
import re
import sys
import time

import requests

# ── Optional imports (graceful failure if not installed) ─────────────────────
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    from rdflib import Graph, Namespace, URIRef, Literal, BNode
    from rdflib.namespace import (
        RDF, RDFS, OWL, DCTERMS, FOAF, XSD, DCAT, SKOS
    )
    HAS_RDFLIB = True
except ImportError:
    HAS_RDFLIB = False


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  CONFIGURATION — Edit these to adapt for a different dataset               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

BASE_URI        = "http://blod.isislab.it"
ONTOLOGY_URI    = f"{BASE_URI}/ontology#"
RESOURCE_URI    = f"{BASE_URI}/resource/"
FAIR_URI        = f"{BASE_URI}/fair#"

# Maps your JSON field names → RDF predicates
# Format: "json_field": ("predicate_namespace", "predicate_local_name", "type")
# Types: "literal", "uri", "lang_literal", "integer", "decimal"
FIELD_MAP = {
    "identifier":  ("DCTERMS", "identifier",  "literal"),
    "title":       ("DCTERMS", "title",        "lang_literal"),
    "license":     ("DCTERMS", "license",      "uri"),
    "doi":         ("DCTERMS", "identifier",   "literal"),
    "website":     ("SCHEMA",  "url",          "uri"),
    "triples":     ("VOID",    "triples",      "integer"),
    "namespace":   ("VOID",    "uriSpace",     "literal"),
    "domain":      ("BLOD",    "domain",       "literal"),
    "wikidataurl": ("OWL",     "sameAs",       "uri"),
}

# FAIR CSV column names → internal field names
FAIR_SCORE_COLUMNS = {
    "KG id":      "__id__",
    "FAIR score": "fair_score",
    "F score":    "f_score",
    "A score":    "a_score",
    "I score":    "i_score",
    "R score":    "r_score",
    # Sub-metrics
    "F1-M Unique and persistent ID":                                         "f1_m",
    "F1-D URIs dereferenceability":                                          "f1_d",
    "F2a-M - Metadata availability via standard primary sources":            "f2a_m",
    "F2b-M Metadata availability for all the attributes covered in the FAIR score computation": "f2b_m",
    "F3-M Data referrable via a DOI":                                        "f3_m",
    "F4-M Metadata registered in a searchable engine":                       "f4_m",
    "A1-D Working access point(s)":                                          "a1_d",
    "A1-M Metadata availability via working primary sources":                "a1_m",
    "A1.2 Authentication & HTTPS support":                                   "a1_2",
    "A2-M Registered in search engines":                                     "a2_m",
    "I1-D Standard & open representation format":                            "i1_d",
    "I1-M Metadata are described with VoID/DCAT predicates":                 "i1_m",
    "I2 Use of FAIR vocabularies":                                           "i2",
    "I3-D Degree of connection":                                             "i3_d",
    "R1.1 Machine- or human-readable license retrievable via any primary source": "r1_1",
    "R1.2 Publisher information such as authors-contributors-publishers and sources": "r1_2",
    "R1.3-D Data organized in a standardized way":                           "r1_3_d",
    "R1.3-M Metadata are described with VoID/DCAT predicates":               "r1_3_m",
}

# Health categories — add/edit for your domain
HEALTH_CATEGORIES = [
    "Clinical & Patient Data",
    "Omics & Molecular Data",
    "Medical Imaging & Signals",
    "Public Health & Surveillance",
    "Biobank & Research Data",
    "Behavioral & Social Data",
    "Terminologies & Metadata",
]


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  HELPERS                                                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def log(msg, level="INFO"):
    icons = {"INFO": "ℹ️ ", "OK": "✅", "WARN": "⚠️ ", "ERROR": "❌", "STEP": "🔷"}
    print(f"  {icons.get(level, '  ')} {msg}")


def clean_id(s: str) -> str:
    """Make a safe local URI segment from any string."""
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', s.strip())


def safe_uri(value: str):
    """Return value as URIRef only if it's a clean single HTTP URI."""
    if not value:
        return None
    value = value.strip()
    if ' ' in value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return URIRef(value)
    return None


def is_nan(val):
    try:
        return math.isnan(float(val))
    except (TypeError, ValueError):
        return False


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STEP 1 — LOAD DATA                                                         ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def load_json(path: str) -> list:
    log(f"Loading JSON: {path}", "STEP")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        # Handle both {"data": [...]} and direct list
        data = data.get("data") or data.get("records") or list(data.values())[0]
    log(f"Loaded {len(data)} records", "OK")
    return data


def load_fair_csv(path: str) -> dict:
    """Returns dict: lowercase identifier → {field: value}"""
    if not path or not os.path.exists(path):
        log("No FAIR CSV provided — skipping FAIR score enrichment", "WARN")
        return {}
    if not HAS_PANDAS:
        log("pandas not installed — skipping FAIR CSV. Run: pip install pandas", "WARN")
        return {}

    log(f"Loading FAIR CSV: {path}", "STEP")
    df = pd.read_csv(path)

    fair_map = {}
    id_col = next((c for c in df.columns if c.strip() == "KG id"), None)
    if not id_col:
        log("Could not find 'KG id' column in FAIR CSV", "WARN")
        return {}

    for _, row in df.iterrows():
        kg_id = str(row.get(id_col, "")).strip().lower()
        if not kg_id:
            continue
        record = {}
        for col, field in FAIR_SCORE_COLUMNS.items():
            if field == "__id__" or col not in df.columns:
                continue
            val = row.get(col)
            if val is not None and not is_nan(val):
                try:
                    record[field] = float(val)
                except (TypeError, ValueError):
                    pass
        if record:
            fair_map[kg_id] = record

    log(f"Loaded FAIR scores for {len(fair_map)} datasets", "OK")
    return fair_map


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STEP 2 — BUILD RDF GRAPH                                                   ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def build_graph(records: list, fair_map: dict) -> Graph:
    if not HAS_RDFLIB:
        log("rdflib not installed. Run: pip install rdflib", "ERROR")
        sys.exit(1)

    log("Building RDF graph…", "STEP")

    # Namespaces
    BLOD   = Namespace(ONTOLOGY_URI)
    BLODR  = Namespace(RESOURCE_URI)
    FAIR   = Namespace(FAIR_URI)
    VOID   = Namespace("http://rdfs.org/ns/void#")
    SCHEMA = Namespace("https://schema.org/")
    PROV   = Namespace("http://www.w3.org/ns/prov#")

    g = Graph()
    g.bind("blod",   BLOD)
    g.bind("blodr",  BLODR)
    g.bind("dcat",   DCAT)
    g.bind("dct",    DCTERMS)
    g.bind("void",   VOID)
    g.bind("foaf",   FOAF)
    g.bind("schema", SCHEMA)
    g.bind("skos",   SKOS)
    g.bind("fair",   FAIR)
    g.bind("owl",    OWL)
    g.bind("xsd",    XSD)

    # Ontology header
    ont_uri = URIRef(f"{BASE_URI}/ontology")
    g.add((ont_uri, RDF.type,         OWL.Ontology))
    g.add((ont_uri, DCTERMS.title,    Literal("BLOD Knowledge Graph", lang="en")))
    g.add((ont_uri, OWL.versionInfo,  Literal(f"Generated: {time.strftime('%Y-%m-%d %H:%M')}")))

    # Class definitions
    g.add((BLOD.Dataset,        RDF.type,       OWL.Class))
    g.add((BLOD.Dataset,        RDFS.subClassOf, DCAT.Dataset))
    g.add((BLOD.Dataset,        RDFS.subClassOf, VOID.Dataset))
    g.add((BLOD.FAIRAssessment, RDF.type,       OWL.Class))
    g.add((BLOD.HealthCategory, RDF.type,       OWL.Class))

    # Health category instances
    cat_uris = {}
    for cat in HEALTH_CATEGORIES:
        cat_id  = clean_id(cat)
        cat_uri = BLODR[f"category/{cat_id}"]
        cat_uris[cat] = cat_uri
        g.add((cat_uri, RDF.type,       BLOD.HealthCategory))
        g.add((cat_uri, RDFS.label,     Literal(cat, lang="en")))
        g.add((cat_uri, SKOS.prefLabel, Literal(cat, lang="en")))

    # Process records
    n_processed = 0
    n_fair = 0
    n_links = 0

    for record in records:
        identifier = (record.get("identifier") or "").strip()
        if not identifier:
            continue

        ds_uri = BLODR[f"dataset/{clean_id(identifier)}"]

        # Types
        g.add((ds_uri, RDF.type, BLOD.Dataset))
        g.add((ds_uri, RDF.type, DCAT.Dataset))
        g.add((ds_uri, RDF.type, VOID.Dataset))

        # Core identity
        g.add((ds_uri, DCTERMS.identifier, Literal(identifier)))
        g.add((ds_uri, BLOD.identifier,    Literal(identifier)))

        # Title
        title = (record.get("title") or "").strip()
        if title:
            g.add((ds_uri, DCTERMS.title, Literal(title, lang="en")))
            g.add((ds_uri, RDFS.label,    Literal(title, lang="en")))

        # Description
        desc = record.get("description", "")
        if isinstance(desc, dict):
            for lang, text in desc.items():
                if text and isinstance(text, str):
                    g.add((ds_uri, DCTERMS.description, Literal(text.strip(), lang=lang)))
        elif isinstance(desc, str) and desc.strip():
            g.add((ds_uri, DCTERMS.description, Literal(desc.strip(), lang="en")))

        # Website
        ws_uri = safe_uri(record.get("website") or "")
        if ws_uri:
            g.add((ds_uri, SCHEMA.url,    ws_uri))
            g.add((ds_uri, FOAF.homepage, ws_uri))

        # License
        lic_uri = safe_uri(record.get("license") or "")
        if lic_uri:
            g.add((ds_uri, DCTERMS.license, lic_uri))

        # DOI
        doi = (record.get("doi") or "").strip()
        if doi and doi != "-":
            doi_uri = safe_uri(doi)
            if doi_uri:
                g.add((ds_uri, DCTERMS.identifier, doi_uri))
            else:
                g.add((ds_uri, DCTERMS.identifier, Literal(doi)))

        # Triples count
        triples_val = record.get("triples") or ""
        if triples_val:
            try:
                t = int(str(triples_val).replace(",", "").strip())
                g.add((ds_uri, VOID.triples, Literal(t, datatype=XSD.integer)))
                g.add((ds_uri, BLOD.triples, Literal(t, datatype=XSD.integer)))
            except (ValueError, TypeError):
                pass

        # Namespace
        ns = (record.get("namespace") or "").strip()
        if ns and ' ' not in ns:
            g.add((ds_uri, VOID.uriSpace, Literal(ns)))

        # Domain
        domain = (record.get("domain") or "").strip()
        if domain:
            g.add((ds_uri, BLOD.domain, Literal(domain)))

        # Wikidata
        wd = safe_uri(record.get("wikidataurl") or "")
        if wd:
            g.add((ds_uri, OWL.sameAs,    wd))
            g.add((ds_uri, SCHEMA.sameAs, wd))

        # Keywords & health categories
        for kw in (record.get("keywords") or []):
            if not kw:
                continue
            kw = kw.strip()
            if kw in cat_uris:
                g.add((ds_uri, BLOD.healthCategory, cat_uris[kw]))
                g.add((ds_uri, DCAT.theme,          cat_uris[kw]))
            else:
                g.add((ds_uri, DCAT.keyword, Literal(kw, lang="en")))

        # Contact point
        contact = record.get("contact_point") or {}
        if isinstance(contact, dict) and (contact.get("name") or contact.get("email")):
            cn = BNode()
            g.add((ds_uri, DCAT.contactPoint, cn))
            g.add((cn,     RDF.type,          FOAF.Agent))
            if contact.get("name"):
                g.add((cn, FOAF.name, Literal(str(contact["name"]))))
            if contact.get("email"):
                em = str(contact["email"]).strip()
                if em and "@" in em:
                    g.add((cn, FOAF.mbox, URIRef(f"mailto:{em}")))

        # Owner
        owner_raw = record.get("owner") or ""
        owner = owner_raw.strip() if isinstance(owner_raw, str) else ""
        if owner:
            on = BNode()
            g.add((ds_uri, DCTERMS.publisher, on))
            g.add((on,     RDF.type,          FOAF.Organization))
            g.add((on,     FOAF.name,         Literal(owner)))

        # SPARQL endpoints
        for ep in (record.get("sparql") or []):
            if not isinstance(ep, dict):
                continue
            ep_uri = safe_uri(ep.get("access_url") or "")
            if ep_uri:
                g.add((ds_uri, VOID.sparqlEndpoint, ep_uri))

        # Distributions (examples + downloads)
        for dist_list, url_pred in [
            (record.get("example", []),       DCAT.accessURL),
            (record.get("full_download", []), DCAT.downloadURL),
        ]:
            for item in (dist_list or []):
                if not isinstance(item, dict):
                    continue
                item_uri = safe_uri(item.get("access_url") or "")
                if item_uri:
                    dist = BNode()
                    g.add((ds_uri, DCAT.distribution, dist))
                    g.add((dist,   RDF.type,           DCAT.Distribution))
                    g.add((dist,   url_pred,            item_uri))
                    mt = (item.get("media_type") or "").strip()
                    if mt:
                        g.add((dist, DCAT.mediaType, Literal(mt)))
                    t = (item.get("title") or "").strip()
                    if t:
                        g.add((dist, DCTERMS.title, Literal(t, lang="en")))

        # Inter-dataset links (void:Linkset)
        for lnk in (record.get("links") or []):
            if not isinstance(lnk, dict):
                continue
            target_id = (lnk.get("target") or "").strip()
            if not target_id:
                continue
            target_uri = BLODR[f"dataset/{clean_id(target_id)}"]
            ls = BNode()
            g.add((ds_uri, VOID.subset,  ls))
            g.add((ls,     RDF.type,     VOID.Linkset))
            g.add((ls,     VOID.target,  ds_uri))
            g.add((ls,     VOID.target,  target_uri))
            lv = lnk.get("value")
            if lv:
                try:
                    g.add((ls, VOID.triples, Literal(int(lv), datatype=XSD.integer)))
                except (TypeError, ValueError):
                    pass
            n_links += 1

        # FAIR Assessment
        fair = fair_map.get(identifier.lower())
        if fair:
            fair_uri_inst = BLODR[f"fair/{clean_id(identifier)}"]
            g.add((ds_uri,          BLOD.hasFAIR,  fair_uri_inst))
            g.add((fair_uri_inst,   RDF.type,      BLOD.FAIRAssessment))
            g.add((fair_uri_inst,   DCTERMS.subject, ds_uri))

            score_props = {
                "fair_score": BLOD.fairScore,
                "f_score":    BLOD.fScore,
                "a_score":    BLOD.aScore,
                "i_score":    BLOD.iScore,
                "r_score":    BLOD.rScore,
                "f1_m":  FAIR.F1_M,  "f1_d":  FAIR.F1_D,
                "f2a_m": FAIR.F2a_M, "f2b_m": FAIR.F2b_M,
                "f3_m":  FAIR.F3_M,  "f4_m":  FAIR.F4_M,
                "a1_d":  FAIR.A1_D,  "a1_m":  FAIR.A1_M,
                "a1_2":  FAIR.A1_2,  "a2_m":  FAIR.A2_M,
                "i1_d":  FAIR.I1_D,  "i1_m":  FAIR.I1_M,
                "i2":    FAIR.I2,    "i3_d":  FAIR.I3_D,
                "r1_1":  FAIR.R1_1,  "r1_2":  FAIR.R1_2,
                "r1_3_d": FAIR.R1_3_D, "r1_3_m": FAIR.R1_3_M,
            }
            for field, prop in score_props.items():
                val = fair.get(field)
                if val is not None and not is_nan(val):
                    lit = Literal(round(float(val), 4), datatype=XSD.decimal)
                    g.add((fair_uri_inst, prop, lit))
                    # Top-level FAIR scores also directly on the dataset
                    if field in ("fair_score", "f_score", "a_score", "i_score", "r_score"):
                        g.add((ds_uri, prop, lit))
            n_fair += 1

        n_processed += 1

    log(f"Processed {n_processed} datasets", "OK")
    log(f"FAIR enriched: {n_fair} datasets", "OK")
    log(f"Inter-dataset links: {n_links}", "OK")
    log(f"Total RDF triples: {len(g):,}", "OK")
    return g


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STEP 3 — SERIALIZE                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def serialize_graph(g: Graph, out_dir: str, base_name: str = "blod_knowledge_graph"):
    os.makedirs(out_dir, exist_ok=True)

    ttl_path = os.path.join(out_dir, f"{base_name}.ttl")
    nt_path  = os.path.join(out_dir, f"{base_name}.nt")

    log(f"Serializing to Turtle: {ttl_path}", "STEP")
    g.serialize(destination=ttl_path, format="turtle")
    log(f"Saved ({os.path.getsize(ttl_path) // 1024} KB)", "OK")

    log(f"Serializing to N-Triples: {nt_path}", "STEP")
    g.serialize(destination=nt_path, format="nt")
    log(f"Saved ({os.path.getsize(nt_path) // 1024} KB)", "OK")

    return ttl_path, nt_path


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STEP 4 — LOAD TO FUSEKI                                                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def wait_for_fuseki(fuseki_url: str, user: str, password: str, timeout: int = 60):
    log(f"Waiting for Fuseki at {fuseki_url}…", "STEP")
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{fuseki_url}/$/ping", auth=(user, password), timeout=3)
            if r.status_code == 200:
                log("Fuseki is ready", "OK")
                return True
        except requests.exceptions.RequestException:
            pass
        time.sleep(3)
    log(f"Fuseki did not respond within {timeout}s", "ERROR")
    return False


def create_dataset_if_missing(fuseki_url: str, dataset: str, user: str, password: str):
    """Create the Fuseki dataset if it doesn't exist yet."""
    check_url = f"{fuseki_url}/$/datasets/{dataset}"
    r = requests.get(check_url, auth=(user, password), timeout=5)
    if r.status_code == 200:
        log(f"Dataset /{dataset} already exists", "OK")
        return
    log(f"Creating dataset /{dataset}…", "STEP")
    r = requests.post(
        f"{fuseki_url}/$/datasets",
        auth=(user, password),
        data={"dbName": dataset, "dbType": "tdb2"},
        timeout=10,
    )
    if r.status_code in (200, 201):
        log(f"Dataset /{dataset} created", "OK")
    else:
        log(f"Could not create dataset: {r.status_code} {r.text[:200]}", "WARN")


def get_triple_count(fuseki_url: str, dataset: str, user: str, password: str) -> int:
    try:
        r = requests.get(
            f"{fuseki_url}/{dataset}/sparql",
            params={"query": "SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }"},
            headers={"Accept": "application/sparql-results+json"},
            auth=(user, password),
            timeout=15,
        )
        bindings = r.json()["results"]["bindings"]
        return int(bindings[0]["count"]["value"])
    except Exception:
        return -1


def clear_dataset(fuseki_url: str, dataset: str, user: str, password: str):
    log(f"Clearing dataset /{dataset}…", "STEP")
    r = requests.post(
        f"{fuseki_url}/{dataset}/update",
        data={"update": "CLEAR ALL"},
        auth=(user, password),
        timeout=15,
    )
    if r.status_code == 200:
        log("Dataset cleared", "OK")
    else:
        log(f"Clear failed: {r.status_code}", "WARN")


def load_to_fuseki(
    nt_path: str,
    fuseki_url: str = "http://localhost:3030",
    dataset: str    = "blod",
    user: str       = "admin",
    password: str   = "blod_admin",
    force: bool     = False,
):
    log(f"Loading to Fuseki: {fuseki_url}/{dataset}", "STEP")

    if not wait_for_fuseki(fuseki_url, user, password):
        log("Cannot reach Fuseki — skipping load", "ERROR")
        return False

    create_dataset_if_missing(fuseki_url, dataset, user, password)

    # Check existing count
    existing = get_triple_count(fuseki_url, dataset, user, password)
    if existing > 1000 and not force:
        log(f"Dataset already has {existing:,} triples. Use --force to reload.", "WARN")
        return True

    if existing > 0 and force:
        clear_dataset(fuseki_url, dataset, user, password)

    # Upload
    log(f"Uploading {os.path.basename(nt_path)} ({os.path.getsize(nt_path)//1024} KB)…", "STEP")
    log("This may take 30–60 seconds…")

    with open(nt_path, "rb") as f:
        r = requests.post(
            f"{fuseki_url}/{dataset}/data",
            data=f,
            headers={"Content-Type": "application/n-triples"},
            auth=(user, password),
            timeout=300,
        )

    if r.status_code in (200, 201):
        new_count = get_triple_count(fuseki_url, dataset, user, password)
        log(f"Upload successful — {new_count:,} triples now in Fuseki", "OK")
        log(f"SPARQL endpoint: {fuseki_url}/{dataset}/sparql", "OK")
        log(f"Web UI: {fuseki_url}", "OK")
        return True
    else:
        log(f"Upload failed: HTTP {r.status_code}", "ERROR")
        log(r.text[:500], "ERROR")
        return False


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  MAIN                                                                        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def main():
    parser = argparse.ArgumentParser(
        description="BLOD Knowledge Graph Pipeline — Convert MongoDB JSON to RDF and load into Fuseki",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--json",            help="Path to MongoDB JSON export (BLOD.json)")
    parser.add_argument("--fair",            help="Path to FAIR scores CSV (fairness-data.csv)", default=None)
    parser.add_argument("--out-dir",         help="Output directory for .ttl and .nt files", default="./kg_output")
    parser.add_argument("--out-name",        help="Base name for output files", default="blod_knowledge_graph")
    parser.add_argument("--no-load",         help="Convert only, don't load to Fuseki", action="store_true")
    parser.add_argument("--load-only",       help="Skip conversion, load existing .nt file to Fuseki", default=None)
    parser.add_argument("--force",           help="Force reload even if Fuseki already has data", action="store_true")
    parser.add_argument("--fuseki-url",      help="Fuseki URL", default="http://localhost:3030")
    parser.add_argument("--fuseki-dataset",  help="Fuseki dataset name", default="blod")
    parser.add_argument("--fuseki-user",     help="Fuseki admin username", default="admin")
    parser.add_argument("--fuseki-password", help="Fuseki admin password", default="blod_admin")

    args = parser.parse_args()

    print()
    print("=" * 60)
    print("  BLOD Knowledge Graph Pipeline")
    print("=" * 60)

    nt_path = None

    # ── Convert ──────────────────────────────────────────────────────────────
    if args.load_only:
        nt_path = args.load_only
        log(f"Using existing file: {nt_path}", "INFO")
    elif args.json:
        if not HAS_RDFLIB:
            log("rdflib is required. Run: pip install rdflib", "ERROR")
            sys.exit(1)

        records  = load_json(args.json)
        fair_map = load_fair_csv(args.fair) if args.fair else {}
        g        = build_graph(records, fair_map)
        _, nt_path = serialize_graph(g, args.out_dir, args.out_name)
    else:
        parser.print_help()
        sys.exit(0)

    # ── Load ─────────────────────────────────────────────────────────────────
    if not args.no_load and nt_path:
        load_to_fuseki(
            nt_path       = nt_path,
            fuseki_url    = args.fuseki_url,
            dataset       = args.fuseki_dataset,
            user          = args.fuseki_user,
            password      = args.fuseki_password,
            force         = args.force,
        )

    print()
    print("=" * 60)
    print("  Pipeline complete")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
