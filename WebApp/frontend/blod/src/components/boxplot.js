import Chart from "react-apexcharts";

const BoxPlot = ({ title, categories = ["F score", "A score", "I score", "R score"] , seriesData, height = 350 }) => {

    // Adjust data format to inject it in apex boxplot
    const desiredOrder = categories

    const buildBoxPlotData = (seriesData, desiredOrder = null) => {
        const keys = desiredOrder ?? Object.keys(seriesData);
        return keys.flatMap(key => {
            const val = seriesData[key];
            if (!val) return [];
                return {
                    x: key,
                    y: [val.min, val.q1, val.median, val.q3, val.max]
                };
        });
    };
    const boxPlotData = buildBoxPlotData(seriesData, desiredOrder);
    
    const series = [
        {
            name: 'box',
            type: 'boxPlot',
            data: boxPlotData
        }
    ];

    const options = {
        chart: {
            type: 'boxPlot',
            height: height,
        },
        title: {
            text: title,
            align: 'left',
        },
        xaxis: {
            type: 'category',
        },
        yaxis: {
            min: 0,
        },
        plotOptions: {
            boxPlot: {
                colors: {
                upper: '#5e7e7d',
                lower: '#a5b7b6'
                }
            }
        }
    };

    return (
        <Chart options={options} series={series} type="boxPlot" height={height} />
    )
}
export default BoxPlot;