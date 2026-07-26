// Library functions
//var CSV_file = "cost-performance.csv";

var last_update = "Last update: 2019/06/21";
var data_loaded = false;

var days_in_month = [31,28,31,30,31,30,31,31,30,31,30,31];
var accumulated_months_days = [];
var colors=[["#fa6d44", "#ff6a3f"],  // Amazon
           ["#f8a358", "#ffa85c"],  // IBM
           ["#ffd879", "#fccd5f"],  // Cirrascale
           ["#eddbdb", "#efd5d5"],  //
           ["#f5a1c0", "#f5a1c0"],  // Sakura
           ["#b9b7f4", "#b3b1fa"],  // LeaderTelecom
           ["#94c7ff", "#94c7ff"],  // Tokyo University
           ["#589ff4", "#589ff4"],  // MS
           ["#8be2fd", "#8be2fd"], // Google
           ["#d7f0d4", "#d7f0d4"],  // IDCF
           ["#d1e69b", "#d3eb96"],  // Tsubame
           ["#a3edc6", "#a3edc6"],  //
           ["#7dd8a8","#7dd8a8"],];  //
var cpu_color = {light: "#c9dff6", dark: "#a5c5e6"};
var gpu_color = {light: "#ffe8c4", dark: "#e7bd93"};
var other_colors = ["#ccdeb2","#ec9276","#e97e77","#d27486","#8e6bb4","#6766ce"];

function getColor(prov) {
    var c = colors.length-1;
    //console.log("Pick color for "+ offer.provider.toLowerCase());
    switch (prov) {
        case "amazon":
            c = 0;
            break;
        case "ibm":
            c = 1;
            break;
        case "cirrascale":
            c = 2;
            break;
        case "sakura":
            c = 4;
            break;
        case "leadertelecom":
            c = 5;
            break;
        case "the university of tokyo":
            c = 6;
            break;
        case "ms azure":
            c = 7;
            break;
        case "google":
            c = 8;
            break;
        case "idcf":
            c = 9;
            break;
        case "tsubame 2.5":
            c = 10;
            break;
        default:
            c = 11;
            break;
    };
    return c;
}


// Return porivder colors [0] in one-dimention array
function translateProvColors() {
    var cols = [];
    for (var j =0; j < colors.length; j++) {
        cols.push(colors[j][0]);
    }
    //console.log("Translated colors");
    //console.log(cols);
    return cols;
}

// Return array [0,1,2,3,...]
function getArraySizeOfProviders() {
    var arr = [];
    for (var j =0; j < colors.length; j++) {
        arr.push(j);
    }
    return arr;
}

window.rates = {};  // global var

var offers_all=[];
var offers=[];
var ndx = null;
var offers_GPU_filtered = offers_all;
var GPUgroup_global, optionslist_global;

var processing = false; // prevent onchange event loop for providers filter.

var setRates = function(data) {
    rates = data.rates;
    rates.base = data.base
    // alert(rates);
    // alert(rates.base);
    // alert(data.timestamp);

    loadData(CSV_file);
}


// Refer to
// http://openexchangerates.github.io/money.js/
function getRates() {
    msg = document.getElementById("messages");
    msg.innerHTML = "Loading data...";
    document.getElementById("updated").innerHTML = last_update;

    // $.getJSON("http://data.fixer.io/api/latest?access_key=37e8af59f58a677af7e535d5284568ba", setRates);
    $.getJSON("https://api.currencyfreaks.com/latest?apikey=8298c16965e74856af43ea5d6b2a2598&format=json", setRates);
    // $.getJSON("https://api.exchangeratesapi.io/latest?symbols=RUB,EUR,USD,JPY&base=USD", setRates);
}


function loadData(filename) {
    try {
        console.log("Loading data from "+filename);
        var req = $.get(filename);

        req.done(function (file) {
            try {
                Papa.parse(file, {
                    download: false,
                    complete: processStaticData
                });
            } catch (err) {
                console.log("Exception loding file "+filename+".");
                console.log(err.message);
            }
        });

        req.fail(loadDataFirefox(filename));

    } catch (e) {
        console.log("Exception loding file with get "+filename+".");
        console.log(e.message);
    }
}

function loadDataFirefox(filename) {
    console.log("Loading data with Papaparse from "+filename);
    try {
        Papa.parse(filename, {
            download: true,
            complete: processStaticData
        });
    } catch (err) {
        console.log("Exception loding file "+filename+".");
        console.log(err.message);
    }
}


var start_row = 2;

function processStaticData(results) {
    if (data_loaded) { return; }
    data_loaded = true;
    console.log("Processing data");
    console.log("Rows: "+results.data.length);

    // Calculate hours in months
    if (accumulated_months_days.length == 0) {
        accumulated_days = 0;
        for (var m = 0; m < 12; m++) {
            accumulated_days += days_in_month[m];
            accumulated_months_days.push(accumulated_days);
        }
    }

    var rows = results.data.length
    var provider = "";
    var provider_link = "";
    for (var i=start_row; i<rows; i++) {
        row = results.data[i];
        // skip empty row
        if (row.length < 2) {
            continue;
        }
        if (row[2] == "" && row[4] == "") {
            continue;
        }
        if (provider !=  row[0] && row[0] !="") {
            provider = row[0];
            provider_link = row[1];
        }

        var offer = {
            provider: provider,
            provider_link: provider_link,
            name: row[2],
            name_link: row[3],
            shortname: row[4],
            minutely_native: row[5],
            hourly_native: row[6],
            weekly_native: row[7],
            monthly_native: row[8],
            yearly_native: row[9],
            month_limit_native: row[10],
            setup_native: row[11],
            currency:   row[12],
            minutely:   convertCurrency(row[5],row[12]),
            hourly:     convertCurrency(row[6],row[12]),
            weekly:     convertCurrency(row[7],row[12]),
            monthly:    convertCurrency(row[8],row[12]),
            yearly:     convertCurrency(row[9],row[12]),
            month_limit:convertCurrency(row[10],row[12]),
            setup:      convertCurrency(row[11],row[12]),
            cpu_p:      row[13],
            cpu_perf_group: getGroup(row[13],[0.5,1,1.5,2,2.5]),
            gpu_p:     row[14],
            gpu_perf_group: getGroup(row[14],[20,40,60,80,100]),
            gpu_model: row[15],
            gpus:      row[16],
            cpu_model: row[17],
            cpus:      row[18],
            memory:    row[19],
            memory_group: getGroup(row[19],[50,100,200,300,750,1000]),
            hdd1:      row[20],
            hdd1_vol:  row[21],
            hdd2:      row[22],
            hdd2_vol:  row[23],
            net:       row[24],
            time_limit:row[25],
            continuous:row[26],
            notes:     row[27]
        }
        offers_all.push(offer);
    }
    plotFilterPlots();
    continue_proc(resetFilters, "");
    msg.innerHTML = "";
    printRates();
}


var margins = { top:10, left:10, right:10, bottom: 20};
// Plot size for small plots
var width1 = 160;
var height1 = 150;
// Plot size for large plots
var width2 = 220;
var height2 = 326;


function plotGPUs() {
    console.log("Plot GPU numbers");
    var GPUsDim = ndx.dimension( function(d) { return d.gpus;});
    var gpus_total = GPUsDim.group();
    var GPUs_pie_chart = dc.rowChart("#dc_gpus");
    GPUs_pie_chart
        .width(width1).height(height1)
        .dimension(GPUsDim)
        .group(gpus_total)
        .ordinalColors([gpu_color.dark])
        .margins(margins)
        .xAxis().ticks(4);

    GPUs_pie_chart.on('filtered.monitor', function(chart, filter) {
        // report the filter applied
        console.log("DC event");
        console.log(chart.filters());
        continue_proc(filterByGroup, "gpus", chart.filters());
    });
}


function plotGPUperf() {
    console.log("Plot GPU performance");
    var GPU_pefr_dim = ndx.dimension( function(d) {
        return d.gpu_perf_group;
    });
    var gpu_group = GPU_pefr_dim.group();
    var GPU_perf_chart = dc.rowChart("#dc_gpu_perf");
    GPU_perf_chart
        .width(width1).height(height1)
        .dimension(GPU_pefr_dim)
        .group(gpu_group)
        .ordinalColors([gpu_color.dark])
        .margins(margins)
        .label( function (d) { return d.key[0]})
        .legend(dc.legend().x(80).y(70).itemHeight(13).gap(5))
        .ordering(function(d) { return d.key[1]; })
        .xAxis().ticks(4);

    GPU_perf_chart.on('filtered.monitor', function(chart, filter) {
        // report the filter applied
        console.log("DC event");
        // console.log(chart.filters());
        continue_proc(filterByGroup, "gpu_perf_group", chart.filters());
    });
}

function plotCPUperf() {
    console.log("Plot CPU performance");
    var CPU_pefr_dim = ndx.dimension( function(d) {
        return d.cpu_perf_group;
    });
    var cpu_group = CPU_pefr_dim.group();
    var CPU_perf_chart = dc.rowChart("#dc_cpu_perf");
    CPU_perf_chart
        .width(width1).height(height1)
        .dimension(CPU_pefr_dim)
        .group(cpu_group)
        .ordinalColors([cpu_color.dark])
        .margins(margins)
        .label( function (d) { return d.key[0]})
        .legend(dc.legend().x(80).y(70).itemHeight(13).gap(5))
        .ordering(function(d) { return d.key[1]; })
        .xAxis().ticks(4);

    CPU_perf_chart.on('filtered.monitor', function(chart, filter) {
        // report the filter applied
        console.log("DC event");
        console.log(chart.filters());
        continue_proc(filterByGroup, "cpu_perf_group", chart.filters());
    });
}


function plotMemory() {
    console.log("Plot Memory");
    var memory_dim = ndx.dimension( function(d) {
        return d.memory_group;
    });
    var grp = memory_dim.group();
    var memory_chart = dc.rowChart("#dc_memory");
    memory_chart
        .width(width1).height(height1)
        .dimension(memory_dim)
        .group(grp)
        .ordinalColors([other_colors[0]])
        .margins(margins)
        .label( function (d) { return d.key[0]})
        .legend(dc.legend().x(80).y(70).itemHeight(13).gap(5))
        .ordering(function(d) { return d.key[1]; })
        .xAxis().ticks(4);

    memory_chart.on('filtered.monitor', function(chart, filter) {
        // report the filter applied
        console.log("DC event");
        console.log(chart.filters());
        continue_proc(filterByGroup, "memory_group", chart.filters());
    });
}

var colorScale = d3.scale.linear()
  .domain([0, 30])
  .range(['#6766ce', '#eca576']);

function plotGPUmodels() {
    console.log("Plot GPU models");
    var model_dim = ndx.dimension( function (d) { return d.gpu_model;});
    var grp = model_dim.group();
    var chart = dc.rowChart("#dc_gpu_models");
    chart
        .width(width2).height(height2)
        .dimension(model_dim)
        .group(grp)
        .margins(margins)
        .ordinalColors([gpu_color.dark])
    chart.xAxis().ticks(5);

    chart.on('filtered.monitor', function(chart, filter) {
        // report the filter applied
        console.log("DC event");
        console.log(chart.filters());
        continue_proc(filterByGroup, "gpu_model", chart.filters());
    });
}


function plotProviders() {
    console.log("Plot providers");
    var provider_dim = ndx.dimension( function (d) { return d.provider;});
    var provider_grp = provider_dim.group();
    var chart = dc.rowChart("#dc_providers");
    chart
        .width(width2).height(height2)
        .dimension(provider_dim)
        .group(provider_grp)
        .margins(margins)
        .colors(d3.scale.ordinal().domain(getArraySizeOfProviders())
                .range(translateProvColors()))
        .colorAccessor( function (d) {
            if (typeof d === "undefined") return colors.length-1;
            var c = getColor(d.key.toLowerCase());
            return +c;
        })
        .ordering(function(d) { return getColor(d.key.toLowerCase()); })

    chart.on('filtered.monitor', function(chart, filter) {
        // report the filter applied
        console.log("DC event");
        console.log(chart.filters());
        continue_proc(filterByGroup, "provider", chart.filters());
    });
}


// Return tuple: first element is a name of performance group,
// second element is the group ordinal number (0,1,2,3...)
function getGroup(value, groupSplit) {
    var i = 0;
    if (value == "") { return ["unknown", groupSplit.length+1]};
    if (value < groupSplit[0]) { return ["<"+groupSplit[0],groupSplit.length]; }
    for (i = 0; i < groupSplit.length; i++ ) {
        if (value < groupSplit[i]) {
            return [groupSplit[i-1]+"-"+groupSplit[i], groupSplit.length-i];
        }
    }
    return [">"+groupSplit[i-1], groupSplit.length-i];
}


function getOfferInfo(offer) {
    var memory = offer.memory;
    if (memory == null || memory == "") {
        memory = ""
    } else {
        memory = " | RAM: " + memory + " GB"
    }
    var hdd = "";
    if (offer.hdd1_vol != "" ) {
        hdd += " | HDD: "+offer.hdd1_vol+"GB";
        if (offer.hdd1 != "") {
            hdd += " ("+offer.hdd1+")";
        }
        if (offer.hdd2_vol !="") {
            hdd +=" + "+offer.hdd2_vol+"GB";
            if (offer.hdd2 != "") {
                hdd += " ("+ offer.hdd2+")";
            }
        }
    }
    return offer.provider + " "+ offer.name + " | CPU: " + offer.cpu_model + " x" + offer.cpus + " |  GPU: "+ offer.gpu_model + " x"+ offer.gpus + memory + hdd;
}


// "Filters" offers: save filtered list in "offers" global variable.
function resetFilters(arg) {
    offers = offers_all;
    for (var k in filters_obj) {
        filters_obj[k] = [];
    }
}

var filters_obj = {
        "gpus": [],
        "provider": [],
        "gpu_perf_group" : [],
        "gpu_model": [],
        "cpu_perf_group": [],
        "memory_group": []
    }


// Filters offers: save filtered list in "offers" global variable.
// Filter out offers by numbet of GPUs and by providers.
// Filter settings (selected values) are stored in global variables GPU_filters and provider_filters.
// Filter offers_all by applying 2 filters one by one.
function filterByGroup(fieldname, group) {
    filters_obj[fieldname] = group;
    offers = offers_all;
    for (var k in filters_obj) {
        offers = applyFilter(offers, k, filters_obj[k]);
    }
}


// Filter offers_ (input parameter) by leaving only offers
// with fieldname (input parameter) values from array group (input parameter).
function applyFilter(offers_, fieldname, group) {
    if (group.length == 0) {
        return offers_;
    }
    var filtered_offers=[];
    for (var j=0; j < offers_.length; j++) {
        var compareto = offers_[j][fieldname];
        if (objectSearch(group,compareto)) {
            filtered_offers.push(offers_[j]);
        }
    }
    return filtered_offers;
}

// Search for strings or arrays in an array (obj1).
// in case of arrays compares 1st elements only.
function objectSearch(obj1,obj2) {
    if (typeof obj2 === "object") {
        obj2 = obj2[0];
    }
    for (var k in obj1) {
        var test = obj1[k]
        if (typeof test === "object") {
            test = test[0];
        }
        if (test == obj2) { return true; }
    }
    return false;
}


// Return:
// Array of full months in period and
// leftover time in hours.
// Period is in hours.
function getMonths4Hours(h) {
    var period = hoursToHuman(h);
    var leftover = 0;
    if (period[0].days > 0 ) {
        leftover +=  period[0].days *24;
    }
    if (period[0].hours > 0) {
        leftover += period[0].hours;
    }
    var months = period[0].years*12 + period[0].months;
    return [months, leftover];
}


// Return:
// Array of full months in period and
// leftover time in seconds.
// Period is in seconds.
function getMonths4Seconds(sec) {
    var period = secondsToHuman(sec);
    var leftover = 0;
    if (period[0].days > 0 ) {
        leftover +=  period[0].days *24 * 3600;
    }
    if (period[0].hours > 0) {
        leftover += period[0].hours * 3600;
    }
    if (period[0].minutes > 0) {
        leftover += period[0].minutes * 60;
    }
    if (period[0].seconds > 0) {
        leftover += period[0].seconds;
    }
    var months = period[0].years*12 + period[0].months;
    return [months, leftover];
}


// Koeff.3 for Tsubame 2.5 cost calculations
// cost = (nodes * walltime (s) * koeff.1 * koeff.2 * koeff.3) / 3600(s)
// koeff.3 borders (h): 1, 24, 48,  96
var tsubame_koeff = [0.9, 1, 2, 4, -1];
var tsubame_border= [1, 24, 48, 96];

// Return Cost for given number of seconds and nodes.
function getQuote4Seconds(offer, sec, nodes) {
    //console.log(sec+"sec");
    var cost = 0;
    if (nodes == null || nodes == "") {
        nodes = 1;
    }
    if (offer.setup != "" ) {
        cost += offer.setup * nodes;  // Assume setup price is per node
    }
    if ("continuous" in offer && offer.continuous != "" ) {
        var h = Math.ceil(sec / 3600); // sec -> hours for cost calculations
        var hours = offer.time_limit;
        if (offer.continuous == 1) {
            var periods = Math.ceil(h / hours);
            cost += periods * offer.yearly * nodes;
            return cost;
        } else if (offer.continuous == 2.5) {
            // Tsubame 2.5
            var koeff3 = tsubame_koeff[0];
            for (var k=0; k < tsubame_border.length; k++) {
                if (tsubame_border[k] < h) {
                    koeff3 = tsubame_koeff[k+1];
                } else {
                    break;
                }
            }
            if (koeff3 < 0) {
                console.log(offer.shortname + " cannot be used for "+h+" hours and "+ nodes + " nodes.");
                return -1;  // Jobs cannot be run for more than 96 hours on Tsubame2.5
            }
            var periods = Math.ceil(h * nodes * koeff3 / hours);
            //console.log(" periods=ceil("+h+"x"+nodes+"x"+ koeff3+"/"+hours+")="+(periods));
            cost = periods * offer.yearly;
            //console.log("  getQuote4Seconds 2 cost: "+periods+" x "+offer.yearly+ " = "+cost);
            return cost;
        }
    }
    // Apply monthly limit
    if ("month_limit" in offer && offer.month_limit != "" ) {
        //console.log("Month limit for "+offer.shortname+" is " + offer.month_limit);
        var months = getMonths4Seconds(sec);
        //console.log("Months:"+months);
        cost += offer.month_limit * months[0] * nodes;
        sec = months[1]; // use leftover time to calculate additional cost
    }
    if ("minutely" in offer && offer.minutely != "") {
        var cost1 = Math.ceil(sec / 60) * offer.minutely * nodes;
        // Apply monthly limit
        if ("month_limit" in offer && offer.month_limit != "" ) {
            if (cost1 > offer.month_limit * nodes) {
                cost1 = offer.month_limit * nodes;
            }
        }
        cost += cost1;
    }
    else if ("hourly" in offer && offer.hourly != "" ) {
        var cost1 = Math.ceil(sec / 3600) * offer.hourly * nodes;
        //console.log (" "+sec+"sec. cost1= "+Math.ceil(sec / 3600)+"x"+offer.hourly+" = "+cost1);
        // Apply monthly limit
        if ("month_limit" in offer && offer.month_limit != "" ) {
            if (cost1 > offer.month_limit * nodes) {
                cost1 = offer.month_limit * nodes;
            }
        }
        cost += cost1;
    } else if ("weekly" in offer && offer.weekly != "" ) {
        var period_w = Math.ceil(sec / (24 * 7 * 3600));
        var cost1 = period_w * offer.weekly * nodes;
        // Apply monthly limit
        if ("month_limit" in offer && offer.month_limit != "" ) {
            if (cost1 > offer.month_limit * nodes) {
                cost1 = offer.month_limit * nodes;
            }
        }
        cost += cost1;
    } else if ("monthly" in offer && offer.monthly != "" ) {
        var months = getMonths4Seconds(sec);
        var more_than_a_month = 0;
        if (months[1] > 0) {
            more_than_a_month = 1;
        }
        cost +=  (months[0] + more_than_a_month)* offer.monthly * nodes;
        //console.log("Monthly: "+ offer.shortname + " "+offer.monthly+" cost="+cost);
    } else if ("yearly" in offer && offer.yearly != "" ) {
        // Year is counted as 365 days
        var period_y = Math.ceil(sec / (3600 * 24 * 365));
        cost += period_y * offer.yearly * nodes;
    }
    return cost;
}

// Return Cost for given number of hours (period).
// Called from Cost for rent perion chart.
function getQuote4Hours(offer, h) {
    var cost = 0;
    if (offer.setup != "" ) {
        cost += offer.setup;
    }
    if ("continuous" in offer && offer.continuous != "" ) {

        if (offer.continuous == 1) {
            var periods = Math.ceil(h / offer.time_limit);
            cost += periods * offer.yearly;
            return cost;
        } else if (offer.continuous == 2.5) {
            // Tsubame 2.5
            // koeff3 is 1 for jobs running <= 1 day.
            var koeff3 = 1;
            var nodes = 1;
            var periods = Math.ceil(h * koeff3 * nodes / offer.time_limit);
            //console.log(offer.shortname+" periods="+periods+" for hours="+h);
            cost += periods *  offer.yearly;
            return cost;
        }
    }
    // Apply monthly limit
    if ("month_limit" in offer && offer.month_limit != "" ) {
        //console.log("Month limit for "+offer.shortname+" is " + offer.month_limit);
        var months = getMonths4Hours(h);
        cost += offer.month_limit * months[0];
        h = months[1]; // use leftover time to calculate additional cost
    }
    if ("minutely" in offer && offer.minutely != "") {
        var cost1 = 60 * h * offer.minutely;
        // Apply monthly limit
        if ("month_limit" in offer && offer.month_limit != "" ) {
            if (cost1 > offer.month_limit) {
                cost1 = offer.month_limit;
            }
        }
        cost += cost1;
    }
    else if ("hourly" in offer && offer.hourly != "" ) {
        var cost1 = h * offer.hourly;
        // Apply monthly limit
        if ("month_limit" in offer && offer.month_limit != "" ) {
            if (cost1 > offer.month_limit) {
                cost1 = offer.month_limit;
            }
        }
        cost += cost1;
    } else if ("weekly" in offer && offer.weekly != "" ) {
        var period_w = Math.ceil(h / (24 * 7));
        cost1 = period_w * offer.weekly;
        // Apply monthly limit
        if ("month_limit" in offer && offer.month_limit != "" ) {
            if (cost1 > offer.month_limit) {
                cost1 = offer.month_limit;
            }
        }
        cost += cost1;
    } else if ("monthly" in offer && offer.monthly != "" ) {
        var months = getMonths4Hours(h);
        var more_than_a_month = 0;
        if (months[1] > 0) {
            more_than_a_month = 1;
        }
        cost +=  (months[0] + more_than_a_month)* offer.monthly;
        //console.log("Monthly: "+ offer.shortname + " "+offer.monthly);
        //console.log(months);
    } else if ("yearly" in offer && offer.yearly != "" ) {
        // Year is counted as 365 days
        var period_y = Math.ceil(h / (24 * 365));
        cost += period_y * offer.yearly;
    }
    return cost;
}

// Return time in hours for how long one can rent an offer for the given sum
function getHours4Quote(offer, sum) {

    if (offer.setup != "" ) {
        // Subtract setup cost
        sum = sum - offer.setup;
    }
    console.log("hours4quote "+offer.shortname+" sum="+sum);
    if (sum <=0) {
        return 0;
    }
    var h = 0;
    if (offer.hourly != "" ) {
        h = Math.floor(sum / offer.hourly); // max hours can rent for given sum.
        //console.log("hours4quote "+offer.shortname+" hours="+h);
    } else if (offer.weekly != "" ) {
        var period_w = Math.floor(sum  / offer.weekly);
        //console.log("hours4quote "+offer.shortname+" weeks="+period_w);
        h = period_w * (24 * 7);
    } else if (offer.monthly != "" ) {
        var period_m = Math.floor(sum  / offer.monthly);
        //console.log("hours4quote "+offer.shortname+" months="+period_m);
        h = getHours4Months(period_m);
    } else if (offer.yearly != "" ) {
        var period_y = Math.floor(sum  / offer.yearly);
        console.log("hours4quote "+offer.shortname+" years="+period_y);
        h = getHours4Months(period_y * 12);
    } else {
        console.log(offer);
    }
    return h;
}

// Convert SUM in 'from' currency to 'to' currency
function convertCurrency(sum, from) {
    to = "USD";
    if (sum == null || sum == "") return "";
    console.log("convert from "+from+" to "+to);
    console.log("SUM="+sum+", rate:"+rates[from]/rates[to]);

    if (from != to) {
        try {
            var conv = round_curr(sum * rates[to] / rates[from]);
            console.log(sum + " " +from + " = " + conv + " " + to );
            return conv;
        } catch(err) {
            console.log("Currency convertion exeption for "+sum+ currency+".");
            console.log(err.message);
            return 0;
        }
    }
    return sum;
}


// Round number to 2 digits after decimal point
function round_curr(n) {
    var n100 = Math.round(n*100);
    return n100/100;
}

function ButtonOver(button) {
    if (button.title == "") {
        return;
    }
    var tmp = button.innerHTML;
    button.innerHTML = button.title;
    button.title = tmp;
}

function printRates() {
    var div = document.getElementById("rates");
    var to = "USD";
    var cur = "JPY";
    rate = rates[cur] / rates[to];
    div.innerHTML = cur + "/" + to +" = " +rate.toFixed(2)+ " &nbsp; ";
    cur = "EUR";
    rate = rates[cur] / rates[to];
    div.innerHTML += cur + "/" + to+" = "+rate.toFixed(2)+ " &nbsp; ";
    cur = "RUB";
    rate = rates[cur] / rates[to];
    div.innerHTML += cur + "/" + to+" = "+rate.toFixed(2);
}

// Transform Offer name to simplified form for comparison with other names
function getSimpleName(name,skip_words) {
    var simple_name = name.toLowerCase();
    for (var i=0; i < skip_words.length; i++) {
        simple_name = simple_name.replace(skip_words[i],"");
    }
    return simple_name;
}


// Convert time in hours to human readable format
// Return object {years, months, days, hours}.
// Second returned value is text representation.
function hoursToHuman(h, short) {
    if (accumulated_months_days.length < 1) {
        //console.log("Calculate accumulated months days");
        accumulated_days = 0;
        for (var m = 0; m < 12; m++) {
            accumulated_days += days_in_month[m];
            accumulated_months_days.push(accumulated_days);
        }
        //console.log(accumulated_months_days);
    }
    var human_text_long = {
        years:" year ",
        month: " month ",
        months: " months ",
        day: " day ",
        days: " days ",
        hours: " hours "
    }
    var human_text_short = {
        years:"y. ",
        month: "m. ",
        months: "m. ",
        day: "d. ",
        days: "d. ",
        hours: "h. "
    }
    var human_text = null;
    if (short == true) {
        human_text = human_text_short;
    } else {
        human_text = human_text_long;
    }
    var init_h = h;
    var hours_day   = 24;
    var hours_year  = 24 * accumulated_months_days[11];


    var years  = Math.floor(h / hours_year);
    h = h - (years * hours_year);

    // Months
    // Have numbers of days in months, so need to know how many full days we have.
    var days = Math.floor(h / hours_day);
    var m = 0;
    for (; m < 12; m++ ) {
        if (days < accumulated_months_days[m]) {
            break;
        }
    }
    var months = m;
    //console.log("Calculating months. days="+days+" m="+m+ " months="+months+ " years="+years);

    if (months > 0) {
        h = h - accumulated_months_days[months-1] * hours_day;
    }

    // Days
    days   = Math.floor(h / hours_day);
    h = h - days * hours_day;

    // Hours
    var hours  = h;
    s = "";
    if ( years > 0) {
        s = s + years + human_text.years;
    }
    if ( months > 0) {
        if (months == 1) {
            s = s + months + human_text.month;
        } else {
            s = s + months + human_text.months;
        }
    }
    if ( days > 0) {
        if (days == 1) {
            s = s + days + human_text.day;
        } else {
            s = s + days + human_text.days;
        }
    }
    if ( hours > 0 || s.length < 2) {
        s = s + hours + human_text.hours;
    }
    //console.log("Count "+init_h+ " hours as "+ s );
    return [{
        years: years,
        months: months,
        days: days,
        hours: hours
        }, s ];
}



// Convert time in seconds to human readable format
// Return object {years, months, days, hours, seconds}.
// Second returned value is text representation.
function secondsToHuman(sec, short) {
    if (accumulated_months_days.length < 1) {
        //console.log("Calculate accumulated months days");
        accumulated_days = 0;
        for (var m = 0; m < 12; m++) {
            accumulated_days += days_in_month[m];
            accumulated_months_days.push(accumulated_days);
        }
        //console.log(accumulated_months_days);
    }
    var human_text_long = {
        years:" year ",
        month: " month ",
        months: " months ",
        day: " day ",
        days: " days ",
        hours: " hours ",
        minutes: " minutes ",
        seconds: " sec."
    }
    var human_text_short = {
        years:"y. ",
        month: "m. ",
        months: "m. ",
        day: "d. ",
        days: "d. ",
        hours: ":",
        minutes: ":",
        seconds: ""
    }
    var human_text = null;
    if (short == true) {
        human_text = human_text_short;
    } else {
        human_text = human_text_long;
    }
    var init_sec = sec;
    var seconds_day   = 24 * 3600;
    var seconds_year  = 3600 * 24 * accumulated_months_days[11];


    var years  = Math.floor(sec / seconds_year);
    sec = sec - (years * seconds_year);

    // Months
    // Have numbers of days in months, so need to know how many full days we have.
    var days = Math.floor(sec / seconds_day);
    var m = 0;
    for (; m < 12; m++ ) {
        if (days < accumulated_months_days[m]) {
            break;
        }
    }
    var months = m;
    //console.log("Calculating months. days="+days+" m="+m+ " months="+months+ " years="+years);

    if (months > 0) {
        sec = sec - accumulated_months_days[months-1] * seconds_day;
    }

    // Days
    days   = Math.floor(sec / seconds_day);
    sec = sec - days * seconds_day;

    // Hours
    var hours  = Math.floor(sec / 3600);
    sec = sec - hours * 3600;

    // Minutes
    var mins = Math.floor( sec / 60);
    sec = sec - mins * 60;
    s = "";
    if ( years > 0) {
        s = s + years + human_text.years;
    }
    if ( months > 0) {
        if (months == 1) {
            s = s + months + human_text.month;
        } else {
            s = s + months + human_text.months;
        }
    }
    if ( days > 0) {
        if (days == 1) {
            s = s + days + human_text.day;
        } else {
            s = s + days + human_text.days;
        }
    }
    s = s + hours + human_text.hours;
    s = s + time_str(mins) + human_text.minutes;
    s = s + time_str(sec) + human_text.seconds;

    //console.log("Count "+init_sec+ " seconds as "+ s );
    return [{
        years: years,
        months: months,
        days: days,
        hours: hours,
        minutes: mins,
        seconds: sec
        }, s ];
}

// Return string representation of int
// as 2 digits, first is 0 if i < 10.
function time_str(i) {
    var str = i.toString();
    if (str.length < 2) {
        str = "0"+str;
    }
    return str;
}



function getHours4Months(months) {
    var hours = 0;
    var months_total = months;
    while (months > 11) {
        hours += 24*accumulated_months_days[11]; // Should be 24*365 = 8760 (hours in a year).
        months -= 12;
    }
    if (months > 0) {
        hours += 24*accumulated_months_days[months-1];
    }
    //console.log("Count " +months_total+ " months as "+hours+" hours.")
    return hours;
}


function CurrencyFormat(s, currency) {
    if (s == "") {
        return "";
    }
    //console.log("Formatting " + s + " as " + currency);
    num = Number(s).toLocaleString('en', { style: 'currency', currency: currency, maximumFractionDigits: 2 });
    num = num.replace(/,/g, "&nbsp;");
    return num;
}


var cost_periods = [
    ["minutely","min."],
    ["hourly","h."],
    ["weekly", "w."],
    ["monthly", "m."],
    ["yearly", "y."],
    ["setup", ""]
]

// Split one offer by cost period.
// Return array of offers.
function splitByCostPeriod(offer) {
    split_offers = [];
    cost_periods.forEach( function (period) {
        if (offer[period[0]] != "") {
            var offer_new = cloneOffer(offer);
            offer_new[period[0]] = offer[period[0]];
            offer_new["name"] = offer_new["name"] + " " + period[0];
            offer_new["shortname"] = offer_new["shortname"] + " " + period[1];
            split_offers.push(offer_new);
        }
    });
    //console.log("Split "+ offer.name+" into "+ split_offers.length);
    /*if (split_offers.length > 2) {
        for (var i=0; i < split_offers.length; i++) {
            console.log(split_offers[i]);
        }
    }*/
    return split_offers;
}

// Copy all offers fields except for period costs.
function cloneOffer(offer) {
    var new_offer = {};
    for (var key in offer) {
        var copy_me = true;
        for (var i=0; i < cost_periods.length; i++ ) {
            // Do not copy fields listed in cost_periods array.
            if (key == cost_periods[i][0]) {
                copy_me = false;
                break;
            }
        }
        if (copy_me) {
            new_offer[key] = offer[key];
        } else {
            new_offer[key] = "";
        }
    }
    return new_offer;
}


// Hover display
function hoverDisplay(data, hover_info) {
    // console.log()
    for (var i=0; i < data.points.length; i++) {
        var point = data.points[i];
        if (point.data.info == null) {
            return;
        }
        point_index = point.pointNumber;
        hover_info.innerHTML =  hover_info.innerHTML + "<div id='hover_info_div"+i+"'>" +point.data.info[point_index] + "</div>";
        // console.log(hover_info.innerHTML);
        inner_div = hover_info.lastChild
        inner_div.style.backgroundColor = point.data.marker.color[point_index];
        inner_div.style.opacity="0.8";
        //console.log(point.data.info[point_index] + " " + point_index + " " + point.data.marker.color[point_index]);
    }
}


// Resize legend
function resizeLegend(ID) {
    var scatter_chart = d3.selectAll("#"+ID).filter(function(d, i) { return i === 0 });
    var scatter_chart_width = scatter_chart.attr("width");
    var legend_width = 190;
    var bg_scatter = d3.selectAll("#"+ID+" .legend rect.bg");
    bg_scatter.attr("width", legend_width);
}


// Display warning that no data can be displayed
function displayNoDataMessage(gd, cpu_gpu) {
    console.log("No data. gd="+gd);
    global_var[cpu_gpu].empty = true;
    var trace1 = {
        x: [2.5],
        y: [3],
        text: ['No available offers'],
        textfont: {
            family: '"Arial", "Helvetica", sans-serif',
            size: 36,
            color: '#ccc'
        },
        mode: 'text'
    };
    var trace2 = {
        x: [2.5],
        y: [2.2],
        text: ['Change task complexity (FLOPs) or nodes number'],
        textfont: {
            family: '"Arial", "Helvetica", sans-serif',
            size: 20,
            color: '#ccc'
        },
        mode: 'text'
    };
    var layout = {
        title: "No data to display",
        xaxis: {
            range: [0, 5]
        },
        yaxis: {
            range: [0, 5]
        },
        showlegend: false
    }
    Plotly.newPlot(gd, [trace1, trace2], layout);
}
