"""
sparql_query.py  –  Lightweight SPARQL SELECT engine over the BLOD quality DataFrame.

Exposed via Flask as:
    GET/POST  /sparql/query?query=<SPARQL>
    GET       /sparql/info          – predicate / column reference
    GET       /sparql/columns       – raw list of available DataFrame columns

Supported SPARQL subset
------------------------
  SELECT ?var1 ?var2 … WHERE { triple patterns }
  SELECT * WHERE { triple patterns }

Triple patterns
  ?s  blod:columnName  ?var       →  project column as ?var
  ?s  blod:columnName  "literal"  →  filter column == literal

FILTER expressions (inside WHERE { })
  FILTER(REGEX(?var, "pattern" [, "flags"]))
  FILTER(?var = "value")
  FILTER(?var > number)   FILTER(?var < number)
  FILTER(?var >= number)  FILTER(?var <= number)

Modifiers
  LIMIT n   OFFSET n   ORDER BY [ASC|DESC](?var)

Prefix
  blod:  –  a column name in the quality DataFrame (spaces replaced by underscores)
  
  Additionally the following semantic aliases are resolved so that standard
  RDF/FAIR predicates work out of the box:
    dct:identifier        → KG id
    dct:title / rdfs:label → KG name
    blod:fair_score        → FAIR score
    blod:f_score           → F score
    blod:a_score           → A score
    blod:i_score           → I score
    blod:r_score           → R score
    blod:sparql_endpoint   → Sparql endpoint
    blod:sparql_url        → SPARQL endpoint URL
    blod:triples           → Number of triples (metadata)
    blod:license           → License machine redeable (metadata)
    blod:rdf_dump          → Availability of RDF dump (metadata)
    blod:domain            → Dataset URL
    void:sparqlEndpoint    → SPARQL endpoint URL
    dct:license            → License machine redeable (metadata)
    void:triples           → Number of triples (metadata)
"""

import re
import math
from flask import Blueprint, request, jsonify

sparql_bp = Blueprint("sparql", __name__, url_prefix="/sparql")

# ── Semantic alias map: SPARQL prefix:local → DataFrame column ───────────────
ALIAS_MAP = {
    # Dublin Core / standard predicates
    "dct:identifier":       "KG id",
    "dct:title":            "KG name",
    "rdfs:label":           "KG name",
    "dct:license":          "License machine redeable (metadata)",
    "void:triples":         "Number of triples (metadata)",
    "void:sparqlEndpoint":  "SPARQL endpoint URL",
    # BLOD convenience shortcuts
    "blod:kg_id":           "KG id",
    "blod:kg_name":         "KG name",
    "blod:fair_score":      "FAIR score",
    "blod:f_score":         "F score",
    "blod:a_score":         "A score",
    "blod:i_score":         "I score",
    "blod:r_score":         "R score",
    "blod:sparql_endpoint": "Sparql endpoint",
    "blod:sparql_url":      "SPARQL endpoint URL",
    "blod:triples":         "Number of triples (metadata)",
    "blod:license":         "License machine redeable (metadata)",
    "blod:rdf_dump":        "Availability of RDF dump (metadata)",
    "blod:domain":          "Dataset URL",
    "blod:description":     "Description",
    "blod:url":             "Dataset URL",
    "blod:publisher":       "Publisher",
    "blod:author":          "Author (metadata)",
    "blod:inactive_links":  "Inactive links",
    "blod:void_file":       "Availability VoID file",
    "blod:uri_deref":       "URIs Deferenceability",
}


def _resolve_predicate(pred: str, df_columns: list) -> str | None:
    """Resolve a prefixed predicate to a DataFrame column name."""
    # 1. Direct alias
    if pred in ALIAS_MAP:
        col = ALIAS_MAP[pred]
        return col if col in df_columns else None
    # 2. blod:snake_case or blod:camelCase → reconstruct column name
    if pred.startswith("blod:"):
        local = pred[5:]
        # Convert camelCase to snake_case first (e.g. fairScore → fair_score)
        local = re.sub(r'([a-z])([A-Z])', r'\1_\2', local).lower()
        local = local.replace("_", " ")
        # case-insensitive match
        for col in df_columns:
            if col.lower() == local.lower():
                return col
    return None


# ── Parser ───────────────────────────────────────────────────────────────────

def _parse_sparql(query: str):
    q = re.sub(r"\s+", " ", query).strip()

    # SELECT clause
    sel = re.search(r"SELECT\s+(DISTINCT\s+)?(.*?)\s+WHERE", q, re.I)
    if not sel:
        raise ValueError("Only SELECT … WHERE queries are supported.")
    vars_part = sel.group(2).strip()
    select_star = vars_part == "*"
    variables = [] if select_star else [m.group(1) for m in re.finditer(r"[?$](\w+)", vars_part)]

    # WHERE clause
    where_m = re.search(r"WHERE\s*\{([\s\S]*?)\}(?:\s|$)", q, re.I)
    if not where_m:
        raise ValueError("Missing WHERE { } clause.")
    where_body = where_m.group(1).strip()

    # Triple patterns: ?s pred ?var  or  ?s pred "literal"
    patterns = []
    triple_re = re.compile(r'[?$]\w+\s+([\w:]+)\s+(?:[?$](\w+)|"([^"]*)")')
    for m in triple_re.finditer(where_body):
        patterns.append({
            "predicate": m.group(1),
            "variable":  m.group(2),     # None if literal binding
            "literal":   m.group(3),     # None if variable binding
        })

    # FILTER clauses
    filters = []
    for m in re.finditer(r"FILTER\s*\(([^)]+)\)", where_body, re.I):
        expr = m.group(1).strip()
        # REGEX
        rm = re.match(r"REGEX\s*\(\s*[?$](\w+)\s*,\s*\"([^\"]*)\"\s*(?:,\s*\"([^\"]*)\"\s*)?\)", expr, re.I)
        if rm:
            filters.append({"type": "regex", "variable": rm.group(1), "pattern": rm.group(2), "flags": rm.group(3) or ""})
            continue
        # equality
        em = re.match(r'[?$](\w+)\s*=\s*"([^"]*)"', expr)
        if em:
            filters.append({"type": "eq", "variable": em.group(1), "value": em.group(2)})
            continue
        # numeric comparison
        cm = re.match(r'[?$](\w+)\s*([<>]=?)\s*([\d.]+)', expr)
        if cm:
            filters.append({"type": "cmp", "variable": cm.group(1), "op": cm.group(2), "value": float(cm.group(3))})

    # LIMIT / OFFSET / ORDER BY
    lm = re.search(r"LIMIT\s+(\d+)", q, re.I)
    om = re.search(r"OFFSET\s+(\d+)", q, re.I)
    obm = re.search(r"ORDER\s+BY\s+(ASC|DESC)?\s*[(?$](\w+)\)?", q, re.I)

    return {
        "variables":   variables,
        "select_star": select_star,
        "patterns":    patterns,
        "filters":     filters,
        "limit":       min(int(lm.group(1)), 1000) if lm else 100,
        "offset":      int(om.group(1)) if om else 0,
        "order_by":    {"variable": obm.group(2), "dir": (obm.group(1) or "ASC").upper()} if obm else None,
    }


# ── Executor ─────────────────────────────────────────────────────────────────

def _execute(parsed: dict, df):
    cols = list(df.columns)
    var_to_col = {}

    # Build variable→column map and initial equality filters from patterns
    mask = [True] * len(df)

    for p in parsed["patterns"]:
        col = _resolve_predicate(p["predicate"], cols)
        if col is None:
            continue
        if p["variable"]:
            var_to_col[p["variable"]] = col
        if p["literal"] is not None:
            mask = [m and (str(v) == p["literal"]) for m, v in zip(mask, df[col].astype(str))]

    # Apply FILTER expressions
    op_map = {">": "__gt__", "<": "__lt__", ">=": "__ge__", "<=": "__le__"}
    for f in parsed["filters"]:
        col = var_to_col.get(f["variable"])
        if col is None:
            continue
        if f["type"] == "eq":
            mask_col = df[col].astype(str) == f["value"]
            mask = [m and b for m, b in zip(mask, mask_col)]
        elif f["type"] == "regex":
            flags = re.IGNORECASE if "i" in f["flags"] else 0
            mask_col = df[col].astype(str).str.contains(f["pattern"], flags=flags, regex=True, na=False)
            mask = [m and b for m, b in zip(mask, mask_col)]
        elif f["type"] == "cmp":
            try:
                numeric_col = df[col].apply(lambda x: float(x) if x not in (None, "", "-") else None)
                cmp_mask = getattr(numeric_col, op_map[f["op"]])(f["value"])
                mask = [m and bool(b) for m, b in zip(mask, cmp_mask)]
            except Exception:
                pass

    filtered = df[[bool(m) for m in mask]]

    # Determine result variables
    if parsed["select_star"]:
        result_vars = ["kg_id", "kg_name", "fair_score", "f_score", "a_score", "i_score", "r_score",
                       "sparql_endpoint", "sparql_url", "triples", "license", "description", "url"]
        # build var_to_col for star
        for v in result_vars:
            col = _resolve_predicate(f"blod:{v}", cols)
            if col:
                var_to_col[v] = col
    else:
        result_vars = parsed["variables"]

    # Order by
    if parsed["order_by"]:
        ob_var = parsed["order_by"]["variable"]
        ob_col = var_to_col.get(ob_var)
        if ob_col and ob_col in filtered.columns:
            ascending = parsed["order_by"]["dir"] == "ASC"
            try:
                filtered = filtered.sort_values(by=ob_col, ascending=ascending, na_position="last")
            except Exception:
                pass

    # Slice
    filtered = filtered.iloc[parsed["offset"]: parsed["offset"] + parsed["limit"]]

    # Build W3C SPARQL JSON bindings
    def make_cell(val):
        if val is None:
            return None
        s = str(val)
        if s in ("-", "", "nan", "None"):
            return None
        # try numeric
        try:
            f = float(s)
            if not math.isnan(f) and not math.isinf(f):
                return {"type": "literal",
                        "datatype": "http://www.w3.org/2001/XMLSchema#decimal",
                        "value": s}
        except ValueError:
            pass
        if s.startswith("http://") or s.startswith("https://"):
            return {"type": "uri", "value": s}
        return {"type": "literal", "value": s}

    bindings = []
    for _, row in filtered.iterrows():
        binding = {}
        for v in result_vars:
            col = var_to_col.get(v)
            if not col or col not in filtered.columns:
                continue
            cell = make_cell(row[col])
            if cell:
                binding[v] = cell
        bindings.append(binding)

    return {
        "head":    {"vars": result_vars},
        "results": {"bindings": bindings},
    }


# ── Route factory ─────────────────────────────────────────────────────────────

def make_sparql_blueprint(weather_station_data):
    """
    Call this with the GenerateWeatherStationData instance to attach
    the DataFrame reference to the routes.
    """

    @sparql_bp.route("/query", methods=["GET", "POST"])
    def sparql_query():
        if request.method == "POST":
            data = request.get_json(silent=True) or {}
            query = data.get("query") or request.form.get("query", "")
        else:
            query = request.args.get("query", "")

        if not query.strip():
            return jsonify({
                "error": "Missing 'query' parameter.",
                "usage": "GET /sparql/query?query=SELECT+?kg_id+?fair_score+WHERE+{+?s+blod:kg_id+?kg_id+.+?s+blod:fair_score+?fair_score+}+LIMIT+10",
                "info": "/sparql/info",
            }), 400

        df = getattr(weather_station_data, "checloud_df", None)
        if df is None or not hasattr(df, "analysis_data"):
            return jsonify({"error": "Quality DataFrame not available yet."}), 503

        analysis_df = df.analysis_data

        try:
            parsed = _parse_sparql(query)
            result = _execute(parsed, analysis_df)
            resp = jsonify(result)
            resp.headers["Content-Type"] = "application/sparql-results+json"
            return resp
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Internal error: {e}"}), 500

    @sparql_bp.route("/info", methods=["GET"])
    def sparql_info():
        df = getattr(weather_station_data, "checloud_df", None)
        available_cols = list(df.analysis_data.columns) if df and hasattr(df, "analysis_data") else []
        return jsonify({
            "endpoint":    "/sparql/query",
            "description": "SPARQL-like query engine over the BLOD quality assessment DataFrame",
            "supported":   "SELECT … WHERE { } with triple patterns, FILTER (REGEX, =, <, >), LIMIT, OFFSET, ORDER BY",
            "prefix":      "blod:  – maps to a DataFrame column (spaces → underscores)",
            "semantic_aliases": ALIAS_MAP,
            "available_columns_count": len(available_cols),
            "example_queries": [
                {
                    "label": "Top 10 datasets by FAIR score",
                    "query": "SELECT ?kg_id ?kg_name ?fair_score WHERE { ?s blod:kg_id ?kg_id . ?s blod:kg_name ?kg_name . ?s blod:fair_score ?fair_score } ORDER BY DESC(?fair_score) LIMIT 10"
                },
                {
                    "label": "Datasets with an available SPARQL endpoint",
                    "query": "SELECT ?kg_id ?kg_name ?sparql_url WHERE { ?s blod:kg_id ?kg_id . ?s blod:kg_name ?kg_name . ?s blod:sparql_endpoint \"Available\" . ?s blod:sparql_url ?sparql_url } LIMIT 25"
                },
                {
                    "label": "Datasets with FAIR score above 3",
                    "query": "SELECT ?kg_id ?kg_name ?fair_score WHERE { ?s blod:kg_id ?kg_id . ?s blod:kg_name ?kg_name . ?s blod:fair_score ?fair_score . FILTER(?fair_score > 3) } ORDER BY DESC(?fair_score) LIMIT 20"
                },
                {
                    "label": "Search datasets by name (case-insensitive)",
                    "query": "SELECT ?kg_id ?kg_name ?fair_score WHERE { ?s dct:identifier ?kg_id . ?s dct:title ?kg_name . ?s blod:fair_score ?fair_score . FILTER(REGEX(?kg_name, \"drug\", \"i\")) } LIMIT 15"
                },
                {
                    "label": "Datasets with CC0 license",
                    "query": "SELECT ?kg_id ?kg_name ?license WHERE { ?s blod:kg_id ?kg_id . ?s blod:kg_name ?kg_name . ?s dct:license ?license . FILTER(REGEX(?license, \"cc-zero\", \"i\")) } LIMIT 20"
                },
            ],
        })

    @sparql_bp.route("/columns", methods=["GET"])
    def sparql_columns():
        """Return the full list of DataFrame columns so users can build queries."""
        df = getattr(weather_station_data, "checloud_df", None)
        if df is None or not hasattr(df, "analysis_data"):
            return jsonify({"error": "DataFrame not available."}), 503
        cols = sorted(df.analysis_data.columns.tolist())
        return jsonify({"columns": cols, "count": len(cols)})

    return sparql_bp
