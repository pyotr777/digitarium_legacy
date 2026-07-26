function ready() {
    msg = document.getElementById("messages");
    msg.innerHTML = "Loading data...";
    getRates();
}

document.addEventListener("DOMContentLoaded", ready);

var ndx = null;
var quotes=[];
var step = 24; // hours step
var plot_period = 1; // months for plot "cost for rent period"


function plotFilterPlots() {
    if (processing) return;
    processing = true;
    ndx = crossfilter(offers_all);
    plotTable();
    plotScatter();
    plotPieGPUs();
    plotProviders();
    console.log("Have "+ quotes.length+" quotes.")

    dc.renderAll();
    msg.innerHTML = "";
    processing = false;
}


function continue_proc(filter, arg) {

}

function plotTable() {
	console.log("Plot table");
	//print_filter(offers_all);
	var providerDim = ndx.dimension( function(d) { return d.provider;});
	//print_filter(providerDim);
    // DOM for the table
    var datatable   = dc.dataTable("#dc-data-table");
    //
    datatable
        .dimension(providerDim)
        .group( function(d) { return d.provider; })
        .size(Infinity)
        .columns([
        	function(d) { return d.name; },
        	function(d) { return d.gpu_model;},
        	function(d) { return d.gpus;},
        	function(d) { return d.gpu_p;},
        	function(d) { return d.cpu_model;},
        	function(d) { return d.cpus;},
        	function(d) { return d.cpu_p;},
        	function(d) { return CurrencyFormat(d.hourly_native, d.currency); },
        	function(d) { return CurrencyFormat(d.weekly_native, d.currency); },
        	function(d) { return CurrencyFormat(d.monthly_native, d.currency); },
        	function(d) { return CurrencyFormat(d.yearly_native, d.currency); }
        ]);
}


function plotScatter() {
	console.log("plot scatter");
	var scatterDim = ndx.dimension( function(d) {
		return [ d.provider, d.cpu_p, d.shortname ];
	});
	var scatterGroup = scatterDim.group().reduceSum(function (d) { return d.gpu_p;});

    var chart = dc.seriesChart("#dc_scatter_performance");
    var subChart = function(c) {
        return dc.scatterPlot(c)
        .symbol('circle')
        .symbolSize(10)
        .highlightedSize(13)
    };

	var max_cpu = 1.5; //scatterDim.top(1)[0].cpu_p;
    var max_gpu = 150; //scatterDim.top(1)[0].gpu_p;


	chart
        .width(768)
        .height(350)
        .chart(subChart)
        .yAxisLabel("GPU performance")
    	.xAxisLabel("CPU performance")
		.dimension(scatterDim)
		.group(scatterGroup)
		.x(d3.scale.linear().domain([0,max_cpu]))
        .y(d3.scale.linear().domain([0,max_gpu]))
		.brushOn(false)
        .legend(dc.legend().x(600).y(10).itemHeight(10).gap(5))
        .seriesAccessor(function(d) {
        	//console.log(d);
        	if (typeof d === "undefined") return;
    		return d.key[0];
  		})
        .keyAccessor(function(d) {return +d.key[1];})
        .shareColors(true)
        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)
  		.valueAccessor(function(d) {
  			return d.value;
  		})
        .title(function(d) {
            return d.key[2];
        })
        .ordinalColors(["#ee8735","#fbee00","#3e9a36","#00b1e7","#f0308b","#964fb7","#4f48d9","#ff5f51","#503a1b"])
        .colorAccessor( function (d) {
            if (typeof d === "undefined") return;
            var c = getColor(d.key[0]);
            return c;
        })
        .seriesSort(compareColors)
}

function compareColors(a,b) {
    ca = getColor(a);
    cb = getColor(b);
    if (ca < cb) {return -1; }
    else if (ca > cb) { return 1; }
    else if (ca == cb) { return 0; }
    else { return NaN; }
}


function print_filter(filter) {
    var f = eval(filter);
    if (typeof(f.top) != "undefined") {
        f=f.top(Infinity);
    }
    if (typeof(f.dimension) != "undefined") {
        f=f.dimension(function(d) { return "";}).top(Infinity);
    }
    console.log("("+f.length+")");
    for (var key in f) {
        if (typeof f[key] === "function") {
            console.log("function "+key);
            continue;
        }
        console.log(f[key]);
    }
    console.log("  * * *");
}