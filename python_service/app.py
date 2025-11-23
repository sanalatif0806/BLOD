from flask import Flask, request, jsonify
from generate_weather_station_data import GenerateWeatherStationData
from flask_cors import CORS
from collections import defaultdict

app = Flask(__name__)
CORS(app)


weather_station_data = GenerateWeatherStationData()

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
    media_type = weather_station_data.group_by_metric_value_list('metadata-media-type')

    # Mantain only the mediatype, discard the charset and sum the values of the duplicated key
    aggregated = defaultdict(int)
    for k, v in media_type.items():
        main_type = k.split(';')[0].strip()
        aggregated[main_type] += v
        
    return jsonify(aggregated)

@app.route("/fair_stats", methods=["GET"])
def fair_stats():
    fair_stats = {}
    boxplot_metrics = ['F score', 'A score', 'I score', 'R score', 'FAIR score']
    for metric in boxplot_metrics:
        fair_stats[metric] = weather_station_data.generate_boxplot_values(metric)

    return jsonify(fair_stats)

@app.route("/datasets_stats", methods=["GET"])
def datasets_stats():
    datasets_stats = weather_station_data.generate_count_statistics()

    return datasets_stats

@app.route("/vocabularies_used", methods=["GET"])
def vocabularies_used():
    vocabularies_stats = weather_station_data.group_by_metric_value_list('Vocabularies')

    return vocabularies_stats

@app.route("/all_single_fair_score", methods=["GET"])
def all_single_fair_score():
    fair_score = weather_station_data.extract_values_in_column(['KG name','KG id','F score', 'A score', 'I score', 'R score','FAIR score'])

    return fair_score