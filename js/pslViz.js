'use strict';

window.pslviz = window.pslviz || {};

const BAR_CHART_MARGIN = {
    top: 20,
    right: 10,
    bottom: 50,
    left: 80
};

const MAX_BAR_CHART_WIDTH = 1000;
const BAR_CHART_COL_WIDTH = 100;
const BAR_CHART_HEIGHT = 400;
const BAR_CHART_TRANSITION_DURATION = 1000;

const NAVBAR_MODEL_CONTEXT_CHANGER = "navbar-model-context";
const NAVBAR_GROUND_ATOM_CONTEXT_CHANGER = "navbar-ground-atom-context";
const NAVBAR_GROUND_RULE_CONTEXT_CHANGER = "navbar-ground-rule-context";
const RULE_OVERVIEW_MODULE = "module-overview-table";
const RULE_OVERVIEW_TABLE_TITLE = "Rule Overview";
const TRUTH_TABLE_MODULE = "module-truth-table";
const TRUTH_TABLE_TITLE = "Truth Table";
const VIOLATED_GROUND_RULES_MODULE = "module-violation-table";
const VIOLATED_GROUND_RULES_TABLE_TITLE = "Violated Constraints";
const GROUND_ATOM_AGGREGATE_MODULE = "module-ground-atom-aggregate-chart";
const GROUND_ATOM_RULES_MODULE = "module-associated-rules-table";
const ASSOCIATED_GROUND_RULES_TABLE_TITLE = "Associated Ground Rules";
const INDIVIDUAL_GROUND_RULE_MODULE = "module-individual-ground-rule-table";
const RULE_AGGREGATE_MODULE = "module-aggregate-chart";
const RULE_AGGREGATE_CHART_TITLE = "Aggregate Rule Stats";
const DEF_BAR_CHART_X_LABEL = "Rule";
const DEF_AGGREGATE_Y_LABEL = "Total Satisfaction";
const AGGREGATE_RULE_STATS_Y_LABELS = [
    "Total Satisfaction",
    "Mean Satisfaction",
    "Total Dissatisfaction",
    "Mean Dissatisfaction",
    "Count",
];

// Regular expressions to clean rules.
const RULE_STRING_REPLACEMENTS = [
    // [pattern, replacement].

    // "+ -1.0" -> "-1.0"
    [/\+ -(\d+\.\d+)/g, "- $1"],

    // "1.0 * A" -> "A"
    [/1\.0 \*/g, ""],

    // "~( Foo(A, B) )" -> "!Foo(A, B)"
    [/~\( ([^)]+\)) \)/g, "!$1"],

    // ^"( ... ) >> Foo(A, B)" -> "... ) >> Foo(A, B)"
    [/^\( /, ""],

    // "... ) >> Foo(A, B)" -> "... >> Foo(A, B)"
    [/ \) (>>)/, " $1"],

    // ">>" -> "→"
    [/>>/, "→"],

    // " )"$ -> ""
    [/ \)$/, ""],
];

// Regular expressions to clean ground rules.
const GROUND_RULE_STRING_REPLACEMENTS = [
    // [pattern, replacement].

    // "& ('123' != '432')" -> ""
    // "('123' != '432') &" -> ""
    [/(\('[^']+' != '[^']+'\) & )|( & \('[^']+' != '[^']+'\))/g, ""],

    // "+ -1.0" -> "-1.0"
    [/\+ -(\d+\.\d+)/g, "- $1"],

    // "1.0 * A" -> "A"
    [/1\.0 \*/g, ""],
];

function updateBarChart(chart, barData) {

    let data = [];
    for (let i = 1; i < barData.length + 1; i++) {
        data.push({
            'ruleNo': barData[i-1]["ID"],
            'value': barData[i-1][chart.yAxisLabel],
        });
    }

    // Redefine the scale for y axis
    // Ensure that the mean charts always have a scale of [0,1]
    chart.yScale.domain((chart.yAxisLabel.includes("Mean")) ? [0, 1] : [0, d3.max(data, function (d) { return d.value; })])

    // Update the y-axis label
    chart.svg.transition().select(".y-label")
        .duration(BAR_CHART_TRANSITION_DURATION)
        .text(chart.yAxisLabel);

    // Update the call function so the new scale is used for the x and y axis
    chart.svg.transition().select(".y-axis")
        .duration(BAR_CHART_TRANSITION_DURATION)
        .call(chart.yAxis);

    // Update the new the attributes of each bar for the bar chart with new data
    chart.svg.selectAll(".bar")
        .data(data)
        .transition()
        .duration(BAR_CHART_TRANSITION_DURATION)
        .attr("x", function(row) { return chart.xScale(row.ruleNo); })
        .attr("width", chart.xScale.rangeBand())
        .attr("y", function(row) { return chart.yScale(row.value); })
        .attr("height", function(row) { return chart.innerHeight - chart.yScale(row.value); });
}

function createBarChart(chartData, div, xAxisLabel, yAxisLabel, chartId) {
    let data = [];
    for (let i = 1; i < chartData.length + 1; i++) {
        data.push({
            'ruleNo': chartData[i - 1]["ID"],
            'value': chartData[i - 1][yAxisLabel],
        });
    }

    const outterWidth = Math.min(MAX_BAR_CHART_WIDTH, data.length * BAR_CHART_COL_WIDTH);
    const outterHeight = BAR_CHART_HEIGHT;

    // The dimensions inside the margins.
    const innerWidth = outterWidth - BAR_CHART_MARGIN.left - BAR_CHART_MARGIN.right;
    const innerHeight = outterHeight - BAR_CHART_MARGIN.top - BAR_CHART_MARGIN.bottom;

    let xScale = d3.scale.ordinal()
        .domain(data.map(function (d) { return d.ruleNo; }))
        .rangeBands([0, innerWidth], 0.2);

    // Ensure that the mean charts always have a scale of [0,1]
    let yScale = d3.scale.linear()
        .domain((yAxisLabel.includes("Mean")) ? [0, 1] : [0, d3.max(data, function (d) { return d.value; })])
        .range([innerHeight, 0]);

    let xAxis = d3.svg.axis().scale(xScale).orient("bottom");
    let yAxis = d3.svg.axis().scale(yScale).orient("left");

    const svgTranslation = "translate(" + BAR_CHART_MARGIN.left + "," + BAR_CHART_MARGIN.top + ")";

    let svg = div.append("svg")
        .attr("width", outterWidth)
        .attr("height", outterHeight)
        .classed(chartId, true);

    let svgTransformed = svg.append("g")
        .attr("transform", svgTranslation);

    // Y Axis Label
    svgTransformed.append("text")
        .attr("class", "y-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - (BAR_CHART_MARGIN.left / 1.05))
        .attr("x", 0 - (innerHeight / 2))
        .attr("dy", "0.5em")
        .style("text-anchor", "middle")
        .text(yAxisLabel);

    // X Axis Label
    const xAxisLabelTranslation = "translate(" + (innerWidth / 2) + " ," + (innerHeight + BAR_CHART_MARGIN.bottom) + ")";

    svgTransformed.append("text")
        .attr("class", "x-label")
        .attr("transform", xAxisLabelTranslation)
        .style("text-anchor", "middle")
        .text(xAxisLabel);

    // X Axis
    svgTransformed.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "middle");

    // Y Axis
    svgTransformed.append("g")
        .attr("class", "y-axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "1em")
        .style("text-anchor", "end");

    let bars = svgTransformed.selectAll("bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function(row) { return xScale(row.ruleNo); })
        .attr("width", xScale.rangeBand())
        .attr("y", function(row) { return yScale(row.value); })
        .attr("height", function(row) { return innerHeight - yScale(row.value); });

    return {
        'id': chartId,
        'svg': svg,
        'xScale': xScale,
        'yScale': yScale,
        'xAxis': xAxis,
        'yAxis': yAxis,
        'xAxisLabel': xAxisLabel,
        'yAxisLabel': yAxisLabel,
        'bars': bars,
        'outterWidth': outterWidth,
        'outterHeight': outterHeight,
        'innerWidth': innerWidth,
        'innerHeight': innerHeight,
    };
}

function createTable(data, columns, title, className) {
    let div = d3.select('.psl-viz').append('div');
    div.classed('viz-module', true);
    div.classed(className, true);

    let titleDiv = div.append('div');
    titleDiv.attr('class', 'title');
    titleDiv.text(title);

    let tableDiv = div.append('div');
    tableDiv.classed('table-container', true);

    let table = tableDiv.append('table')
        .attr("class", "tablesorter")
    table.append("thead").append("tr");

    let headers = table.select("tr").selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(function(d) { return d; });

	// create a row for each object in the data
	let rows = table.append("tbody").selectAll('tr')
        .data(data)
        .enter()
        .append('tr');

    // TODO: Right now this is how im handling two tables that require
    // different functionality on row click. Perhaps this should be changed?
    if (className == GROUND_ATOM_RULES_MODULE) {
        rows.attr('data-rule', function (row) { return row.id; });
    } else if (className == TRUTH_TABLE_MODULE || className == INDIVIDUAL_GROUND_RULE_MODULE) {
        rows.attr('data-atom', function(atom) { return atom.id; });
    }

    // create a cell in each row for each column
    let cells = rows.selectAll('td')
        .data(function (row) {
            return columns.map(function (column) {
                return {
                    column: column,
                    value: row[column],
                    id: row['id']
                };
            });
        })
        .enter()
        .append('td')
        .text(function(row) { return row.value; });

    return table;
}

function removeGroundRuleContext() {
    $('.' + NAVBAR_GROUND_RULE_CONTEXT_CHANGER).remove();
    $('.' + INDIVIDUAL_GROUND_RULE_MODULE).remove();
}

function removeGroundAtomContext() {
    $('.' + GROUND_ATOM_AGGREGATE_MODULE).remove();
    $('.' + GROUND_ATOM_RULES_MODULE).remove();
    $('.' + NAVBAR_GROUND_ATOM_CONTEXT_CHANGER).remove();
}

function createTruthTable(data) {
    let truthObjectList = [];
    for (const key in data["truthMap"]) {
        truthObjectList.push({
            "Prediction": data["groundAtoms"][key]["prediction"].toFixed(2),
            "Truth": data["truthMap"][key].toFixed(2),
            "Ground Atom": data["groundAtoms"][key]["text"],
            "Error": Math.abs(data["truthMap"][key] - data["groundAtoms"][key]["prediction"]).toFixed(2),
            "id": key,
        });
    }

    // Create table.
    const predictionTruthCols = ['Ground Atom', 'Prediction', 'Truth', 'Error'];
    createTable(truthObjectList, predictionTruthCols, TRUTH_TABLE_TITLE, TRUTH_TABLE_MODULE);

    // Set context handler for all the truth atoms.
    // Note that we use a delegate (attaching a handler to the table's body)
    // instead of directly attaching a handler to each row.
    $(`.psl-viz .${TRUTH_TABLE_MODULE} table tbody`).on('click', 'tr', function() {
        updateGroundAtomContext(data, this.dataset.atom);
    });
}

function createViolationTable(data) {
    // Find the correct data
    let rulesObject = data["rules"];
    let groundRules = data["groundRules"];

    let violationObjectList = [];
    for (const ruleID in rulesObject) {
        if (!isNaN(rulesObject[ruleID]["weighted"])) {
            continue
        }

        for (const groundRuleID in groundRules) {
            if (groundRules[groundRuleID]["ruleID"] == ruleID && groundRules[groundRuleID]["dissatisfaction"] > 0) {
                let violationObject = {
                    "Violated Constraint": createGroundRule(data, groundRuleID)["Ground Rule"],
                    "Dissatisfaction": groundRules[groundRuleID]["dissatisfaction"].toFixed(2),
                };
                violationObjectList.push(violationObject);
            }
        }
    }

    // Create table if there are violated constraints
    if (violationObjectList.length != 0) {
        const violatedGroundRulesCols = ['Violated Constraint', 'Dissatisfaction'];
        createTable(violationObjectList, violatedGroundRulesCols, VIOLATED_GROUND_RULES_TABLE_TITLE, VIOLATED_GROUND_RULES_MODULE);
    }
}

// Create a table that gives an overview for all rules
function createRuleOverviewTable(rules) {
    const overviewCols = [
        "ID",
        "Rule",
        "Weighted",
        "Count",
        "Total Dissatisfaction",
        "Mean Dissatisfaction"
    ];
    let overviewData = [];

    for (const ruleID in rules) {
        let rule = rules[ruleID];

        overviewData.push({
            "ID": rule["index"],
            "Rule": rule["cleanText"],
            "Weighted": (isNaN(rule["weighted"]) ?  "∞" : rule["weighted"]),
            "Count": rule["count"],
            "Total Dissatisfaction": rule["dissatisfaction"].toFixed(2),
            "Mean Dissatisfaction": rule["meanDissatisfaction"].toFixed(2),
        });
    }

    createTable(overviewData, overviewCols, RULE_OVERVIEW_TABLE_TITLE, RULE_OVERVIEW_MODULE);
}

function createAssociatedGroundAtomsTable(data, groundAtomID, aggregateStats) {
    let associatedGroundRules = [];
    for (const ruleID in aggregateStats) {
        aggregateStats[ruleID].groundRules.forEach(function(groundRuleID) {
            associatedGroundRules.push(createGroundRule(data, groundRuleID));
        });
    }

    let tableTitle = data["groundAtoms"][groundAtomID]["text"] + " " + ASSOCIATED_GROUND_RULES_TABLE_TITLE;
    const associatedGroundRuleCols = ["Ground Rule", "Dissatisfaction"];
    createTable(associatedGroundRules, associatedGroundRuleCols, tableTitle, GROUND_ATOM_RULES_MODULE);

    // Add tablesorter to this new table.
    $(`.viz-module.${GROUND_ATOM_RULES_MODULE} table.tablesorter`).tablesorter();

    // Set context handler for all the ground rules.
    // Note that we use a delegate (attaching a handler to the table's body)
    // instead of directly attaching a handler to each row.
    $(`.viz-module.${GROUND_ATOM_RULES_MODULE} table tbody`).on('click', 'tr', function() {
        updateGroundRuleContext(data, this.dataset.rule);
    });
}

function createIndividualGroundRuleTable(data, groundRuleKeyString) {
    // convert rule string id to int id
    const groundRuleID = parseInt(groundRuleKeyString);
    let groundAtomObject = data["groundAtoms"];
    let groundRule = data["groundRules"][groundRuleKeyString];

    let atomElementList = []
    let atomID;
    for (let i = 0; i < groundRule["lhs"].length; i++) {
        let lhsObject = groundRule["lhs"][i];
        if (Array.isArray(lhsObject)) {
            atomID = lhsObject[0];
        }
        else {
            atomID = lhsObject;
        }
        let tableElem = {
            "Ground Atom" : groundAtomObject[atomID]["text"],
            "Truth Value" : groundAtomObject[atomID]["prediction"].toFixed(2),
            "id" : atomID
        }
        atomElementList.push(tableElem);
    }

    for (let i = 0; i < groundRule["rhs"].length; i++) {
        let rhsObject = groundRule["rhs"][i];
        if (Array.isArray(rhsObject)) {
            atomID = rhsObject[0];
        }
        else {
            atomID = rhsObject;
        }
        let tableElem = {
            "Ground Atom" : groundAtomObject[atomID]["text"],
            "Truth Value" : groundAtomObject[atomID]["prediction"].toFixed(2),
            "id" : atomID
        }
        atomElementList.push(tableElem);
    }

    let tableTitle = createGroundRule(data, groundRuleID)["Ground Rule"];
    const atomCols = ["Ground Atom", "Truth Value"];
    createTable(atomElementList, atomCols, tableTitle, INDIVIDUAL_GROUND_RULE_MODULE);

    // Add tablesorter to this new table
    $(`.psl-viz .${INDIVIDUAL_GROUND_RULE_MODULE} table.tablesorter`).tablesorter();

    // Set context handler for all the ground atoms.
    // Note that we use a delegate (attaching a handler to the table's body)
    // instead of directly attaching a handler to each row.
    $(`.psl-viz .${INDIVIDUAL_GROUND_RULE_MODULE} table tbody`).on('click', 'tr', function() {
        updateGroundAtomContext(data, this.dataset.atom);
    });

    // Insert Satisfaction value.
    let text = "Rule Satisfaction: " + (1 - groundRule["dissatisfaction"]).toFixed(2);
    $(`<a>${text}</a>`).insertBefore(`.${INDIVIDUAL_GROUND_RULE_MODULE} .table-container`);
}

// Get the rule data needed for the Satisfaction module
function readAggregateRuleData(rules) {
    let ruleAggregateData = [];

    for (const ruleID in rules) {
        let rule = rules[ruleID];

        // If rule["weighted"] is not a number, there is no weight, so continue
        if (isNaN(rule["weighted"])) {
            continue;
        }

        ruleAggregateData.push({
            "ID": rule["index"],
            "Rule": rule["cleanText"],
            "Total Dissatisfaction": rule["dissatisfaction"],
            "Total Satisfaction": rule["satisfaction"],
            "Mean Dissatisfaction": rule["meanDissatisfaction"],
            "Mean Satisfaction": rule["meanSatisfaction"],
            "Count": rule["count"],
        });
    }

    return ruleAggregateData;
}

function updateGroundAtomContext(data, groundAtomKeyString) {
    removeGroundAtomContext();
    removeGroundRuleContext();

    let groundAtomID = parseInt(groundAtomKeyString);

    let aggregateStats = fetchGroundAtomSatisfaction(data, groundAtomID);
    let groundAtomAggregateData = readAggregateRuleData(aggregateStats);
    console.log(groundAtomAggregateData);

    // Update navbar with new atom context.
    let link = document.createElement('a');
    link.classList.add(NAVBAR_GROUND_ATOM_CONTEXT_CHANGER);
    link.setAttribute('href', '#');
    link.innerText = data["groundAtoms"][groundAtomID]["text"];
    link.onclick = removeGroundRuleContext;

    $('.navbar').append(`<span class='${NAVBAR_GROUND_ATOM_CONTEXT_CHANGER}'>>></span>`).append(link);

    // Create new associated ground rules table
    createAssociatedGroundAtomsTable(data, groundAtomID, aggregateStats)

    // Create Compatibility Chart with Ground Atom Context
    let barChartTitle = data["groundAtoms"][groundAtomID]["text"] + " " + RULE_AGGREGATE_CHART_TITLE;
    setupBarChartModule(groundAtomAggregateData, DEF_BAR_CHART_X_LABEL,
            DEF_AGGREGATE_Y_LABEL, AGGREGATE_RULE_STATS_Y_LABELS,
            GROUND_ATOM_AGGREGATE_MODULE, barChartTitle);
}

function updateGroundRuleContext(data, groundRuleKeyString) {
    removeGroundRuleContext();

    // Update navbar with new rule context.
    let link = document.createElement('a');
    link.classList.add(NAVBAR_GROUND_RULE_CONTEXT_CHANGER);
    link.setAttribute('href', '#');
    link.innerText = createGroundRule(data, groundRuleKeyString)["Ground Rule"];

    $('.navbar').append(`<span class='${NAVBAR_GROUND_RULE_CONTEXT_CHANGER}'>>></span>`).append(link);

    // Create new individual ground rule
    createIndividualGroundRuleTable(data, groundRuleKeyString);
}

function createMenu(options, defaultValue, moduleName, div) {
    const menuId = moduleName + "-menu";
    let select = div.append("select");
    select.classed(menuId, true);

    let menu = document.getElementsByClassName(menuId)[0];
    for (let index = 0; index < options.length; index++) {
        let menuOption = document.createElement("option");
        menuOption.text = options[index];
        menu.options.add(menuOption);
        if (options[index] == defaultValue) {
            menu.options.selectedIndex = index;
        }
    }

    return menuId;
}

function setupBarChartModule(data, xAxisLabel, yAxisLabel, menuOptions, className, title) {
    let oldModule = document.getElementsByClassName(className);
    if (oldModule.length != 0) {
        oldModule[0].remove();
    }

    let div = d3.select('.psl-viz').append("div");
    div.classed('viz-module', true);
    div.classed(className, true);

    let titleDiv = div.append('div');
    titleDiv.attr('class', 'title');
    titleDiv.text(title);

    let menuId = undefined;
    if (menuOptions != undefined) {
        menuId = createMenu(menuOptions, yAxisLabel, className, div);
    }

    let chart = createBarChart(data, div, xAxisLabel, yAxisLabel, className);
    if (menuId != undefined) {
        document.getElementsByClassName(menuId)[0].onchange = function () {
            let newVal = document.getElementsByClassName(menuId)[0].value;
            chart.yAxisLabel = newVal;
            updateBarChart(chart, data);
        };
    }
}

function cleanRuleString(ruleText) {
    RULE_STRING_REPLACEMENTS.forEach(function(replacementInfo) {
        ruleText = ruleText.replace(replacementInfo[0], replacementInfo[1]);
    });

    return ruleText;
}

function cleanGroundRuleString(ruleText) {
    GROUND_RULE_STRING_REPLACEMENTS.forEach(function(replacementInfo) {
        ruleText = ruleText.replace(replacementInfo[0], replacementInfo[1]);
    });

    return ruleText;
}

// Helper function to take the data files lhs/rhs formula objects and deconstruct them into flatten arrays.
function deconstructFormula(data, formula, operator) {
    let deconstructedFormula = [];
    for (let i = 0; i < formula.length; i++){
        let formulaObject = formula[i];
        if (Array.isArray(formulaObject)){
            if (operator == ">>" || operator == "") {
                deconstructedFormula.push("!" + data["groundAtoms"][formulaObject[0]]["text"]);
            }
            else {
                deconstructedFormula.push(formulaObject[1].toFixed(1).toString() + " * " + data["groundAtoms"][formulaObject[0]]["text"]);
            }
        }
        else {
            deconstructedFormula.push(data["groundAtoms"][formulaObject]["text"]);
        }
    }
    return deconstructedFormula;
}

// Given data and ground rule ID returns the rule in non-DNF form.
function createGroundRule(data, groundRuleID) {
    let groundRuleObject = data["groundRules"][groundRuleID];
    let parentRule = data["rules"][groundRuleObject["ruleID"]]["cleanText"];
    let operator = groundRuleObject["operator"];

    // Deconstruct the formula objects from the data file and put into a flattened array.
    let createdGroundRule = "";
    let lhsTemp = deconstructFormula(data, groundRuleObject.lhs, operator);
    let rhsTemp = deconstructFormula(data, groundRuleObject.rhs, operator);
    // Depending on the operator, join the flattened array via '&' or '+'.
    if (operator == ">>" || operator == "") {
        createdGroundRule += lhsTemp.join(" & ");
    }
    else {
        createdGroundRule += lhsTemp.join(" + ");
    }
    // Add the operator between the lhs and rhs side.
    createdGroundRule += " " + operator + " ";
    // Join the flattened array via '&' or '+', for rhs arithmetic rules, add the value after the '=' sign.
    if (operator == ">>" || operator == "") {
        createdGroundRule += rhsTemp.join(" & ");
    }
    else {
        createdGroundRule += rhsTemp.join(" + ");
        let rhsConstant = parentRule.match('= (\\d+\\.\\d+)');
        createdGroundRule += " " + rhsConstant[1];
    }

    return {
        "Ground Rule" : cleanGroundRuleString(createdGroundRule),
        "Dissatisfaction" : groundRuleObject["dissatisfaction"].toFixed(2),
        "id" : groundRuleID
    };
}

function createNavBar() {
    let link = document.createElement('a');
    link.classList.add(NAVBAR_MODEL_CONTEXT_CHANGER);
    link.setAttribute('href', '#');
    link.innerText = "Model";
    link.onclick = function() {
        removeGroundAtomContext();
        removeGroundRuleContext();
    };

    let navbar = document.createElement('div');
    navbar.classList.add('navbar');
    navbar.appendChild(link);

    document.querySelector('.psl-viz').appendChild(navbar);
}

// Sets up the visualization itself:
// Given a data file creates respective tables, charts, context handlers, etc.
function init(data) {
    indexData(data);

    // Save the data for debugging.
    window.pslviz.data = data;

    // clear psl-viz DOM element for visualization
    $('.psl-viz').empty();

    // Change footer style so that it stays at bottom of page.
    let footer = document.querySelector(".site-footer");
    footer.style["position"] = "relative";

    // Create the context navigation bar
    createNavBar();

    createTruthTable(data);
    createViolationTable(data);
    createRuleOverviewTable(data.rules);

    // Make each of our tables a tablesorter instance.
    $(`.viz-module table.tablesorter`).tablesorter();

    // Aggregate Rule Stats Module
    let aggregateStats = readAggregateRuleData(data.rules);
    console.log(aggregateStats);
    setupBarChartModule(aggregateStats, DEF_BAR_CHART_X_LABEL,
            DEF_AGGREGATE_Y_LABEL, AGGREGATE_RULE_STATS_Y_LABELS,
            RULE_AGGREGATE_MODULE, RULE_AGGREGATE_CHART_TITLE);
}

// Fetch the per-rule satisfaction data for a ground atom.
// If the information does not exist, compute it, cache it, and return it.
function fetchGroundAtomSatisfaction(data, groundAtomID) {
    var stats = data.groundAtoms[groundAtomID]['satisfactionStats'];
    if (stats) {
        return stats;
    }

    stats = computeRuleAggregates(Object.keys(data.rules), data.groundRules, function(groundRule) {
        return groundRule.lhs.flat().includes(groundAtomID) || groundRule.rhs.flat().includes(groundAtomID);
    });

    for (const ruleID in data.rules) {
        stats[ruleID]["index"] = data.rules[ruleID]['index'];
        stats[ruleID]["weighted"] = data.rules[ruleID]['weighted'];
    }

    data.groundAtoms[groundAtomID]['satisfactionStats'] = stats;

    return stats;
}

// Compute rule-level aggregate statistics on the given ground rules.
// If the filter exists and is falsy for a ground rule, don't count it.
// If the filter exists and is truthy for a ground rule,
// then (in addition to normal behavior) the ID of that ground rule will be appended to 'groundRules'.
function computeRuleAggregates(ruleIDs, groundRules, filterFunction) {
    let stats = {};

    // Ensure that every rule gets an entry (in case there are no ground rules for some rule).
    ruleIDs.forEach(function(ruleID) {
        stats[ruleID] = {
            'satisfaction': 0.0,
            'dissatisfaction': 0.0,
            'count': 0,
            'groundRules': [],
        };
    });

    for (const groundRuleID in groundRules) {
        let ruleID = groundRules[groundRuleID]['ruleID'];

        if (filterFunction) {
            if (filterFunction(groundRules[groundRuleID])) {
                stats[ruleID]['groundRules'].push(groundRuleID);
            } else {
                continue;
            }
        }

        stats[ruleID]['dissatisfaction'] += groundRules[groundRuleID]['dissatisfaction'];
        stats[ruleID]['satisfaction'] += (1.0 - groundRules[groundRuleID]['dissatisfaction']);
        stats[ruleID]['count']++;
    }

    ruleIDs.forEach(function(ruleID) {
        let meanDissatisfaction = 0.0;
        let meanSatisfaction = 0.0;

        if (stats[ruleID]['count'] != 0) {
            meanDissatisfaction = stats[ruleID]['dissatisfaction'] / stats[ruleID]['count'];
            meanSatisfaction = stats[ruleID]['satisfaction'] / stats[ruleID]['count'];
        }

        stats[ruleID]['meanDissatisfaction'] = meanDissatisfaction;
        stats[ruleID]['meanSatisfaction'] = meanSatisfaction;
    });

    return stats;
}

// Compute the rule-level aggregate statistics and attach them directly to the rule.
function indexRules(data) {
    let stats = computeRuleAggregates(Object.keys(data.rules), data.groundRules, null);

    let ruleIndex = 1;
    for (const ruleID in data.rules) {
        data.rules[ruleID]["index"] = ruleIndex;
        data.rules[ruleID]["count"] = stats[ruleID]['count'];
        data.rules[ruleID]["dissatisfaction"] = stats[ruleID]['dissatisfaction'];
        data.rules[ruleID]["satisfaction"] = stats[ruleID]['satisfaction'];
        data.rules[ruleID]["meanDissatisfaction"] = stats[ruleID]['meanDissatisfaction'];
        data.rules[ruleID]["meanSatisfaction"] = stats[ruleID]['meanSatisfaction'];

        ruleIndex++;
    }
}

// Go through the data and pre-compute whatever we can.
function indexData(data) {
    for (let ruleID in data.rules) {
        data.rules[ruleID].cleanText = cleanRuleString(data.rules[ruleID].text);
    }

    indexRules(data);

    return data;
}

// Read the file in the file selector and load up the main UI.
function handleDataFile() {
    // Activate the loading page.
    $('.psl-viz .splash').hide();
    $('.psl-viz .loading').show();

    let reader = new FileReader();
    reader.onload = function(event) {
        let compressedData = new Uint8Array(event.target.result);

        let gunZipper = new Zlib.Gunzip(compressedData);
        let decompressedData = gunZipper.decompress();

        let text = new TextDecoder("utf-8").decode(decompressedData);
        let json = JSON.parse(text);
        init(json);
    }

    reader.readAsArrayBuffer(this.files[0]);
}

$(document).ready(function() {
    // Watch the file selector for a new data file.
    let input = document.querySelector('.psl-viz .psl-data-input');
    input.addEventListener("change", handleDataFile, false);
});
