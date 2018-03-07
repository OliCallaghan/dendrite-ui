//
// Loss Graph
//
var lg = $("#loss-graph-canvas").get(0).getContext("2d");
var lg_chart = new Chart(lg, {
	type: 'line',
	data: {
        labels: [],
        datasets: [{
            label: 'Loss',
            data: [],
			backgroundColor: 'rgba(242,234,228,0.5)',
            borderColor: '#F2EAE4',
            borderWidth: 1
        }]
	},
	options: {
		events: [],
		legend: {display: false},
		layout: {padding: {top:25, left:10, right:25, bottom: 0}},
		tooltips: {enabled: false},
		elements: {line: {tension: 0}},
        scales: {
            yAxes: [{
				scaleLabel: {
					display: true,
					labelString: 'Loss',
					fontColor: '#F2EAE4',
					fontFamily: 'Inconsolata'
				},
                ticks: {
                    beginAtZero:true,
					fontColor: '#F2EAE4',
					fontFamily: 'Inconsolata'
                },
				gridLines: {
					display: false,
					color: '#F2EAE4'
				}
            }],
			xAxes: [{
				ticks: {
					fontColor: '#F2EAE4',
					fontFamily: 'Inconsolata',
					maxRotation: 0,
					autoSkipPadding: 5
                },
				gridLines: {
					display: false,
					color: '#F2EAE4'
				}
			}]
        },
		maintainAspectRatio: false,
		responsive: true,
    }
});

// AddData(CHART, LABEL, DATA) : Adds data to chart then redraws
function addData(chart, label, data) {
	if (chart.data.labels.length > 500) {
		chart.data.labels.shift();
		chart.data.datasets.forEach((dataset) => {
			dataset.data.shift()
		})
	}
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset) => {
        dataset.data.push(data);
    });
    chart.update();
}

// ClearLoss() : Removes all data from the chart
function ClearLoss() {
	lg_chart.data.labels = [];
	lg_chart.data.datasets.forEach((dataset) => {
		dataset.data = [];
	})
}

// AddLossValuePoint(LOSS VALUE, ITERATION) : Adds loss data to the graph along with the iteration number
function AddLossValuePoint(val, it) {
	addData(lg_chart, it.toString(), val);
}
