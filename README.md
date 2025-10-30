# Healthcare Subcloud FAIR Quality Assessment Dataset

## Overview
This dataset contains FAIR (Findable, Accessible, Interoperable, Reusable) principle assessment scores for healthcare knowledge graphs and biomedical ontologies. The data represents quality metrics collected on July 16, 2025, evaluating various aspects of FAIR compliance across multiple healthcare data resources.

## Dataset Description

- **File Name**: `Health-Care_Subcloud_Quality_2025-07-16 (1).csv`
- **Format**: CSV (Comma-Separated Values)
- **Records**: 1,000+ knowledge graphs and ontologies
- **Collection Date**: July 16, 2025

## Column Descriptions

### Identifier Columns
- **KG id**: Unique identifier for each knowledge graph/ontology
- **F1-M Unique and persistent ID**: Binary score for persistent identifier usage

### FAIR Principle Scores

#### Findability (F-Score Components)
- **F1-D URIs dereferenceability**: URI accessibility score
- **F2a-M Metadata availability via standard primary sources**: Metadata availability score
- **F2b-M Metadata availability for all attributes**: Comprehensive metadata coverage
- **F3-M Data referrable via a DOI**: Digital Object Identifier usage
- **F4-M Metadata registered in searchable engine**: Search engine registration
- **F score**: Overall Findability score (0-1 scale)

#### Accessibility (A-Score Components)
- **A1-D Working access point(s)**: Data endpoint functionality
- **A1-M Metadata availability via working primary sources**: Metadata accessibility
- **A1.2 Authentication & HTTPS support**: Security and authentication
- **A2-M Registered in search engines**: Discoverability
- **A score**: Overall Accessibility score (0-1 scale)

#### Reusability (R-Score Components)
- **R1.1 Machine- or human-readable license**: License clarity
- **R1.2 Publisher information**: Author/contributor metadata
- **R1.3-D Data organized in standardized way**: Data organization
- **R1.3-M Metadata described with VoID/DCAT**: Standard metadata formats
- **R score**: Overall Reusability score (0-1 scale)

#### Interoperability (I-Score Components)
- **I1-D Standard & open representation format**: Data format standards
- **I1-M Metadata described with VoID/DCAT**: Interoperable metadata
- **I2 Use of FAIR vocabularies**: Vocabulary standardization
- **I3-D Degree of connection**: Network connectivity
- **I score**: Overall Interoperability score (0-1 scale)

### Summary Metrics
- **FAIR score**: Overall FAIR compliance score (0-4 scale)

## Data Sources
The dataset includes assessments of various biomedical and healthcare resources including:
- Bio2RDF datasets (chembl, goa, homologene, etc.)
- BioPortal ontologies (efo, chebi, ncit, etc.)
- Clinical datasets (clinicaltrials, drugbank, etc.)
- Chemical databases (PubChem, ChemDB)
- Genomic resources (Entrez Gene, Gene Expression Atlas)

## Usage Notes

### Score Interpretation
- Scores range from 0 to 1 for individual components
- FAIR score ranges from 0 to 4 (sum of F, A, I, R scores)
- Higher scores indicate better FAIR compliance

Notable Resources
- **Highest Scoring**: Several bio2rdf resources score ~3.63
- **Common Issues**: Many resources score 0 on URI dereferenceability (F1-D)
- **Access Challenges**: Several resources lack working access points (A1-D = 0)

### Potential Applications
- FAIR principle compliance analysis
- Biomedical data quality assessment
- Resource selection for research projects
- Gap analysis in healthcare data infrastructure
- Benchmarking data management practices

## License
Please check the respective licenses of the individual resources when using this data for specific applications.

## Citation
If you use this dataset in your research, please cite both this repository and the original data sources as appropriate.

## Contact
For questions about this dataset, please open an issue in this repository.

## Updates
This dataset represents a snapshot from July 16, 2025. FAIR scores may change as resources are updated and improved over time.
