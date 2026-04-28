"""
BLOD MongoDB → RDF Knowledge Graph Export
==========================================
Converts BLOD.json (MongoDB export) + fairness-data.csv into a proper
RDF Knowledge Graph in Turtle (.ttl) format.

Ontologies used:
  - DCAT  (dataset catalogue)
  - DCTerms (metadata)
  - VoID  (dataset descriptions)
  - FOAF  (agents/contacts)
  - SCHEMA (website, URL)
  - Custom blod: namespace for FAIR scores and BLOD-specific properties

Usage:
  python blod_to_rdf.py

Outputs:
  blod_knowledge_graph.ttl   — Full KG in Turtle format
  blod_knowledge_graph.nt    — N-Triples format (compatible with any triplestore)
"""

import json
import re
import pandas as pd
from rdflib import Graph, Namespace, URIRef, Literal, BNode
from rdflib.namespace import RDF, RDFS, OWL, DCTERMS, FOAF, XSD, DCAT, SKOS

# ── Namespaces ────────────────────────────────────────────────────────────────
BLOD    = Namespace("http://blod.isislab.it/ontology#")
BLODR   = Namespace("http://blod.isislab.it/resource/")
VOID    = Namespace("http://rdfs.org/ns/void#")
SCHEMA  = Namespace("https://schema.org/")
PROV    = Namespace("http://www.w3.org/ns/prov#")
FAIR    = Namespace("http://blod.isislab.it/fair#")
WIKIDATA = Namespace("http://www.wikidata.org/entity/")

# ── Helpers ───────────────────────────────────────────────────────────────────
def safe_uri(value: str) -> URIRef | None:
    """Return a URIRef only if value is a clean single URI, else None."""
    value = value.strip()
    # Reject if it contains spaces (multiple URLs or appended text)
    if ' ' in value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return URIRef(value)
    return None

def clean_id(identifier: str) -> str:
    """Make a safe local name from a dataset identifier."""
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', identifier.strip())

def add_literal(g, subj, pred, value, datatype=None, lang=None):
    """Add a triple only if value is non-empty."""
    if not value or (isinstance(value, str) and not value.strip()):
        return
    if lang:
        g.add((subj, pred, Literal(str(value).strip(), lang=lang)))
    elif datatype:
        g.add((subj, pred, Literal(value, datatype=datatype)))
    else:
        g.add((subj, pred, Literal(str(value).strip())))

# ── Load data ─────────────────────────────────────────────────────────────────
print("Loading BLOD.json...")
with open("/tmp/BLOD_with_sparql/BLOD/WebApp/backend/mongo_data/BLOD.json") as f:
    records = json.load(f)
print(f"  {len(records)} datasets loaded")

print("Loading fairness-data.csv...")
fair_df = pd.read_csv("/tmp/BLOD_with_sparql/BLOD/WebApp/backend/data/fairness-data.csv")
fair_map = {}
for _, row in fair_df.iterrows():
    kg_id = str(row.get("KG id", "")).strip().lower()
    if not kg_id:
        continue
    fair_map[kg_id] = {
        "fair_score":   row.get("FAIR score"),
        "f_score":      row.get("F score"),
        "a_score":      row.get("A score"),
        "i_score":      row.get("I score"),
        "r_score":      row.get("R score"),
        # FAIR sub-metrics (F)
        "f1_m":         row.get("F1-M Unique and persistent ID"),
        "f1_d":         row.get("F1-D URIs dereferenceability"),
        "f2a_m":        row.get("F2a-M - Metadata availability via standard primary sources"),
        "f2b_m":        row.get("F2b-M Metadata availability for all the attributes covered in the FAIR score computation"),
        "f3_m":         row.get("F3-M Data referrable via a DOI"),
        "f4_m":         row.get("F4-M Metadata registered in a searchable engine"),
        # FAIR sub-metrics (A)
        "a1_d":         row.get("A1-D Working access point(s)"),
        "a1_m":         row.get("A1-M Metadata availability via working primary sources"),
        "a1_2":         row.get("A1.2 Authentication & HTTPS support"),
        "a2_m":         row.get("A2-M Registered in search engines"),
        # FAIR sub-metrics (I)
        "i1_d":         row.get("I1-D Standard & open representation format"),
        "i1_m":         row.get("I1-M Metadata are described with VoID/DCAT predicates"),
        "i2":           row.get("I2 Use of FAIR vocabularies"),
        "i3_d":         row.get("I3-D Degree of connection"),
        # FAIR sub-metrics (R)
        "r1_1":         row.get("R1.1 Machine- or human-readable license retrievable via any primary source"),
        "r1_2":         row.get("R1.2 Publisher information such as authors-contributors-publishers and sources"),
        "r1_3_d":       row.get("R1.3-D Data organized in a standardized way"),
        "r1_3_m":       row.get("R1.3-M Metadata are described with VoID/DCAT predicates"),
    }
print(f"  {len(fair_map)} FAIR score records loaded")

# ── Build RDF Graph ───────────────────────────────────────────────────────────
print("Building RDF graph...")
g = Graph()

# Bind prefixes
g.bind("blod",    BLOD)
g.bind("blodr",   BLODR)
g.bind("dcat",    DCAT)
g.bind("dct",     DCTERMS)
g.bind("void",    VOID)
g.bind("foaf",    FOAF)
g.bind("schema",  SCHEMA)
g.bind("skos",    SKOS)
g.bind("prov",    PROV)
g.bind("fair",    FAIR)
g.bind("wd",      WIKIDATA)
g.bind("owl",     OWL)
g.bind("xsd",     XSD)

# ── Ontology declaration ──────────────────────────────────────────────────────
ontology_uri = URIRef("http://blod.isislab.it/ontology")
g.add((ontology_uri, RDF.type,          OWL.Ontology))
g.add((ontology_uri, DCTERMS.title,     Literal("BLOD Biomedical Linked Open Datasets Ontology", lang="en")))
g.add((ontology_uri, DCTERMS.description, Literal(
    "A Knowledge Graph of Biomedical Linked Open Datasets, including FAIR quality scores.", lang="en")))
g.add((ontology_uri, OWL.versionInfo,   Literal("1.0")))

# ── Class definitions ─────────────────────────────────────────────────────────
g.add((BLOD.Dataset,        RDF.type,       OWL.Class))
g.add((BLOD.Dataset,        RDFS.subClassOf, DCAT.Dataset))
g.add((BLOD.Dataset,        RDFS.subClassOf, VOID.Dataset))
g.add((BLOD.Dataset,        RDFS.label,     Literal("BLOD Dataset", lang="en")))

g.add((BLOD.FAIRAssessment, RDF.type,       OWL.Class))
g.add((BLOD.FAIRAssessment, RDFS.label,     Literal("FAIR Assessment", lang="en")))
g.add((BLOD.FAIRAssessment, RDFS.comment,   Literal("A FAIR quality assessment of a biomedical dataset.", lang="en")))

# ── Property definitions ──────────────────────────────────────────────────────
props = {
    BLOD.identifier:    ("Dataset identifier",   OWL.DatatypeProperty),
    BLOD.fairScore:     ("Overall FAIR score",   OWL.DatatypeProperty),
    BLOD.fScore:        ("Findability score",    OWL.DatatypeProperty),
    BLOD.aScore:        ("Accessibility score",  OWL.DatatypeProperty),
    BLOD.iScore:        ("Interoperability score", OWL.DatatypeProperty),
    BLOD.rScore:        ("Reusability score",    OWL.DatatypeProperty),
    BLOD.healthCategory:("Health domain category", OWL.ObjectProperty),
    BLOD.hasFAIR:       ("Has FAIR assessment",  OWL.ObjectProperty),
    BLOD.triples:       ("Number of RDF triples", OWL.DatatypeProperty),
    BLOD.namespace:     ("Dataset RDF namespace", OWL.DatatypeProperty),
    BLOD.domain:        ("Dataset domain",       OWL.DatatypeProperty),
}
for prop, (label, prop_type) in props.items():
    g.add((prop, RDF.type,    prop_type))
    g.add((prop, RDFS.label,  Literal(label, lang="en")))
    g.add((prop, RDFS.domain, BLOD.Dataset))

# ── Health Category resources ─────────────────────────────────────────────────
HEALTH_CATEGORIES = [
    "Clinical & Patient Data",
    "Omics & Molecular Data",
    "Medical Imaging & Signals",
    "Public Health & Surveillance",
    "Biobank & Research Data",
    "Behavioral & Social Data",
    "Terminologies & Metadata",
]

cat_uris = {}
for cat in HEALTH_CATEGORIES:
    cat_id = re.sub(r'[^a-zA-Z0-9]', '_', cat)
    cat_uri = BLODR[f"category/{cat_id}"]
    cat_uris[cat] = cat_uri
    g.add((cat_uri, RDF.type,       BLOD.HealthCategory))
    g.add((cat_uri, RDFS.label,     Literal(cat, lang="en")))
    g.add((cat_uri, SKOS.prefLabel, Literal(cat, lang="en")))

g.add((BLOD.HealthCategory, RDF.type,      OWL.Class))
g.add((BLOD.HealthCategory, RDFS.label,    Literal("Health Domain Category", lang="en")))

# ── Main conversion loop ──────────────────────────────────────────────────────
triples_added = 0
fair_enriched = 0
linked = 0

for record in records:
    identifier = record.get("identifier", "").strip()
    if not identifier:
        continue

    dataset_uri = BLODR[f"dataset/{clean_id(identifier)}"]

    # ── Core types ──
    g.add((dataset_uri, RDF.type,  BLOD.Dataset))
    g.add((dataset_uri, RDF.type,  DCAT.Dataset))
    g.add((dataset_uri, RDF.type,  VOID.Dataset))

    # ── Identity ──
    add_literal(g, dataset_uri, DCTERMS.identifier, identifier)
    add_literal(g, dataset_uri, BLOD.identifier,    identifier)

    # ── Title ──
    title = record.get("title", "").strip()
    add_literal(g, dataset_uri, DCTERMS.title, title, lang="en")
    add_literal(g, dataset_uri, RDFS.label,    title, lang="en")

    # ── Description ──
    desc = record.get("description", "")
    if isinstance(desc, dict):
        for lang, text in desc.items():
            add_literal(g, dataset_uri, DCTERMS.description, text, lang=lang)
    elif isinstance(desc, str):
        add_literal(g, dataset_uri, DCTERMS.description, desc, lang="en")

    # ── Website ──
    website = (record.get("website") or "").strip()
    website_uri = safe_uri(website)
    if website_uri:
        g.add((dataset_uri, SCHEMA.url,    website_uri))
        g.add((dataset_uri, FOAF.homepage, website_uri))

    # ── License ──
    license_url = (record.get("license") or "").strip()
    license_uri = safe_uri(license_url)
    if license_uri:
        g.add((dataset_uri, DCTERMS.license, license_uri))

    # ── DOI ──
    doi = (record.get("doi") or "").strip()
    if doi:
        doi_uri = safe_uri(doi)
        if doi_uri:
            g.add((dataset_uri, DCTERMS.identifier, doi_uri))
        else:
            g.add((dataset_uri, DCTERMS.identifier, Literal(doi)))

    # ── Triples ──
    triples_val = record.get("triples") or ""
    if triples_val:
        try:
            g.add((dataset_uri, VOID.triples,   Literal(int(str(triples_val).replace(",", "")), datatype=XSD.integer)))
            g.add((dataset_uri, BLOD.triples,   Literal(int(str(triples_val).replace(",", "")), datatype=XSD.integer)))
        except (ValueError, TypeError):
            pass

    # ── Namespace ──
    ns = (record.get("namespace") or "").strip()
    if ns:
        add_literal(g, dataset_uri, VOID.uriSpace,   ns)
        add_literal(g, dataset_uri, BLOD.namespace,  ns)

    # ── Domain ──
    domain = (record.get("domain") or "").strip()
    add_literal(g, dataset_uri, BLOD.domain, domain)

    # ── Wikidata link ──
    wd_url = (record.get("wikidataurl") or "").strip()
    wd_uri = safe_uri(wd_url)
    if wd_uri:
        g.add((dataset_uri, OWL.sameAs,    wd_uri))
        g.add((dataset_uri, SCHEMA.sameAs, wd_uri))

    # ── Keywords and Health Categories ──
    for kw in record.get("keywords", []):
        if not kw:
            continue
        kw = kw.strip()
        if kw in cat_uris:
            g.add((dataset_uri, BLOD.healthCategory, cat_uris[kw]))
            g.add((dataset_uri, DCAT.theme,           cat_uris[kw]))
        else:
            g.add((dataset_uri, DCAT.keyword, Literal(kw, lang="en")))

    # ── Contact point ──
    contact = record.get("contact_point", {})
    if contact and (contact.get("name") or contact.get("email")):
        contact_node = BNode()
        g.add((dataset_uri,    DCAT.contactPoint, contact_node))
        g.add((contact_node,   RDF.type,          FOAF.Agent))
        if contact.get("name"):
            g.add((contact_node, FOAF.name,  Literal(contact["name"])))
        if contact.get("email"):
            email = contact["email"].strip()
            if email:
                g.add((contact_node, FOAF.mbox, URIRef(f"mailto:{email}")))

    # ── Owner ──
    owner_raw = record.get("owner", "")
    owner = owner_raw.strip() if isinstance(owner_raw, str) else ""
    if owner:
        owner_node = BNode()
        g.add((dataset_uri,  DCTERMS.publisher, owner_node))
        g.add((owner_node,   RDF.type,          FOAF.Organization))
        g.add((owner_node,   FOAF.name,         Literal(owner)))

    # ── SPARQL endpoint ──
    for ep in record.get("sparql", []):
        if not isinstance(ep, dict): continue
        ep_uri = safe_uri((ep.get("access_url") or ""))
        if ep_uri:
            g.add((dataset_uri, VOID.sparqlEndpoint, ep_uri))

    # ── Example resources ──
    for ex in record.get("example", []):
        if not isinstance(ex, dict): continue
        ex_uri = safe_uri((ex.get("access_url") or ""))
        if ex_uri:
            dist = BNode()
            g.add((dataset_uri, DCAT.distribution,  dist))
            g.add((dist,        RDF.type,            DCAT.Distribution))
            g.add((dist,        DCAT.accessURL,      ex_uri))
            mt = (ex.get("media_type") or "").strip()
            if mt:
                g.add((dist, DCAT.mediaType, Literal(mt)))
            ex_title = (ex.get("title") or "").strip()
            if ex_title:
                g.add((dist, DCTERMS.title, Literal(ex_title, lang="en")))

    # ── Full download ──
    for dl in record.get("full_download", []):
        if not isinstance(dl, dict): continue
        dl_uri = safe_uri((dl.get("access_url") or ""))
        if dl_uri:
            dist = BNode()
            g.add((dataset_uri, DCAT.distribution, dist))
            g.add((dist,        RDF.type,           DCAT.Distribution))
            g.add((dist,        DCAT.downloadURL,   dl_uri))
            mt = (dl.get("media_type") or "").strip()
            if mt:
                g.add((dist, DCAT.mediaType, Literal(mt)))

    # ── Inter-dataset links (owl:sameAs / void:target) ──
    for lnk in record.get("links", []):
        target_id = lnk.get("target", "").strip()
        link_value = lnk.get("value", "")
        if not target_id:
            continue
        target_uri = BLODR[f"dataset/{clean_id(target_id)}"]
        linkset = BNode()
        g.add((dataset_uri, VOID.subset,       linkset))
        g.add((linkset,     RDF.type,          VOID.Linkset))
        g.add((linkset,     VOID.target,       dataset_uri))
        g.add((linkset,     VOID.target,       target_uri))
        if link_value:
            try:
                g.add((linkset, VOID.triples, Literal(int(link_value), datatype=XSD.integer)))
            except (ValueError, TypeError):
                pass
        linked += 1

    # ── FAIR Assessment ──
    fair = fair_map.get(identifier.lower())
    if fair:
        fair_uri = BLODR[f"fair/{clean_id(identifier)}"]
        g.add((dataset_uri, BLOD.hasFAIR,      fair_uri))
        g.add((fair_uri,    RDF.type,           BLOD.FAIRAssessment))
        g.add((fair_uri,    DCTERMS.subject,    dataset_uri))

        score_fields = {
            BLOD.fairScore: ("fair_score", "Overall FAIR score"),
            BLOD.fScore:    ("f_score",    "Findability score"),
            BLOD.aScore:    ("a_score",    "Accessibility score"),
            BLOD.iScore:    ("i_score",    "Interoperability score"),
            BLOD.rScore:    ("r_score",    "Reusability score"),
            # F sub-metrics
            FAIR.F1_M:      ("f1_m",       "F1-M: Unique and persistent ID"),
            FAIR.F1_D:      ("f1_d",       "F1-D: URIs dereferenceability"),
            FAIR.F2a_M:     ("f2a_m",      "F2a-M: Metadata availability via standard sources"),
            FAIR.F2b_M:     ("f2b_m",      "F2b-M: Metadata availability for FAIR attributes"),
            FAIR.F3_M:      ("f3_m",       "F3-M: Data referrable via DOI"),
            FAIR.F4_M:      ("f4_m",       "F4-M: Metadata in searchable engine"),
            # A sub-metrics
            FAIR.A1_D:      ("a1_d",       "A1-D: Working access points"),
            FAIR.A1_M:      ("a1_m",       "A1-M: Metadata via working sources"),
            FAIR.A1_2:      ("a1_2",       "A1.2: Authentication & HTTPS support"),
            FAIR.A2_M:      ("a2_m",       "A2-M: Registered in search engines"),
            # I sub-metrics
            FAIR.I1_D:      ("i1_d",       "I1-D: Standard open representation format"),
            FAIR.I1_M:      ("i1_m",       "I1-M: Metadata with VoID/DCAT predicates"),
            FAIR.I2:        ("i2",         "I2: Use of FAIR vocabularies"),
            FAIR.I3_D:      ("i3_d",       "I3-D: Degree of connection"),
            # R sub-metrics
            FAIR.R1_1:      ("r1_1",       "R1.1: License retrievable"),
            FAIR.R1_2:      ("r1_2",       "R1.2: Publisher information"),
            FAIR.R1_3_D:    ("r1_3_d",     "R1.3-D: Data in standardized format"),
            FAIR.R1_3_M:    ("r1_3_m",     "R1.3-M: Metadata with VoID/DCAT"),
        }

        for prop, (key, label) in score_fields.items():
            val = fair.get(key)
            if val is not None:
                try:
                    fval = float(val)
                    if not pd.isna(fval):
                        g.add((fair_uri, prop, Literal(round(fval, 4), datatype=XSD.decimal)))
                        # Also attach top-level scores directly on dataset
                        if prop in (BLOD.fairScore, BLOD.fScore, BLOD.aScore, BLOD.iScore, BLOD.rScore):
                            g.add((dataset_uri, prop, Literal(round(fval, 4), datatype=XSD.decimal)))
                except (ValueError, TypeError):
                    pass
        fair_enriched += 1

    triples_added += 1

print(f"  Processed: {triples_added} datasets")
print(f"  FAIR enriched: {fair_enriched} datasets")
print(f"  Inter-dataset links: {linked}")
print(f"  Total RDF triples: {len(g)}")

# ── Serialize ─────────────────────────────────────────────────────────────────
print("\nSerializing to Turtle (.ttl)...")
g.serialize(destination="/home/claude/blod_knowledge_graph.ttl", format="turtle")

print("Serializing to N-Triples (.nt)...")
g.serialize(destination="/home/claude/blod_knowledge_graph.nt", format="nt")

print("\nDone!")
print(f"  blod_knowledge_graph.ttl — {len(g)} triples (human-readable Turtle)")
print(f"  blod_knowledge_graph.nt  — {len(g)} triples (N-Triples, triplestore import)")
