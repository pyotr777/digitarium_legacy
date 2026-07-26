
function ready() {
    getRates();
}

document.addEventListener("DOMContentLoaded", ready);


var dates =[];
var quotes=[];
var msg;

// ! CHANGE ONLY WITH changeStepSize() function
var step = 12; // hours step
var plot_period = 12; // months for plot "cost for rent period"


function changeStepSize(i) {
    console.log("Changing step size to "+i);
    step = i;
    if (step < 24) {
        plot_period = 1;
    } else {
        plot_period = 12;
    }
    plotFilterPlots()
}


function plotFilterPlots() {
    console.log("Plotting DC plots.");
    ndx = crossfilter(offers_all);
    plotGPUs();
    plotGPUperf();
    plotProviders();
    plotGPUmodels();
    plotCPUperf();
    plotMemory();
    dc.renderAll();
}


function continue_proc(filter, field, group) {
    if (processing) return;
    processing = true;
    // line width on graph
    var thin=1.1
    var thick=3

    if (accumulated_months_days.length < 1) {
        //console.log("Calculate accumulated months days");
        accumulated_days = 0;
        for (var m = 0; m < 12; m++) {
            accumulated_days += days_in_month[m];
            accumulated_months_days.push(accumulated_days);
        }
        //console.log(accumulated_months_days);
    }
    filter(field, group);

    msg.innerHTML = "";
    quotes=[];
    plotPeriod(getHours4Months(plot_period), step, thin, thick);  // Period for top plot
    console.log("Have "+ quotes.length+" quotes.")

    // Display data for 1 month by default
    displaySlice(Math.floor(24 * accumulated_months_days[0] / step));
    displayPerformanceScatter();
    plotTable();

    processing = false;
}


function displayPerformanceScatter() {
    var scatter_plt = document.getElementById("scatter_performance");
    var hover_info1 = document.getElementById("offer_details1");
    var layout = {
        title:'CPU and GPU performance** (TFlops), memory volume (GB)',
        xaxis: {
            title: 'CPU performance (TFlops)',
            ticklen: 5,
            rangemode: "tozero",
            showline: true
        },
        yaxis: {
            title: 'GPU performance (TFlops)',
            ticklen: 5,
            rangemode: "tozero",
            showline: true
        },
        hovermode: 'closest',
        legend: {
            y: 1,
            yanchor: "top",
            x: 0.01,
            bgcolor: "rgba(255,255,255,0.8)",
            bordercolor: "#eee",
            borderwidth: 1
        },
        margin: {
            t: 40,
            r: 10,
            l: 50,
            pad: 0
        }
    };
    //console.log("in displayPerformanceScatter has " + offers.length + " filtered offers");
    var traces = [];
    var memory_trace = {
        mode: "markers",
        type: "scatter",
        name: "RAM (GB)",
        x: [],
        y:[],
        text:[],
        marker: {
            sizemode: "area",
            size: [],
            color:"rgba(0,0,0,0)",
            line: {
                color: 'rgba(0,0,0,0.6)',
                width: 1
            }
        }
    };
    var last_prov="";
    var last_offer=""; // For removing offer duplicates hourly/weekly/monthly...
    var skip_words=["minutely", "hourly", "dayly", "weekly", "monthly", "yearly"];
    for (var j=0; j < offers.length; j++) {
        var prov = offers[j].provider.toLowerCase();
        var offer_name = getSimpleName(offers[j].name,skip_words);
        if (last_offer == offer_name) {
            continue;
        } else {
            last_offer = offer_name;
        }
        //console.log(j+" "+prov)
        if (last_prov != prov) {
            last_prov = prov;
            var c = getColor(prov);
            if (new_trace) {
                traces.push(new_trace);
                new_trace=null;
            }
            var new_trace = {
                name: offers[j].provider,
                mode: "markers",
                type: "scatter",
                x: [],
                y: [],
                text: [],
                marker: {
                    color: [],
                    opacity: 0.8,
                    size: 15
                },
                info: []
            }
        }
        new_trace.x.push(offers[j].cpu_p);
        new_trace.y.push(offers[j].gpu_p);
        new_trace.text.push(offers[j].shortname)
        new_trace.marker.color.push(colors[c][0]);
        new_trace.info.push(getOfferInfo(offers[j]));

        memory_trace.x.push(offers[j].cpu_p);
        memory_trace.y.push(offers[j].gpu_p);
        memory_trace.text.push(offers[j].memory+" GB");
        memory_trace.marker.size.push(offers[j].memory);
    }
    if (new_trace) {
        traces.push(new_trace);
    }
    traces.push(memory_trace);
    //console.log(traces);
    Plotly.newPlot('scatter_performance', traces, layout);

    resizeLegend('scatter_performance');


    scatter_plt.on("plotly_hover", function(data) {
        hoverDisplay(data, hover_info1);
    });

    scatter_plt.on("plotly_unhover", function(data) {
        hover_info1.innerHTML = "&nbsp;";
        hover_info1.style.backgroundColor = "rgba(1,1,1,0)";
    });
}


// Return array of Cost, Cost/CPU FLops, Cost/GPU FLops for given number of hours (period).
// Period must be in hours.
function getQuote(offer, step, period) {
    var costs = [], costs_cpu=[], costs_gpu=[];
    if (offer.time_limit != null && offer.time_limit != "" && offer.continuous == "") {
        period = offer.time_limit;
    }
    for (var i=0; i <= period; i+=step) {
        cost = getQuote4Hours(offer, i);
        costs.push(cost);
        costs_cpu.push(cost/offer.cpu_p);
        costs_gpu.push(cost/offer.gpu_p);
    }
    //console.log(offer.shortname+ " " + costs);
    return [ costs, costs_cpu, costs_gpu];
}



// Return array of dates from 0 to given period of hours
// with "step" hours step. Second returned variable – array of years, months, days and hours and human readable labels.
function prepDates(end, step) {
    var h_arr = [];
    var human =[];
    var text  =[];
    start_date = 0;
    for (h = 0; h <= end; h+=step) {
        h_arr.push(h);
        human_time = hoursToHuman(h, false)
        human.push(human_time[0]); // Object {years, months, days, hours}.
        text.push(human_time[1]);  // Human-readable text.
    }
    return [h_arr, human, text];
}

var period_plot_layout = null;

// Plot all offers costs for given period.
function plotPeriod(period, step, thin, thick) {
    var tickvals = [];
    var ticktext = [];
    var traces = [];
    var line_opacity = 0.9;

    if (dates.length == 0) {
        dates = prepDates(period, step);
    }
    //console.log(dates);
    // dates[0] - array of hours: 0,1,2,...,period
    // dates[1] - array of objects
    // dates[2] - array of human-readable text format dates
    //console.log("Period is " + period+" (" + dates[0][dates[0].length-1] + ") hours");
    //console.log("which is " + dates[2][dates[1].length-1]);

    if (period_plot_layout == null) {
        period_plot_layout = {
            title: 'Cost* for rent period (USD)',
            hovermode:'closest',
            showticklabels: true,
            showlegend: true,
            legend: {
                orientation: "v",
                y: 1,
                yanchor: "top",
                x: 0.01,
                tracegroupgap: 0,
                bgcolor: "rgba(255,255,255,0.8)",
                bordercolor: "#eee",
                borderwidth: 1
            },
            margin: {
                t: 40,
                r: 10,
                l: 50,
                pad: 0
            },
            xaxis: {
                showline: true,
                showgrid: true,
                ticklen: 5,
                tickangle: -45,
                tickvals: [Math.floor(24*7),
                    Math.floor(24*accumulated_months_days[0]),
                    Math.floor(24*accumulated_months_days[1]),
                    Math.floor(24*accumulated_months_days[2]),
                    Math.floor(24*accumulated_months_days[3]),
                    Math.floor(24*accumulated_months_days[4]),
                    Math.floor(24*accumulated_months_days[5]),
                    Math.floor(24*accumulated_months_days[6]),
                    Math.floor(24*accumulated_months_days[7]),
                    Math.floor(24*accumulated_months_days[8]),
                    Math.floor(24*accumulated_months_days[9]),
                    Math.floor(24*accumulated_months_days[10]),
                    Math.floor(24*accumulated_months_days[11]) ],
                ticktext: ["1 week", "1 month", "2 months", "3 months", "4 months", "5 months", "6 months", "7 months", "8 months", "9 months", "10 months", "11 months", "12 months"]
            },
            yaxis: {
                rangemode: "tozero",
                showline: true,
                tickprefix: "$",
                hoverformat: ',.2f',
                tickangle: 45
            }
        };
    }

    var last_prov = ""
    for (j=0; j < offers.length; j++) {
        var prov = offers[j].provider.toLowerCase();
        var c = getColor(prov);
        if (last_prov != prov) {
            last_prov = prov;
            var legend_trace = {
                showlegend: true,
                legendgroup: prov,
                name: offers[j].provider,
                visible: true,
                type: "bar",
                x: [0],
                y: [1],
                marker: {
                    color: colors[c][0]
                }
            }
            traces.push(legend_trace)
        }

        // Split one offer by cost period
        splitByCostPeriod(offers[j]).forEach( function (offer) {
            var text = [];
            for (var i=0; i < dates[2].length; i++) {
                text.push(offer.provider+" "+offer.name + "<br>" + dates[2][i]);
            }
            var quote = getQuote(offer, step, period);
            //console.log("quotes for " + offer.name);
            //console.log(offer);
            //console.log(quote);
            var trace = {
                showlegend: false,
                legendgroup: prov,
                mode: 'lines',
                line: {
                    color: colors[c][1],
                    width: thin,
                    shape: "linear",
                    smoothing: 0
                },
                opacity:line_opacity,
                name: offer.shortname,
                longname: offer.provider+" "+offer.name,
                text: text,
                hoverinfo:"text+y",
                x: dates[0],
                info: getOfferInfo(offer),
                y: quote[0] // 0 - Absolute cost
            };
            traces.push(trace);
            quotes.push(quote);
        });
    }
    if ( period_plot_layout.annotations ) {
        console.log("Annotations: " + period_plot_layout.annotations.length);
        period_plot_layout.annotations = [];
    }

    //console.log("traces has "+traces.length + " elements");
    Plotly.newPlot("costs_period", traces, period_plot_layout);
    resizeLegend('costs_period');

    var myPlot = document.getElementById('costs_period');
    var hover_info2 = document.getElementById("offer_details2");

    myPlot.on('plotly_click', function(data) {
        //console.log(data);
        var pts = '';
        var i=0;
        Plotly.relayout('costs_period', 'annotations[0]', 'remove');
        //console.log("Clicked: ");
        //console.log(data.points[i]);
        displaySlice(data.points[i].pointNumber);
        var point = data.points[i];
        newannotation = {
            x: point.xaxis.d2l(point.x),
            y: 150,
            arrowhead: 0,
            ax: 0,
            ay: -250,
            arrowwidth: 1,
            arrowcolor: '#333333',
            borderwidth: 0,
            borderpad: 0,
            text: ''
        };


        Plotly.relayout('costs_period', 'annotations[0]', newannotation);
    });

    myPlot.on('plotly_hover', function(data) {
        //console.log(data.points[0]);
        var point = data.points[0];
        var update= {
            line: {
                color: point.fullData.line.color,
                width: thick
            },
            opacity: 1
        };
        Plotly.restyle('costs_period', update, [point.curveNumber]);
        if (point.data.info == null) {
            return;
        }
        hover_info2.innerHTML = hover_info2.innerHTML + " " +point.data.info;
        hover_info2.style.backgroundColor = point.fullData.line.color;
        hover_info2.style.opacity = "0.8";
        //console.log(point.data.info + " " + point.fullData.line.color);
    });

    myPlot.on('plotly_unhover', function(data) {
        var update= {
            line: {
                color: data.points[0].fullData.line.color,
                width: thin
            },
            opacity: line_opacity
        };
        Plotly.restyle('costs_period', update, [data.points[0].curveNumber]);
        hover_info2.innerHTML = "&nbsp;";
        hover_info2.style.backgroundColor = "rgba(1,1,1,0)";
    });
}



function removeAnnotations() {
    var myPlot = document.getElementById('costs_period');
    an = (myPlot.layout.annotations || []).length;
    console.log("annotations: "+an);
    for (var i=0; i < an; i++) {
        Plotly.relayout('costs_period', 'annotations[' + i + ']', 'remove');
    }
}

// Argument is string
function displayTime(s) {
    var parts = s.split(" ");
    var i = parseInt(parts[0]);
    var n = i;
    switch (parts[1].toLowerCase()) {
        case "hour":
        case "hours":
            changeStepSize(i);
            break;
        case "day":
        case "days":
            n = Math.floor(24/step) * i;
            break;
        case "month":
        case "months":
            n = accumulated_months_days[i-1] * Math.floor(24/step);
            break;
        case "year":
        case "years":
            n = i * accumulated_months_days[11] * Math.floor(24/step);
            break;
    }
    //console.log("i="+i+ " "+parts[1]+ " n="+n);
    removeAnnotations();
    displaySlice(n);
}


// Argument is array index
function displaySlice(n) {
    //console.log(dates[1][n]);
    var months = dates[1][n].years*12 + dates[1][n].months;
    var hours = n*step;

    console.log("Slice on "+n+ " "+ hours+" hours, X: "+ dates[0][n] + ", full "+months+" months / " + dates[2][n]);
    // rewind to the beginning of the month
    var i = n;
    var point = 0;
    while (i > 0 && point == 0 ) {
        i--;
        if (dates[1][i].months != months) {
            point = i+1;
        }
    }

    var slice_cost_perf_plot = document.getElementById("slice_cost_perf");
    //console.log("Month start point: "+ point+" / "+dates[2][point]);
    // Set plot description period
    document.getElementById("r_period").innerHTML=dates[2][point];

    var layout = {
        title: "1 TFlops cost for " + dates[2][n]+" rent",
        xaxis: {
            title: 'CPU TFLops cost (USD)',
            ticklen: 5,
            tickangle: 45,
            hoverformat: "$,.2f",
            type: "log",
            rangemode: "tozero",
            showline: true
        },
        yaxis: {
            title: 'GPU TFlops cost (USD)',
            ticklen: 5,
            tickangle: 45,
            hoverformat: "$,.2f",
            type: "log",
            rangemode: "tozero",
            showline: true
        },
        hovermode: 'closest',
        legend: {
            y: 1,
            yanchor: "top",
            x: 0.01,
            bgcolor: "rgba(255,255,255,0.7)",
            bordercolor: "#eee",
            borderwidth: 1
        },
        margin: {
            t: 40,
            r: 10,
            l: 70,
            pad: 0
        }
    };
    //console.log("in displayPerformanceScatter has " + offers.length + " filtered offers");
    var traces = [];
    var y_cost = [];
    var y_cost_monthly = [];
    var x = [];
    var c = [];
    var info = [];
    console.log("displaySlice has " + offers.length+" offers.")
    var last_prov="";
    var last_offer=""; // For removing offer duplicates hourly/weekly/monthly...
    var skip_words=["minutely", "hourly", "dayly", "weekly", "monthly", "yearly"];
    var color = "";
    for (var j=0; j < offers.length; j++) {
        var prov = offers[j].provider.toLowerCase();
        var offer_name = getSimpleName(offers[j].name,skip_words);
        if (last_offer == offer_name) {
            continue;
        } else {
            last_offer = offer_name;
        }
        if (last_prov != prov) {
            last_prov = prov;
            color = colors[getColor(prov)][1];
            if (new_trace) {
                traces.push(new_trace);
                new_trace=null;
            }
            var new_trace = {
                name: offers[j].provider,
                mode: "markers",
                type: "scatter",
                x: [],
                y: [],
                text: [],
                marker: {
                    color: [],
                    opacity: 0.7,
                    size: 12,
                    line: {
                        width: 1,
                        color: 'rgba(0,0,0,0.2)'
                    }
                },
                info: []
            }
        }

        // Split one offer by cost period
        splitByCostPeriod(offers[j]).forEach( function (offer) {
            var cost = getQuote4Hours(offer,hours);
            var month_start_quote = getQuote4Hours(offer, dates[0][point]);
            /*if (new_trace) {
                console.log(new_trace);
            } else {
                console.log("No new_trace");
            }*/
            new_trace.x.push(cost/offer.cpu_p);
            new_trace.y.push(cost/offer.gpu_p);
            new_trace.text.push(offer.shortname)
            new_trace.marker.color.push(color);
            new_trace.info.push(getOfferInfo(offer));
            //console.log(offer.shortname+" " + cost/offer.gpu_p + "x" + cost/offer.cpu_p);

            y_cost.push(cost);
            y_cost_monthly.push(month_start_quote/months)
            //console.log(offer.shortname+" cost:" + month_start_quote + " " +months+ " months");
            x.push(offer.shortname);
            c.push(color);
            info.push(getOfferInfo(offer));
        });
    }
    if (new_trace) {
        traces.push(new_trace);
    }
    Plotly.newPlot('slice_cost_perf', traces, layout);
    resizeLegend('slice_cost_perf');

    slice_cost_perf_plot.on("plotly_hover", function(data) {
        hoverDisplay(data, hover_info4);
    });

    slice_cost_perf_plot.on("plotly_unhover", function(data) {
        hover_info4.innerHTML = "&nbsp;";
        hover_info4.style.backgroundColor = "rgba(1,1,1,0)";
    });


    var layout_cost = {
        title: "Cost for "+dates[2][n]+" rent",
        showlegend: false,
        margin: {
            b: 120,
            t: 50
        },
        xaxis: {
            fixedrange: true,
            tickangle: 45,
            tickfont: {
                family: 'Arial Narrow, sans-serif',
                size: 13,
                color: 'black'
            }
        },
        yaxis: {
            title: 'Cost (USD)',
            tickprefix: "$",
            hoverformat: ',.2f',
            exponentformat: "none",
            separatethousands: true
        }
    }
    var trace_cost = {
        x: x,
        y: y_cost,
        name: "USD",
        type: "bar",
        marker: {
            color: c
        },
        info: info
    };
    var trace_monthly_cost = {
        x: x,
        y: y_cost_monthly,
        name: "USD",
        type: "bar",
        marker: {
            color: c
        },
        info: info
    };
    //console.log("Colors: " + c);
    Plotly.newPlot('slice_cost', [trace_cost], layout_cost);
    if (months > 1) {
        document.getElementById('slice_cost_monthly').style.height= "300px";
        document.getElementById('slice_cost_monthly_text').style.display= "inline";
        // Reuse layout for montly cost graph
        layout_cost.title = "Monthly cost for "+months + " months rent period";
        Plotly.newPlot('slice_cost_monthly', [trace_monthly_cost], layout_cost);
    } else {
        document.getElementById('slice_cost_monthly').style.height= "0";
        document.getElementById('slice_cost_monthly_text').style.display= "none";
    }

    var slice_cost_plot = document.getElementById("slice_cost");
    var slice_cost_monthly_plot = document.getElementById("slice_cost_monthly");
    var hover_info3 = document.getElementById("offer_details3");
    var hover_info4 = document.getElementById("offer_details4");

    slice_cost_plot.on("plotly_hover", function(data) {
        hoverDisplay(data, hover_info3);
    });

    slice_cost_plot.on("plotly_unhover", function(data) {
        hover_info3.innerHTML = "&nbsp;";
        hover_info3.style.backgroundColor = "rgba(1,1,1,0)";
    });

    if (months > 1) {
        slice_cost_monthly_plot.on("plotly_hover", function(data) {
            hoverDisplay(data, hover_info3);
        });

        slice_cost_monthly_plot.on("plotly_unhover", function(data) {
            hover_info3.innerHTML = "&nbsp;";
            hover_info3.style.backgroundColor = "rgba(1,1,1,0)";
        });
    }
}


function NumberFormat(s) {
    if (s == "") {
        return "";
    }
    if (s.indexOf("x")>=0) {
        return s;
    }
    num = Number(s).toLocaleString('en', { style: 'decimal', maximumFractionDigits: 2 });
    num = num.replace(",", " ");
    return num;
}


function shortFormat(s) {
    if (s == "") {
        return "";
    }
    if (s.indexOf("x")>=0) {
        return s;
    }
    num = Number(s).toLocaleString('en', { style: 'decimal', maximumFractionDigits: 2 });
    num = num.replace(",", " ");
    return " x"+num;
}


function formatCPUs(offer) {
    var str = "";
    if (offer.cpu_model != "" ) {
        str = offer.cpu_model + shortFormat(offer.cpus);
    }
    return str;
}

function plotTable() {
    var head = '<table class="wide_table" id="the_table">\
    <thead><tr><th rowspan="2" class="double">Provider</th> \
    <th rowspan="2" class="quadruple">Offer</th><th class="double">GPU</th><th class="double">CPU</th> \
    <th>Memory</th><th colspan="4" class="quadruple">HDD</th> \
    <th>Network</th>\
    <th colspan="7" class="largest">Pricing</th> \
    <th rowspan="2">Time limit (h)</th> \
    <th rowspan="2" class="largest">Notes</th></tr> \
    <tr><th>model x quantity</th> \
    <th>model x quantity</th> \
    <th>RAM (GB)</th> \
    <th>primary</th><th>vol. (GB)</th><th>secondary</th><th>vol. (GB)</th> \
    <th>Internal/External (Gbps)</th> \
    <th>minutely</th><th>hourly</th><th>weekly</th><th>monthly</th><th>yearly</th><th title="One time setup price">Setup</th><th>Monthly limit</th> \
    </tr></thead><tbody>';
    var body="";
    for (var j=0; j < offers.length; j++) {

        body += '<tr class="table_body"><td><a href="'+offers[j].provider_link+'" target="_blank">'+offers[j].provider+'</a></td><td>';
        if (offers[j].name_link != "") {
            body += '<a href="'+offers[j].name_link+'" target="_blank">'+offers[j].name+'</a>';
        } else {
            body += offers[j].name;
        }
        body += "<br><note>"+offers[j].shortname+"</note>";
        body += '</td> \
        <td>'+offers[j].gpu_model+shortFormat(offers[j].gpus)+'</td>\
        <td>'+formatCPUs(offers[j])+'</td>\
        <td>'+NumberFormat(offers[j].memory)+'</td>\
        <td>'+offers[j].hdd1+'</td><td>'+NumberFormat(offers[j].hdd1_vol)+'</td>\
        <td>'+offers[j].hdd2+'</td><td>'+NumberFormat(offers[j].hdd2_vol)+'</td>\
        <td>'+offers[j].net+'</td>\
        <td>'+CurrencyFormat(offers[j].minutely_native, offers[j].currency)+'</td>\
        <td>'+CurrencyFormat(offers[j].hourly_native, offers[j].currency)+'</td>\
        <td>'+CurrencyFormat(offers[j].weekly_native,offers[j].currency)+'</td>\
        <td>'+CurrencyFormat(offers[j].monthly_native, offers[j].currency)+'</td>\
        <td>'+CurrencyFormat(offers[j].yearly_native, offers[j].currency)+'</td>\
        <td>'+CurrencyFormat(offers[j].setup_native, offers[j].currency)+'</td>\
        <td>'+CurrencyFormat(offers[j].month_limit_native, offers[j].currency)+'</td>\
        <td>'+offers[j].time_limit+'</td>\
        <td class="notes_cell">'+offers[j].notes+'</td></tr>';
    }

    var tail = '</tbody></table>';

    document.getElementById("table_div").innerHTML = head + body + tail;
}


var d3 = Plotly.d3;

// Plot histogram of number of offers for every number of GPUs
// split by providers.
function plotGPUsbyProvider() {
    providers_div = document.getElementById("providers");
    var gpus_obj = {};
    for (var j=0; j < offers_all.length; j++) {
        var provider = offers_all[j].provider.toLowerCase();
        if (!(provider in gpus_obj)) {
            // Create provider object inside pus_obj
            gpus_obj[provider] = {};
        }
        var gpus = offers_all[j].gpus;
        if (gpus in gpus_obj[provider]) {
            gpus_obj[provider][gpus]++;
        } else {
            // Create dictionary entry with name = number of gpus
            gpus_obj[provider][gpus] = 1;
        }
    }
    //console.log(gpus_obj);
    var traces = [];
    // loop by providers
    for(var key in gpus_obj) {
        var trace = {
            name: key,
            type: 'bar',
            x: [],
            y: [],
            marker: {
                color: colors[getColor(key)][0]
            }
        }

        for (var gpus in gpus_obj[key]) {
            trace.x.push(gpus);
            trace.y.push(gpus_obj[key][gpus]);
        }
        traces.push(trace);
    }
    console.log("traces:");
    console.log(traces);
    var layout = {
        barmode: 'stack',
        title: "Offers by number of GPUs",
        xaxis: {
            "type": 'category',
            "categoryorder": "category ascending"
        },
        height: 450,
        autosize: true
    };
    Plotly.newPlot('providers', traces, layout).then(attach);

    providers_div.on('plotly_click', function(data) {
        console.log("click");
        console.log(data);
    });
    providers_div.on('plotly_doubleclick', function(data) {
        console.log("plotly_doubleclick");
        console.log(data);
    });
    providers_div.on('plotly_selected', function(data) {
        console.log("plotly_selected");
        console.log(data);
    });
    providers_div.on('plotly_event', function(data) {
        console.log("plotly_event");
        console.log(data);
    });
}

function attach() {
    d3.select('g.legend').selectAll('.traces').each(function() {
        var item = d3.select(this);

        item.on('click', function(d) {
            console.log("Filter by " + d[0].trace.name);
            continue_proc(filterProv,d[0].trace.name);
        });
    });
    return false;
}


function filterProv(prov) {
    offers = [];
    for (var j=0; j < offers_all.length; j++) {
        if (offers_all[j].provider.toLowerCase() == prov ) {

        } else {
            offers.push(offers_all[j]);
        }
    }
}
