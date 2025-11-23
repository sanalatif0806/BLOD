import React from 'react';
import ReactApexChart from 'react-apexcharts';

function RadialBarChart({ label, value, color = '#008FFB', height = 350 }) {
  const options = {
    chart: {
      type: 'radialBar',
      width: '100%',
    },
    plotOptions: {
        radialBar: {
          offsetY: 0,
          startAngle: 0,
          endAngle: 270,
          hollow: {
            margin: 5,
            size: '30%',
            background: 'transparent',
            image: undefined,
          },
          dataLabels: {
            name: {
              show: false,
            },
            value: {
              show: false,
            }
          },
          barLabels: {
            enabled: true,
            useSeriesColors: true,
            offsetX: -8,
            fontSize: '16px',
            formatter: function(seriesName, opts) {
              return seriesName + ":  " + opts.w.globals.series[opts.seriesIndex]
            },
          },
        }
      },

    labels: label,
    colors: ['#005AA7', '#00AEEF', '#A2C516', '#E6C200'],
  };

  const series = value.map((val) => parseFloat(val * 100).toFixed(2)); 

  return (
      <ReactApexChart options={options} series={series} type="radialBar" height={height} />
  );
}

export default RadialBarChart;