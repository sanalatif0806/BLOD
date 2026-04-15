from flask import Flask, request, jsonify
from generate_weather_station_data import GenerateWeatherStationData
from flask_cors import CORS
from collections import defaultdict
from sparql_query import make_sparql_blueprint

app = Flask(__name__)
CORS(app)

weather_station_data = GenerateWeatherStationData()

# Register SPARQL blueprint
sparql_bp = make_sparql_blueprint(weather_station_data)
app.register_blueprint(sparql_bp)


@app.route("/")
def home():
    return "BLOD Python Service is running"


@app.route("/health")
def health():
    df = getattr(weather_station_data, 'checloud_df', None)
    return jsonify({
        "status": "ok",
        "data_loaded": df is not None and hasattr(df, 'analysis_data'),
        "datasets": len(weather_station_data.che_cloud_dataset)
    })


@app.route("/sparql_endpoint", methods=["GET"])
def sparql_endpoint():
    sparql_data = weather_station_data.group_by_metric_value('Sparql endpoint')
    return jsonify(sparql_data)


@app.route("/rdf_dump", methods=["GET"])
def rdf_dump():
    sparql_data = weather_station_data.group_by_metric_value('Availability of RDF dump (metadata)')
    return jsonify(sparql_data)


@app.route("/license", methods=["GET"])
def license():
    license_data = weather_station_data.group_by_metric_value('License machine redeable (metadata)')
    return jsonify(license_data)


@app.route("/media_type", methods=["GET"])
def media_type():
    media_type_data = weather_station_data.group_by_metric_value_list('metadata-media-type')
    aggregated = defaultdict(int)
    for k, v in media_type_data.items():
        main_type = k.split(';')[0].strip()
        aggregated[main_type] += v
    return jsonify(aggregated)


@app.route("/fair_stats", methods=["GET"])
def fair_stats():
    fair_stats_data = {}
    boxplot_metrics = ['F score', 'A score', 'I score', 'R score', 'FAIR score']
    for metric in boxplot_metrics:
        fair_stats_data[metric] = weather_station_data.generate_boxplot_values(metric)
    return jsonify(fair_stats_data)


@app.route("/datasets_stats", methods=["GET"])
def datasets_stats():
    stats = weather_station_data.generate_count_statistics()
    return jsonify(stats)


@app.route("/vocabularies_used", methods=["GET"])
def vocabularies_used():
    vocabularies_stats = weather_station_data.group_by_metric_value_list('Vocabularies')
    return jsonify(vocabularies_stats)


@app.route("/all_single_fair_score", methods=["GET"])
def all_single_fair_score():
    fair_score = weather_station_data.extract_values_in_column(
        ['KG name', 'KG id', 'F score', 'A score', 'I score', 'R score', 'FAIR score']
    )
    return jsonify(fair_score)
