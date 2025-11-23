import { text } from 'd3';
import React from 'react';
import Chart from "react-apexcharts";

const BrushChart = ({
  title = "FAIR score",
  data = [],         
  height = 300,
  minDate,
  maxDate,
  kg_name
}) => {
  const max = new Date(maxDate);
  const lastThreeMonths = new Date(max);
  lastThreeMonths.setMonth(max.getMonth() - 3);
  const mainOptions = {
    chart: {
      id: "main",
      type: "line",
      height: height,
      toolbar: { autoSelected: "pan", show: false },
      zoom: { enabled: false },
     //stacked: true,
    },
    colors: ['#005AA7', '#00AEEF', '#A2C516', '#E6C200', '#f61638ff'],
    title: {
      text: title,
      align: 'center',
        style: {
            fontSize: '18px',
        }
    },
    subtitle : {
        text: kg_name ? `${kg_name}` : '',
        align: 'center',
    },
    xaxis: {
      type: "datetime",
    },
    stroke: {
    width: 0
    },
    markers: {
        size: 4
    },
    yaxis: {
      min: 0,
      max: 4,
    },
    tooltip: {
      x: { format: "dd MMM yyyy" },
      y: {
        formatter: (val) => val.toFixed(2)
      }
    },
    stroke: {
      width: 2,
      curve: 'smooth'
    }
  };

 const brushOptions = {
  chart: {
    id: "brush",
    height: 100,
    type: "area",
    brush: {
      target: "main",
      enabled: true
    },
  selection: {
        enabled: true,
      }
    },
  xaxis: {
    type: "datetime",
    tooltip: { enabled: false }
  },
  yaxis: {
    min: 0,
    tickAmount: 2
  },
  stroke: {
    width: 2, 
    curve: 'straight' 
  },
  fill: {
    type: 'gradient'
  }
};
  return (
    <div>
      <Chart
        options={mainOptions}
        series={data}
        type="line"
        height={height}
      />
      <Chart
        options={brushOptions}
        series={data.filter(s => s.name === "FAIR score")}
        type="area"
        height={130}
      />
    </div>
  );
};

export default BrushChart;
