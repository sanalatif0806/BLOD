import Chart from "react-apexcharts";

const PieChart = ({ title, categories, seriesData, height = 350 }) => {
    const formattedCategories = categories.map(
    cat => cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
    );
    const options = {
      series: seriesData,
          chart: {
          width: 380,
          height: height,
          type: 'pie',
        },
        title:{
          text : title,
          align : 'center'
        },
        legend: {
              position: 'bottom',
        },
        labels: formattedCategories,
        responsive: [{
          breakpoint: 480,
          options: {
            chart: {
              width: 200
            },
          }
        }],
      };

    const series = seriesData;
    return (
        <Chart options={options} series={series} type="pie" height={height} />
    )
}
export default PieChart;