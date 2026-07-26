
function ready() {
    TimeCost = document.getElementById('time_x_cost');
    FLOPsScale = document.getElementById('FLOPsScale');
    global_var = {
        cpu: {
            TFLOPs: EFLOPs_arr_[0]*1e+6,
            nodes: nodes_arr_[0]
        },
        gpu: {
            TFLOPs: EFLOPs_arr_[0]*1e+6,
            nodes: nodes_arr_[0]
        },
    };
    getRates();
}

document.addEventListener("DOMContentLoaded", ready);


var start_row = 2;
var dates =[];
var quotes=[];

var msg;
var TimeCost;
var FLOPsScale;
var nodes_arr_ = [1,2,4,8,16,32,64];
var EFLOPs_arr_= [0.1, 0.5, 1, 5, 10, 50, 100];
var global_var = {};

var axis_range_padding_koef = 1.1;


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
    if (processing) return; // Prevent onchange event loop for providers filter
    processing = true;
    filter(field, group);
    quotes=[];
    plotTimeCostMultiNode("gpu");
    plotTimeCostMultiNode("cpu");
    plotFLOPsScale();
    plotNodesScale();
    processing = false;
}




// Return array of traces for given
//cpu_gpu: "cpu"/"gpu"
function makeTraces(offers, cpu_gpu,  marker) {
    var traces = [];
    var last_prov="";
    var color = "";
    var last_nodes=0;
    var color_i = 0;
    //var max_x = 0;
    var ys = []; // array of y (cost) values
    var xs = []; // array of x (time) values
    var c = 0;
    var new_trace  = {};
    var showlegend = false;
    var inlegend = false; // This provider not shown in legend yet
    for (var j=0; j < offers.length; j++) {
        var prov = offers[j].provider.toLowerCase();
        if (last_prov != prov) {
            last_prov = prov;
            c = getColor(prov);
            color = colors[c][color_i];
            inlegend = false;
        }
        showlegend = false;
        var data = getData(offers[j],cpu_gpu);
        if (data == -1) {
            console.log(offers[j].shortname+" no data");
            continue;
        }
        var hours = data[0];
        /*if (offers[j].shortname == "Tsub.S") {
            console.log("data for "+ offers[j].shortname);
            console.log(data);
        }*/
        var cost = data[1];
        var text = data[2];
        var info = getOfferInfo(offers[j])+"<br/>";
        if (!inlegend) {
            showlegend = true;
            inlegend = true;
        }
        var new_trace = makeNewTrace(offers[j].provider, showlegend, [hours], [cost], color, [text], [info], marker);
        if (cost < 0) {
            new_trace.visible = false;
        }
        //if (max_x < hours) {
        //    max_x = hours*axis_range_padding_koef;
        //}
        //new_trace.y.push(cost);
        ys.push(cost);
        xs.push(hours);
        traces.push(new_trace);
    }
    var max_y = getMaxRange(ys);
    var max_x = getMaxRange(xs);
    var trace_obj = [traces, max_x, max_y];
    //console.log("makeTraces. trace_obj :");
    //console.log(trace_obj);
    return trace_obj;
}

// Returns a new trace object for scatter plot
function makeNewTrace(name, showlegend, x, y, color, text, info, marker) {
    //console.log("makeNewTrace " + name)
    var new_trace = {
        name: name,
        showlegend :showlegend,
        mode: "markers",
        type: "scatter",
        x: x,
        y: y,
        text: text,
        marker: {
            color: [color],
            size: 14,
            opacity: 0.7,
            symbol: marker,
            line: {
                width: 1,
                color: 'rgba(0,0,0,0.7)'
            }
        },
        hoverinfo: "text",
        info: info
    };
    return new_trace;
}


// Return array of [time, cost, text] for given offers.
// cpu_gpu is one of "gpu"  and "cpu"
function getData4offer(offer, cpu_gpu) {
    //console.log("getData for "+ offer.shortname);
    var data = getData(offer, cpu_gpu);
    if (data == -1) return -1;
    return [[data[0]], [data[1]], [data[2]]];
}



// Return array [time, cost] for a given offer.
// cpu_gpu is one of "gpu"  and "cpu"
function getData(offer, cpu_gpu) {
    var performance = cpu_gpu + "_p";
    var TFLOPs = global_var[cpu_gpu].TFLOPs;
    var nodes = global_var[cpu_gpu].nodes;
    if (offer[performance] == "" || offer[performance]==0) {
        console.log("  getData "+offer.shortname + " "+ cpu_gpu+" perf is 0 or unknown. "+offer[performance]);
        return -1;
    }
    var time = Math.ceil(TFLOPs / offer[performance] / nodes); // time in seconds
    if (offer.shortname == "Tsub.S") {
        console.log(offer.shortname+" ("+offer[performance]+"TFlops): time for " + TFLOPs + "TFLOPs is "+ time + "("+ secondsToHuman(time, true)[1]+")");
    }
    var hours = Math.ceil(time / 36) / 100; // time in hours
    var cost = getQuote4Seconds(offer, time, nodes);
    if (cost == -1) return -1;
    var text = offer.shortname + "<br>"+CurrencyFormat(cost, "USD")+"/"+secondsToHuman(time, true)[1];
    return [hours, cost, text];
}


var duration = 1000;
var anim_opts = {frame: {duration: duration}, transition: {duration: duration}};
var anim_opts2 = { transition: {duration: duration, easing :'cubic-in-out'} };

// Animate to a new frame.
// performance is on of "gpu_p" and "cpu_p"
async function updateFrame(gd, cpu_gpu) {
    var graph_div = document.getElementById(gd);
    var graph_data = graph_div.data;
    var graph_layout = graph_div.layout;
    //console.log("Graph:");
    //console.log(graph_data);
    if (global_var[cpu_gpu].empty == true) {
        plotTimeCostMultiNode(cpu_gpu);
        return;
    }
    var TFLOPs = global_var[cpu_gpu].TFLOPs;
    var nodes = global_var[cpu_gpu].nodes;
    var performance = cpu_gpu+"_p";
    console.log("\nupdateFrame "+cpu_gpu+" TFLOPs ="+TFLOPs);
    var data = [];
    var ys = [];
    var xs = [];
    var last_prov = "";
    var tsub_s_indx = 0;
    for (var j=0; j < offers.length; j++) {
        //var prov = offers[j].provider.toLowerCase();
        // One provider = one trace
        //if (last_prov != prov) {
        //    last_prov = prov;
        //}
        var point_data = getData4offer(offers[j], cpu_gpu);
        data.push({x:point_data[0],y:point_data[1],text:point_data[2]});
        var data_len = data.length;
        var idx = data_len-1;
        if (offers[j].shortname == "Tsub.S") {
            console.log(offers[j].shortname+": point_data for " + TFLOPs + "TFLOPs is " + point_data);
        }
        //console.log("idx= "+idx);
        //console.log("trace:");
        //console.log(graph_data[idx]);
        // Loop through points of one trace.
        //console.log(data[idx].y[0]);
        // Check 'y' element, which is cost.
        if (data[idx].y[0] < 0) {
            console.log("hide");
            data[idx].visible = false;
        } else {
            graph_data[idx].visible = true;
            ys.push(data[idx].y[0]); // data for scaling graph
            xs.push(data[idx].x[0]);
            /*if (offers[j].shortname == "Tsub.S") {
                console.log("show ");
                console.log(graph_data[idx]);
                console.log(data[idx]);
                tsub_s_indx = idx;
            }*/
        }
        point_data = [];
    }
    //console.log("Graph:");
    //console.log(graph_data);
    //global_var[cpu_gpu].empty = false;


    // Auto scaling graph
    //console.log(ys);
    if (ys.length < 1) {
        displayNoDataMessage(gd, cpu_gpu);
        return;
    }
    var max_y = getMaxRange(ys);
    var max_x = getMaxRange(xs);

    var graph_x = graph_layout.xaxis.range[1];
    var scale_factor = (max_x - graph_x) / (graph_x + max_x);
    //console.log("Graph maxx = "+ graph_x);
    //console.log("Scale factor = "+ scale_factor);
    var layout = {
        xaxis: {range: [0,max_x]},
        yaxis: {range: [0,max_y]}
    };
    if (scale_factor > 0.2) {
        //console.log("Scale graph to " + max_x+ " x "+ max_y);
        await Plotly.animate(gd, {layout:layout}, anim_opts2);
    }
    var layout_t = {
        title: getPlotTitle(cpu_gpu, TFLOPs, nodes),
    };
    //console.log("Updating data");
    //console.log(data);
    await Plotly.update(gd, graph_data);  // hidden elements do not get pdated with animation function!
    await Plotly.animate(gd, {data:data, layout:layout_t}, anim_opts);
    graph_div = document.getElementById(gd);
    //console.log(graph_div.data[tsub_s_indx]);

    if (scale_factor < -0.2) {
        //console.log("Scale graph to " + max_x+ " x "+ max_y);
        await Plotly.animate(gd, {layout: layout}, anim_opts2);
    }

    resizeLegend(gd);
}


// Calculate standart deviation for the array,
// remove elements outside mean + 2*σ,
// return max of remaining elements.
function getMaxRange(x) {
    var mean = 0;
    var variance = 0;
    var deviation = 0;
    var sum = 0;
    var x_max=0;
    for (var i=0; i<x.length; i++) {
        sum += x[i];
        if (x_max < x[i]) {
            x_max = x[i];
        }
    }
    // For small arrays do not remove elements
    if (x.length < 12) {
        return x_max * axis_range_padding_koef;
    }
    mean = sum / x.length;
    for (var i=0; i<x.length; i++) {
        variance += (x[i] - mean)*(x[i] - mean);
    }
    deviation = Math.sqrt(variance / x.length);
    //console.log("mean:"+mean+" max:"+x_max+" variance:"+variance+" deviation:"+deviation);
    var upper_limit = mean + 2*deviation;
    var x_reduced = [];
    for (var i=0; i<x.length; i++) {
        if (x[i] < upper_limit) {
            x_reduced.push(x[i]);
        }
    }
    x_max = 0;
    for (var i=0; i< x_reduced.length; i++) {
        if (x_max < x_reduced[i]) {
            x_max = x_reduced[i];
        }
    }
    return x_max * axis_range_padding_koef;
}



// Plot time x cost graphs for multiple nodes
function plotTimeCostMultiNode(cpu_gpu) {
    console.log("plotTimeCostMultiNode "+ cpu_gpu);
    var TFLOPs = global_var.gpu.TFLOPs;
    var nodes = global_var.gpu.nodes;
    if (cpu_gpu == "cpu") {
        var cpu_plt = document.getElementById("CPUtime_x_cost");
        var hover_info2 = document.getElementById("offer_details2");
    } else {
        var gpu_plt = document.getElementById("GPUtime_x_cost");
        var hover_info1 = document.getElementById("offer_details1");
    }

    if (cpu_gpu == "gpu") {
        var layout = {
            title: getPlotTitle("GPU", TFLOPs, nodes),
            hovermode: 'y',
            showlegend: true,
            xaxis: {
                title: 'Calculation time (h)',
                tickangle: 45,
                //tickvals: [],
                //ticktext: [],
                //nticks: 5,
                tickfont: {
                    family: '"Cabin Condensed", "Arial Narrow", sans-serif',
                    size: 11
                },
                showline: true,
                rangemode: "tozero"
            },
            yaxis: {
                title: "Calculation cost (USD)",
                ticklen: 5,
                tickangle: 45,
                showexponent: "all",
                tickprefix: "$",
                //hoverformat: "$,.0f",
                tickfont: {
                    family: '"Cabin Condensed", "Arial Narrow", sans-serif',
                    size: 11
                },
                tickmode: "auto",
                rangemode: "tozero",
                //type:"log",
                showline: true
            },
            legend: {
                x: 1,
                xanchor: "right",
                y: 1,
                bgcolor: "rgba(255,255,255,0.8)",
                bordercolor: "#eee",
                borderwidth: 1
            }
        };

        var traces_obj = makeTraces(offers, "gpu","circle");
        var traces = traces_obj[0];
        var max_x = traces_obj[1];
        var max_y = traces_obj[2];
        if (traces.length == 0 || max_y <= 0) {
            displayNoDataMessage('GPUtime_x_cost', cpu_gpu);
            return;
        }
        layout.yaxis.range = [0, max_y];
        layout.xaxis.range = [0, max_x];

        Plotly.newPlot('GPUtime_x_cost', traces, layout);

        gpu_plt.on("plotly_hover", function(data) {
            hoverDisplay(data, hover_info1);
        });

        gpu_plt.on("plotly_unhover", function(data) {
            hover_info1.innerHTML = "&nbsp;";
            hover_info1.style.backgroundColor = "rgba(1,1,1,0)";
        });

        // Resize legend
        var GPU_chart = d3.selectAll("#GPUtime_x_cost svg.main-svg").filter(function(d, i) { return i === 0 });
        var gpu_chart_width = GPU_chart.attr("width");
        //console.log(gpu_chart_width);
        var legend_width = 190;
        var legend_shfit = 262;
        var gpu_legend_x = gpu_chart_width - legend_shfit;
        var legendGPU = d3.selectAll("#GPUtime_x_cost g.legend");
        var bg_GPU = d3.selectAll("#GPUtime_x_cost .legend rect.bg");
        bg_GPU.attr("width", legend_width);
        legendGPU.attr("transform", "translate("+gpu_legend_x+", 100)");
        if (traces.length > 0) {
            global_var[cpu_gpu].empty = false;
        } else {
            global_var[cpu_gpu].empty = true;
        }
        //console.log("\nglobal "+ cpu_gpu + "="+global_var[cpu_gpu].empty);
    }

    if (cpu_gpu == "cpu") {
        // Plot CPU time
        TFLOPs = global_var.cpu.TFLOPs;
        nodes = global_var.cpu.nodes;
        var cpu_layout = {
            title: getPlotTitle("CPU", TFLOPs, nodes),
            hovermode: 'y',
            showlegend: true,
            xaxis: {
                title: 'Calculation time (h)',
                tickangle: 45,
                //tickvals: [],
                //ticktext: [],
                //nticks: 5,
                tickfont: {
                    family: '"Cabin Condensed", "Arial Narrow", sans-serif',
                    size: 11
                },
                showline: true,
                rangemode: "tozero"
            },
            yaxis: {
                title: "Calculation cost (USD)",
                ticklen: 5,
                tickangle: 45,
                showexponent: "all",
                tickprefix: "$",
                //hoverformat: "$,.0f",
                tickfont: {
                    family: '"Cabin Condensed", "Arial Narrow", sans-serif',
                    size: 11
                },
                rangemode: "tozero",
                showline: true
            },
            legend: {
                x: 0.99,
                xanchor: "right",
                y: 1,
                bgcolor: "rgba(255,255,255,0.8)",
                bordercolor: "#eee",
                borderwidth: 1
            }
        };

        traces_obj = makeTraces(offers, "cpu", "diamond");
        var cpu_traces = traces_obj[0];
        if (cpu_traces.length == 0) {
            displayNoDataMessage('CPUtime_x_cost', cpu_gpu);
            return;
        }
        max_x = traces_obj[1];
        max_y = traces_obj[2];
        cpu_layout.yaxis.range = [0, max_y];
        cpu_layout.xaxis.range = [0, max_x];

        var cpu_plot = Plotly.newPlot('CPUtime_x_cost', cpu_traces, cpu_layout);
        // Resize legend
        var CPU_chart = d3.selectAll("#CPUtime_x_cost svg.main-svg").filter(function(d, i) { return i === 0 });
        var cpu_chart_width = CPU_chart.attr("width");
        var legend_width = 190;
        var legend_shfit = 262;
        var cpu_legend_x = cpu_chart_width - legend_shfit;
        var legendCPU = d3.selectAll("#CPUtime_x_cost .legend");
        var bg_CPU = d3.selectAll("#CPUtime_x_cost .legend rect.bg");
        bg_CPU.attr("width", legend_width);
        legendCPU.attr("transform", "translate("+cpu_legend_x+", 100)");
        cpu_plt.on("plotly_hover", function(data) {
            hoverDisplay(data, hover_info2);
        });

        cpu_plt.on("plotly_unhover", function(data) {
            hover_info2.innerHTML = "&nbsp;";
            hover_info2.style.backgroundColor = "rgba(1,1,1,0)";
        });
        if (cpu_traces.length > 0) {
            global_var[cpu_gpu].empty == false;
        }
    }
}


function plotFLOPsScale() {
    var x = EFLOPs_arr_;
    var div1=document.getElementById("FLOPsScale");
    var div2=document.getElementById("FLOPsScale_cpu");
    div1.innerHTML = "";
    div2.innerHTML = "";

    for (var i=0; i < x.length;i++) {
        div1.innerHTML = div1.innerHTML + " <span class='button' onclick='javascript:changeFLOPSGPU("+x[i]*1e+6 + ")'> "+ x[i] + "</a>&nbsp;"
        div2.innerHTML = div2.innerHTML + " <span class='button' onclick='javascript:changeFLOPSCPU("+x[i]*1e+6 + ")'> "+ x[i] + "</a>&nbsp;"
    }
}

function plotNodesScale() {
    var x = nodes_arr_;
    var div1=document.getElementById("NodesScale");
    var div2 = document.getElementById("NodesScale_cpu");
    div1.innerHTML = "";
    div2.innerHTML = "";
    for (var i=0; i < x.length;i++) {
        div1.innerHTML = div1.innerHTML + " <span class='button' onclick='javascript:changeNodesGPU("+x[i]+");'> "+ x[i] + "</a>&nbsp;"
        div2.innerHTML = div2.innerHTML + " <span class='button' onclick='javascript:changeNodesCPU("+x[i]+");'> "+ x[i] + "</a>&nbsp;"
    }
}


// These functions called on button click events.
// They cause change in TFLOPS_ or nodes_ global variables and redraw graphs.
function changeFLOPSGPU(flops) {
    global_var["gpu"].TFLOPs = flops;
    updateFrame("GPUtime_x_cost","gpu");
}

function changeFLOPSCPU(flops) {
    global_var["cpu"].TFLOPs = flops;
    updateFrame("CPUtime_x_cost","cpu");
}

function changeNodesGPU(nodes) {
    global_var["gpu"].nodes = nodes;
    updateFrame("GPUtime_x_cost","gpu");
}

function changeNodesCPU(nodes) {
    global_var["cpu"].nodes = nodes;
    updateFrame("CPUtime_x_cost","cpu")
}


function getPlotTitle(gpu_cpu, TFLOPS,nodes) {
    var nodes_txt=" on 1 node";
    if (nodes > 1) {
        nodes_txt = " on "+nodes+" nodes"
    }
    var title = gpu_cpu.toUpperCase()+' time and cost for ' + TFLOPS/1e+6 + ' EFLOP-s'+nodes_txt;
    console.log(title);
    return title;
}

// Not used
function flopsForMoney(offer, sum) {
    var hours = getHours4Quote(offer,sum)
    var CPU_FOLPs = hours * offer.cpu_p * 3600; // CPU FLOPs for given hours
    var GPU_FOLPs = hours * offer.gpu_p * 3600;
    return [CPU_FOLPs, GPU_FOLPs]
}

// Not used
function plotFLOPsMoney(sum) {
    console.log("EFLOPs for money $"+ sum);
    //var div_element = document.getElementById("flops_4money");
    var layout_bar = {
        title: "EFLOP-s for $" + sum,
        barmode: 'group',
        hovermode:'closest',
        margin: {
            b: 120,
            t: 50
        },
        legend: {
            y: 1.05,
            orientation: "h",
            bgcolor: 'rgba(255, 255, 255, 0.5)',
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
            title: 'CPU EFLOPs',
            hoverformat: ',.2f',
            exponentformat: "none",
            separatethousands: true,
            gridcolor: cpu_color.light,
            gridwidth: 1,
            linecolor: cpu_color.light
        },
        yaxis2: {
            title: 'GPU EFLOPs',
            overlaying: 'y',
            side: 'right',
            hoverformat: ',.2f',
            exponentformat: "none",
            separatethousands: true,
            gridcolor: gpu_color.light,
            gridwidth: 1,
            linecolor: gpu_color.light
        }
    };
    var y_cpu = [];
    var y_gpu = [];
    var y_cost = [];
    var y_cost_monthly = [];
    var x = [];
    var c = [];
    var info = [];
    console.log("plotFLOPsMoney has " + offers.length+" offers.")
    var last_prov="";
    var color_i = 0;
    var c_max = 0;
    var color = "";
    for (j=0; j < offers.length; j++) {
        var prov = offers[j].provider.toLowerCase();
        if (last_prov != prov) {
            last_prov = prov;
            color_i = 0;
            c_max = colors[getColor(prov)].length - 1;
        } else {
            color_i++;
            if (color_i > c_max) {
                color_i = 0;
            }
        }
        color = colors[getColor(prov)][color_i];
        //console.log("prov="+prov+" color_i="+ color_i + " cmax="+ c_max +" color="+color);
        flops = flopsForMoney(offers[j], sum)
        y_cpu.push(flops[0]/1e+6);
        y_gpu.push(flops[1]/1e+6);
        x.push(offers[j].shortname);
        c.push(color);
        info.push(getOfferInfo(offers[j]));
    }

    var trace_cpu = {
        x: x,
        y: y_cpu,
        name: "CPU TFLOPs",
        offset: -0.35,
        width: 0.3,
        type: "bar",
        marker: {
            color: cpu_color.dark
        },
        info: info,
        color: c
    };

    var trace_gpu = {
        x: x,
        y: y_gpu,
        name: "GPU TFLOPs",
        type: "bar",
        offset: 0,
        width: 0.3,
        yaxis: 'y2',
        marker: {
            color: gpu_color.dark
        },
        info: info,
        color: c
    };

    Plotly.newPlot('flops_4money', [trace_cpu, trace_gpu], layout_bar);
}




