import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { Download, ImageDown } from "lucide-react";
import Footer from './footer';

const StaticGraph = ({ data }) => {
    const [graphRendered, setGraphRendered] = useState(false);
    const [containerReady, setContainerReady] = useState(false);
    const graphContainerRef = useRef(null);

    // First, ensure the container is ready
    useEffect(() => {
        if (graphContainerRef.current) {
            console.log('Graph container mounted:', graphContainerRef.current);
            setContainerReady(true);
        }

        return () => {
            // Cleanup
            if (graphContainerRef.current) {
                d3.select(graphContainerRef.current).selectAll("*").remove();
            }
        };
    }, []);

    // Then render the graph when data and container are ready
    useEffect(() => {
        if (!containerReady) {
            console.log('Container not ready yet');
            return;
        }

        if (!data || !data.nodes || !data.links) {
            console.log('No valid data for graph');
            return;
        }

        if (data.nodes.length === 0 || data.links.length === 0) {
            console.log('Graph has empty data');
            return;
        }

        if (graphRendered) {
            console.log('Graph already rendered');
            return;
        }

        console.log('Starting graph render with:', {
            nodes: data.nodes.length,
            links: data.links.length
        });

        // Small delay to ensure DOM is fully ready
        const timer = setTimeout(() => {
            try {
                renderStaticGraph();
                setGraphRendered(true);
            } catch (error) {
                console.error('Error rendering graph:', error);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [data, containerReady, graphRendered]);

    const renderStaticGraph = () => {
        const svgElement = document.getElementById("graph");

        if (!svgElement) {
            console.error('SVG element not found!');
            return;
        }

        // Get dimensions
        const width = svgElement.clientWidth || window.innerWidth * 0.8;
        const height = svgElement.clientHeight || window.innerHeight * 0.6;

        console.log('Rendering with dimensions:', { width, height });

        const svg = d3.select("#graph");
        const categories = Array.from(new Set(data.nodes.map(node => node.category)));
        const categoryColors = {
            "Clinical & Patient Data": "#d9d9d9",
            "Omics & Molecular Data": "#6fa990",
            "Medical Imaging & Signals": "#debaa9",
            "Public Health & Surveillance": "#f6f0e4",
            "Biobank & Research Data": "#f7c59f",
            "Behavioral & Social Data": "#a3c4f3",
            "Terminologies & Metadata": "#bddbcf"
        };

        const colorScale = d3.scaleOrdinal()
            .domain(Object.keys(categoryColors))
            .range(Object.values(categoryColors));

        // Clear previous graph elements
        svg.selectAll("*").remove();

        // Draw color legend
        const legend = svg.append("g").attr("transform", "translate(10, 10)");

        legend.selectAll("rect")
            .data(categories)
            .enter().append("rect")
            .attr("x", 0)
            .attr("y", (d, i) => i * 20)
            .attr("width", 20)
            .attr("height", 15)
            .attr("fill", d => colorScale(d));

        legend.selectAll("text")
            .data(categories)
            .enter().append("text")
            .attr("font-family", "Arial")
            .attr("x", 30)
            .attr("y", (d, i) => i * 20 + 12)
            .text(d => d)
            .attr("class", "legend")
            .attr("font-size", "10px");

        // Identify nodes with and without links
        const linkedNodeIds = new Set();
        data.links.forEach(link => {
            linkedNodeIds.add(typeof link.source === 'object' ? link.source.id : link.source);
            linkedNodeIds.add(typeof link.target === 'object' ? link.target.id : link.target);
        });

        // Filter nodes to only include connected nodes
        const connectedNodes = data.nodes.filter(node => linkedNodeIds.has(node.id));

        // Process links to ensure they reference only connected nodes
        const validLinks = data.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return linkedNodeIds.has(sourceId) && linkedNodeIds.has(targetId);
        });

        if (connectedNodes.length === 0 || validLinks.length === 0) {
            console.warn('No connected nodes or links to render');
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .attr("fill", "#555")
                .text("No connected graph data to display");
            return;
        }

        // Calculate the number of incoming links for each node
        const incomingLinkCounts = {};
        connectedNodes.forEach(node => {
            incomingLinkCounts[node.id] = 0;
        });

        validLinks.forEach(link => {
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            incomingLinkCounts[targetId] = (incomingLinkCounts[targetId] || 0) + 1;
        });

        // Create a scale for node sizes based on incoming links
        const minNodeSize = 20;
        const maxNodeSize = 40;
        const maxIncomingLinks = Math.max(1, ...Object.values(incomingLinkCounts));

        const nodeSizeScale = d3.scaleLinear()
            .domain([0, maxIncomingLinks])
            .range([minNodeSize, maxNodeSize])
            .clamp(true);

        // Pre-calculate positions using D3 force layout
        const simulation = d3.forceSimulation(connectedNodes)
            .force("link", d3.forceLink(validLinks).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-25))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(d => nodeSizeScale(incomingLinkCounts[d.id]) + 9))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05));

        // Run simulation
        for (let i = 0; i < 300; ++i) simulation.tick();

        // Ensure nodes stay within bounds
        connectedNodes.forEach(node => {
            node.x = Math.min(Math.max(node.x, 50), width - 50);
            node.y = Math.min(Math.max(node.y, 50), height - 50);
        });

        // Draw links
        svg.append("g")
            .selectAll("line")
            .data(validLinks)
            .enter().append("line")
            .attr("class", "link")
            .attr("data-source", d => typeof d.source === 'object' ? d.source.id : d.source)
            .attr("data-target", d => typeof d.target === 'object' ? d.target.id : d.target)
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y)
            .attr("stroke", "grey")
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.3);

        // Draw connected nodes
        const connectedNodeGroups = svg.append("g")
            .selectAll("g.connected")
            .data(connectedNodes)
            .enter().append("g")
            .attr("class", "node-group connected")
            .attr("data-id", d => d.id)
            .attr("data-url", d => d.url || '#')
            .attr("transform", d => `translate(${d.x},${d.y})`);

        connectedNodeGroups.each(function(d) {
            const g = d3.select(this);
            const nodeSize = nodeSizeScale(incomingLinkCounts[d.id]);

            // Add tooltip
            g.append("title")
                .text(`${d.title || d.id}\nIncoming links: ${incomingLinkCounts[d.id]}`);

            // Create clickable circle
            g.append("circle")
                .attr("r", nodeSize)
                .attr("fill", d => colorScale(d.category))
                .attr("class", "node-circle")
                .style("cursor", "pointer")
                .on("click", function(event) {
                    event.stopPropagation();
                    if (d.url && d.url !== '#' && d.url.startsWith('http')) {
                        window.open(d.url, "_blank", "noopener,noreferrer");
                    }
                });

            // Add text label
            g.append("text")
                .attr("fill", "black")
                .attr("font-size", Math.min(10 + (nodeSize - minNodeSize) / 5, 14) + "px")
                .attr("font-family", "Arial")
                .attr("font-weight", "bold")
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .text(abbreviateText(d.title || d.id, nodeSize))
                .style("pointer-events", "none");
        });

        // Add hover effects
        connectedNodeGroups.on("mouseover", (event, d) => {
            // Highlight links
            svg.selectAll(".link").classed("highlighted", link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                return sourceId === d.id || targetId === d.id;
            });

            // Highlight connected nodes
            d3.select(event.currentTarget).select("circle").classed("highlighted", true);

            validLinks.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;

                if (sourceId === d.id || targetId === d.id) {
                    const otherId = sourceId === d.id ? targetId : sourceId;
                    svg.selectAll(`[data-id="${otherId}"] circle`).classed("highlighted", true);
                }
            });
        })
        .on("mouseout", () => {
            svg.selectAll(".link").classed("highlighted", false);
            svg.selectAll(".node-circle").classed("highlighted", false);
        });

        console.log('Graph rendering complete');
    };

    function abbreviateText(text, nodeRadius) {
        if (!text) return "";
        const scaleFactor = 0.22;
        const maxLength = Math.floor(nodeRadius * scaleFactor);
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    }

    // Rest of your download functions remain the same...
    const handleDownload = () => {
        const svgElement = document.getElementById("graph");
        if (!svgElement) return;

        // ... (keep your existing download code)
    };

    const handleDownloadPNG = () => {
        const svgElement = document.getElementById("graph");
        if (!svgElement) return;

        // ... (keep your existing PNG download code)
    };

    const handleDownloadPDF = () => {
        const svgElement = document.getElementById("graph");
        if (!svgElement) return;

        // ... (keep your existing PDF download code)
    };

    return (
        <div
          style={{
            height: "100vh",
            width: "100vw",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            fontFamily: "sans-serif",
          }}
        >
          {/* Graph Area */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <svg
              id="graph"
              ref={graphContainerRef}
              width="100%"
              height="100%"
              style={{ display: 'block' }}
            >
              {(!data || !data.nodes || data.nodes.length === 0) && (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="16px"
                  fill="#555"
                >
                  Loading graph data...
                </text>
              )}
            </svg>
          </div>

          {/* Button Bar */}
          <div
            style={{
                padding: "20px",
                display: "flex",
                justifyContent: "center",
                gap: "20px",
                backgroundColor: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={handleDownload}
              style={buttonStyle("#3B82F6", "#2563EB")}
            >
              Download cloud as SVG
            </button>
            <button
              onClick={handleDownloadPNG}
              style={buttonStyle("#10B981", "#059669")}
            >
              Download Cloud as PNG
            </button>
            <button
              onClick={handleDownloadPDF}
              style={buttonStyle("#EF4444", "#DC2626")}
            >
              Download Cloud as PDF
            </button>
          </div>
          <Footer />
        </div>
      );
};

// Helper function for button styles
function buttonStyle(color, hoverColor) {
    return {
        padding: "10px 20px",
        backgroundColor: color,
        color: "white",
        border: "none",
        borderRadius: "9999px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        cursor: "pointer",
        transition: "all 0.3s ease",
    };
}

export default StaticGraph;