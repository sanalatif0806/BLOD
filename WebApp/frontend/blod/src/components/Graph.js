import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { Download, ImageDown } from "lucide-react";
import Footer from './footer';

const StaticGraph = ({ data }) => {
    const [graphRendered, setGraphRendered] = useState(false);

    useEffect(() => {
        if (data.nodes.length === 0 || data.links.length === 0 || graphRendered) return;

        // Render the graph once without animation
        renderStaticGraph();
        setGraphRendered(true);
    }, [data, graphRendered]);

    const renderStaticGraph = () => {
        const svgElement = document.getElementById("graph");
        const width = svgElement.clientWidth;
        const height = svgElement.clientHeight;
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
            .attr("class", "legend");

        // Identify nodes with and without links
        const linkedNodeIds = new Set();
        data.links.forEach(link => {
            linkedNodeIds.add(typeof link.source === 'object' ? link.source.id : link.source);
            linkedNodeIds.add(typeof link.target === 'object' ? link.target.id : link.target);
        });

        // Filter nodes to only include connected nodes (no isolated nodes)
        const connectedNodes = data.nodes.filter(node => linkedNodeIds.has(node.id));

        // Process links to ensure they reference only connected nodes
        const validLinks = data.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return linkedNodeIds.has(sourceId) && linkedNodeIds.has(targetId);
        });

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

        // Pre-calculate positions for connected nodes using D3 force layout
        const simulation = d3.forceSimulation(connectedNodes)
            .force("link", d3.forceLink(validLinks).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-25))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(d => nodeSizeScale(incomingLinkCounts[d.id]) + 9))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05));

        for (let i = 0; i < 300; ++i) simulation.tick();

        // Ensure connected nodes stay within bounds
        connectedNodes.forEach(node => {
            node.x = Math.min(Math.max(node.x, 30), width - 30);
            node.y = Math.min(Math.max(node.y, 30), height - 30);
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
            .attr("data-url", d => d.url || '#') // Store URL as data attribute
            .attr("transform", d => `translate(${d.x},${d.y})`);

        connectedNodeGroups.each(function(d) {
            const g = d3.select(this);
            const nodeSize = nodeSizeScale(incomingLinkCounts[d.id]);

            // Add a tooltip with link count information
            const tooltip = g.append("title")
                .text(d => `${d.title || d.id}\nIncoming links: ${incomingLinkCounts[d.id]}`);

            // Create clickable circle with direct event handling
            g.append("circle")
                .attr("r", nodeSize)
                .attr("fill", d => colorScale(d.category))
                .attr("class", "node-circle")
                .style("cursor", "pointer")
                .on("click", function(event, d) {
                    event.stopPropagation(); // Prevent event bubbling
                    if (d.url && d.url !== '#' && d.url.startsWith('http')) {
                        window.open(d.url, "_blank", "noopener,noreferrer");
                    } else {
                        console.warn('Invalid or missing URL for node:', d.id, d.url);
                    }
                });

            g.append("text")
                .attr("fill", "black")
                .attr("font-size", d => Math.min(10 + (nodeSize - minNodeSize) / 5, 14) + "px")
                .attr("font-family", "Arial")
                .attr("font-weight", "bold")
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .text(d => abbreviateText(d.title || d.id, nodeSize))
                .style("pointer-events", "none"); // Make text not clickable
        });

        // Add hover effects for connected nodes
        connectedNodeGroups.on("mouseover", (event, d) => {
            const nodeId = d.id;
            // Highlight links connected to this node
            svg.selectAll(".link").classed("highlighted", link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                return sourceId === d.id || targetId === d.id;
            });
            d3.select(event.currentTarget).select("circle").classed("highlighted", true);

            svg.selectAll(".node-group").each(function(otherNode) {
                const otherNodeId = otherNode.id;
                const isConnected = validLinks.some(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                    return (sourceId === nodeId && targetId === otherNodeId) ||
                           (targetId === nodeId && sourceId === otherNodeId);
                });

                if (isConnected) {
                    d3.select(this).select("circle").classed("highlighted", true);
                }
            });
        })
        .on("mouseout", (event) => {
            // Remove highlight when mouse leaves
            svg.selectAll(".link").classed("highlighted", false);
            d3.select(event.currentTarget).select("circle").classed("highlighted", false);
            // Unhighlight all node circles
            svg.selectAll(".node-circle").classed("highlighted", false);
        });
    }; // Added missing closing brace here

    function abbreviateText(text, nodeRadius) {
        if (!text) return "";

        // Determine maxLength based on the node size (scale factor can be adjusted)
        const scaleFactor = 0.22; // tweak this to control label length per radius unit
        const maxLength = Math.floor(nodeRadius * scaleFactor);

        if (text.length > maxLength) {
            return text.substring(0, maxLength) + "...";
        }
        return text;
    }

    const handleDownload = () => {
        const svgElement = document.getElementById("graph");
        const clonedSvg = svgElement.cloneNode(true);

        // Add necessary namespaces
        clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

        // Add styles for exported SVG
        const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
        styleElement.textContent = `
            .link { stroke: #aaa; stroke-width: 2; transition: stroke 0.3s; }
            .highlighted { stroke: orange !important; stroke-width: 4 !important; }
            .link.highlighted {
                stroke: orange;
                stroke-width: 4px;
                stroke-opacity: 1;
            }
            .legend { font-size: 12px; }
            .node-circle {
                stroke: none;
                stroke-width: 2px;
                transition: stroke 0.3s, stroke-width 0.3s;
            }
            .node-circle.highlighted {
                stroke: orange;
                stroke-width: 4px;
            }
        `;
        clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

        // Convert to blob and trigger download
        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(clonedSvg);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "static-graph.svg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPNG = () => {
        const svgElement = document.getElementById("graph");
        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(svgElement);

        const scaleFactor = 1;
        const originalWidth = svgElement.clientWidth;
        const originalHeight = svgElement.clientHeight;
        const width = originalWidth * scaleFactor;
        const height = originalHeight * scaleFactor;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        const image = new Image();
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        image.onload = () => {
            ctx.drawImage(image, 0, 0, width, height);
            URL.revokeObjectURL(url);

            canvas.toBlob(blob => {
                const link = document.createElement("a");
                link.download = "static-graph.png";
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, "image/png");
        };

        image.src = url;
    };

    const handleDownloadPDF = () => {
        const svgElement = document.getElementById("graph");
        const svgWidth = svgElement.clientWidth;
        const svgHeight = svgElement.clientHeight;

        const clonedSvg = svgElement.cloneNode(true);

        clonedSvg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

        clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

        // Add styles for exported PDF
        const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
        styleElement.textContent = `
            .link { stroke: #aaa; stroke-width: 2; }
            .highlighted { stroke: orange; stroke-width: 4; }
            .link.highlighted {
                stroke: orange;
                stroke-width: 4px;
                stroke-opacity: 1;
            }
            .legend { font-size: 12px; }
            .node-circle {
                stroke: none;
                stroke-width: 2px;
            }
            .node-circle.highlighted {
                stroke: orange;
                stroke-width: 4px;
            }
        `;
        clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(clonedSvg);

        let orientation = svgWidth > svgHeight ? 'landscape' : 'portrait';

        // Create a new PDF with jsPDF
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [svgWidth, svgHeight]
        });

        // Add SVG to PDF document
        const element = document.createElement('div');
        element.innerHTML = svgData;
        const svgElement2 = element.firstChild;

        // Convert SVG to PDF
        pdf.svg(svgElement2, {
            x: 0,
            y: 0,
            width: svgWidth,
            height: svgHeight
        })
        .then(() => {
            // Save the PDF file
            pdf.save('static-graph.pdf');
        });
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
          <div style={{ flex: 1, position: "relative", overflowY: "scroll" }}>
            <svg id="graph" width="100%" height="1000%">
              {data.nodes.length === 0 && (
                <text x="100%" y="1000%" textAnchor="middle" fontSize="16px" fill="#555">
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
              id="download"
              onClick={handleDownload}
              style={buttonStyle("#3B82F6", "#2563EB")}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2563EB")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3B82F6")}
            >
              Download cloud as SVG
            </button>
            <button
              onClick={handleDownloadPNG}
              style={buttonStyle("#10B981", "#059669")}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#10B981")}
            >
              Download Cloud as PNG
            </button>
            <button
              onClick={handleDownloadPDF}
              style={buttonStyle("#EF4444", "#DC2626")}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#DC2626")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#EF4444")}
            >
              Download Cloud as PDF
            </button>
          </div>
          <Footer />
        </div>
      );

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
};

export default StaticGraph;