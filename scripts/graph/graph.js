var c = document.getElementById("connections"); // Graph canvas
var exec_order; // Mapping of nodes to execution order index (for getting output of specific layer)

var nodes = []; // Stores nodes, their properties and connections
var mode = "SELECT"; // Current graph view mode
var selected_node = undefined; // Node which has been selected in connecting nodes together
var properties_node = undefined; // Node currently displaying properties

var InInstrSortable, LossInstrSortable, NodesSortable; // References to drag and drop containers

// Node and Instruction types
const NODE_T = [ "FC", "CONV", "ADD", "POOL", "DROPOUT", "BIAS", "BN", "ReLU", "LOG", "TAN", "SOFTMAX" ];
const INSTR_T = ["READ", "MUL", "DIV", "ADD", "SOFTMAX"];

// Node properties
const FC_PROPERTIES = { Nodes: "number", Mean: "number", Deviation: "number" };
const BIAS_PROPERTIES = { Mean: "number", Deviation: "number" };
const IN_PROPERTIES = { Data_Location: "text", Input_Dimensions: "text", Start_Read_Position: "text", Loop_Start: "text", Loop_End: "text" };
const LOSS_PROPERTIES = { Loss_Fn: "text", Data_Location: "text", Output_Dimensions: "text", Start_Read_Position: "text", Loop_Start: "text", Loop_End: "text" };

//
// Reorder() : Reconfigures connections on canvas after reordering
//
function Reorder() {
	// Create mapping from old positions to new positions
	var newPositions = [];
	var newNodes = [];
	for (node in nodes) {
		newPositions.push($(nodes[node].elem).index() - 1);
	}

	for (node in nodes) {
		newNodes[newPositions[node]] = nodes[node];
	}

	// Replace all connections and dependents with new positions
	for (node in newNodes) {
		for (connection in newNodes[node].connections) {
			newNodes[node].connections[connection] = newPositions[newNodes[node].connections[connection]];
		}

		for (dependents in newNodes[node].dependents) {
			newNodes[node].dependents[dependents] = newPositions[newNodes[node].dependents[dependents]];
		}
	}

	// Redraw
	nodes = newNodes
	render();
}

//
// ReorderDel(POSITION OF DELETED NODE) : Reconfigures connections after node is deleted from graph
//
function ReorderDel(pos) {
	for (node in nodes) {
		for (connection in nodes[node].connections) {
			if (nodes[node].connections[connection] > pos) {
				nodes[node].connections[connection] -= 1;
			}
		}

		for (dpt in nodes[node].dependents) {
			if (nodes[node].dependents[dpt] > pos) {
				nodes[node].dependents[dpt] -= 1;
			}
		}
	}

	// Redraw
	render();
}

//
// AddNode(LAYER TYPE) : Adds layer of specified type to the graph structure and view
//
function AddNode(l_t) {
	// Remove ID #new from any other nodes to allow for targetting of new added node
	$("#new").removeAttr('id');
	switch (l_t) {
		case "IN":
			// Input node
			$("#graph").append(`<div id="new" class="node data" t="IN">INPUT</div>`);
			nodes.push({t:"IN", elem:$("#new").get(0), connections: [], dependents: []});
			break;
		case "LOSS":
			// Loss node
			$("#graph").append(`<div id="new" class="node data" t="LOSS">LOSS</div>`);
			nodes.push({t:"LOSS", elem:$("#new").get(0), connections: [], dependents: []});
			break;
		case "FC":
		case "CONV":
		case "BIAS":
			// Bias, Convolution and Fully-Connected nodes
			$("#graph").append(`<div id="new" class="node learnable sortable" t="${l_t}">${l_t}</div>`);
			$("#new").prev().insertAfter($("#new"));
			nodes.push({t:l_t, elem:$("#new").get(0), connections: [], dependents: []});
			break;
		case "LOG":
		case "ReLU":
		case "TAN":
		case "SOFTMAX":
		case "BN":
		case "POOL":
		case "DROPOUT":
			// Logistic, ReLU, TAN, Softmax, Batch Normalisation, Pooling and Dropout nodes
			$("#graph").append(`<div id="new" class="node activation sortable" t="${l_t}">${l_t}</div>`);
			$("#new").prev().insertAfter($("#new"));
			nodes.push({t:l_t, elem:$("#new").get(0), connections: [], dependents: []});
			break;
		case "ADD":
			// Addition node
			$("#graph").append(`<div id="new" class="node op sortable" t="ADD">ADD</div>`)
			$("#new").prev().insertAfter($("#new"));
			nodes.push({t:"ADD", elem:$("#new").get(0), connections: [], dependents: []});
			break;
		default:
			alert("Unknown layer type");
			break;
	}
	// Reorder nodes after node has been added
	Reorder();
}

// IMPORTANT RETURN
// Initialise Nodes
AddNode("IN");
AddNode("LOSS");

//
// render() : Renders the connections between nodes
//
function render() {
	var context = c.getContext("2d");
	context.clearRect(0, 0, c.width, c.height);
	for (node in nodes) {
		if (nodes[node].connections != undefined) {
			if (nodes[node].connections.length >= 1) {
				for (connection in nodes[node].connections) {
					var order = nodes[node].connections[connection] - parseInt(node) - 1;
					if (order > 0) {
						var ctx = c.getContext("2d");
						ctx.beginPath();
						const pos = $(nodes[node].elem).position();
						ctx.moveTo(200,pos.top + $("#graph").scrollTop() + 55);
						ctx.lineTo(260 + 10*order, pos.top + $("#graph").scrollTop() + 55);
						ctx.lineTo(260 + 10*order, $(nodes[nodes[node].connections[connection]].elem).position().top + $("#graph").scrollTop() + 55);
						ctx.lineTo(200,$(nodes[nodes[node].connections[connection]].elem).position().top + $("#graph").scrollTop() + 55);
						ctx.strokeStyle="#F69079";
						ctx.stroke();
					} else if (order == 0) {
						var ctx = c.getContext("2d");
						ctx.beginPath();
						const pos = $(nodes[node].elem).position();
						console.log(pos);
						ctx.moveTo(200,pos.top + $("#graph").scrollTop() + 55);
						ctx.lineTo(200,$(nodes[nodes[node].connections[connection]].elem).position().top + $("#graph").scrollTop() + 55);ctx.strokeStyle="#F69079";
						ctx.stroke();
					} else if (order <= 0) {
						order += 1;
						var ctx = c.getContext("2d");
						ctx.beginPath();
						const pos = $(nodes[node].elem).position();
						ctx.moveTo(200,pos.top + $("#graph").scrollTop() + 55);
						ctx.lineTo(140 + 10*order, pos.top + $("#graph").scrollTop() + 55);
						ctx.lineTo(140 + 10*order, $(nodes[nodes[node].connections[connection]].elem).position().top + $("#graph").scrollTop() + 55);
						ctx.lineTo(200,$(nodes[nodes[node].connections[connection]].elem).position().top + $("#graph").scrollTop() + 55);
						ctx.strokeStyle="#F69079";
						ctx.stroke();
					}
				}
			}
		}
	}
}

//
// SaveProperties() : Save all the properties which have been editied in the properties view
//
function SaveProperties() {
	$("#properties-list").children(".property").each(function () {
		// Update specific property
		nodes[properties_node][$(this).attr("p")] = $(this).children("input").val();
	});
}

//
// DeleteConnection() : Deletes connection between nodes
//
function DeleteConnection(obj) {
	// Remove dependent of connection
	var index = nodes[properties_node].connections[$(obj).parent().attr("c")];
	nodes[index].dependents.splice(nodes[index].dependents.indexOf(properties_node), 1);

	// Remove actual connection
	nodes[properties_node].connections.splice($(obj).parent().attr("c"), 1);

	// Remove reference in connections pane
	$(obj).parent().remove();
	if ($(".connection_property").length == 0) {
		// Display message when no connections
		$("#connections-list").append("no connections :(");
	}

	// Redraw
	render();
}

//
// InitProperties(NODE THAT WAS CLICKED, INDEX) : Initialises properties pane with corresponding properties for node
//
function InitProperties(obj, index) {
	// Set title, remove all existing properties, hide instructions and show connections
	$("#properties-view").children("h1").text($(obj).attr('t') + "_" + ($(obj).index() - 1));
	$("#properties-list").empty();
	$(".instr").hide();
	$(".instr_add").hide();
	$(".connection_title").show();

	// If INPUT or LOSS node, remove ability to delete node
	if ((nodes[index].t == "IN") || (nodes[index].t == "LOSS")) {
		$("#deletenode").hide();
	} else {
		$("#deletenode").show();
	}

	// Check which type of node is being edited
	switch ($(obj).attr('t')) {
		case "FC":
			// Fully-Connected node
			for (property in FC_PROPERTIES) {
				$("#properties-list").append(`<div class="property" p="${property}"><span>${property}</span><input n="${index}" value="${nodes[index][property] || ""}" placeholder="VAL" /></div>`);
			}
			break;
		case "LOG":
		case "ADD":
			// Logistic, Addition node
			$("#properties-list").append(`nothing to configure :(`);
			break;
		case "IN":
			// Input node
			for (property in IN_PROPERTIES) {
				$("#properties-list").append(`<div class="property" p="${property}"><span>${property}</span><input n="${index}" value="${nodes[index][property] || ""}" placeholder="VAL" /></div>`);
			}
			// Show data pipeline instruction builder interface (INPUT NODE)
			$('h2.instr').show();
			$('.instr[t="IN"]').show();
			$(".instr_add[instr-set='IN']").show();
			break;
		case "LOSS":
			// Loss node
			for (property in LOSS_PROPERTIES) {
				$("#properties-list").append(`<div class="property" p="${property}"><span>${property}</span><input n="${index}" value="${nodes[index][property] || ""}" placeholder="VAL" /></div>`);
			}
			// Show data pipeline instruction builder interface (LOSS NODE)
			$('h2.instr').show();
			$('.instr[t="OUT"]').show();
			$(".instr_add[instr-set='OUT']").show();
			break;
		default:
			break;
	}

	// Configure connections view
	var connections = nodes[$(obj).index() - 1].connections;
	$("#connections-list").empty();
	if (connections.length == 0) {
		$("#connections-list").append("no connections :(");
	} else {
		for (connection in connections) {
			$("#connections-list").append(`<div class="connection_property" c="${connection}"><span>Connection to ${nodes[connections[connection]].t}_${connections[connection]}</span><div class="connection_del">&times;</div></div>`);
		}
	}

	// Set handler to save properties when properties are edited
	$(".property").children("input").off('keyup');
	$(".property").children("input").keyup(function () {
		// Save Properties
		SaveProperties();
	});

	// Set handler for connection deletion
	$(".connection_del").off('click');
	$(".connection_del").click(function () {
		// Save Properties
		DeleteConnection(this);
	});
}

//
// EVENT: #connectnodes (CLICK)
// Toggles graph view mode between SELECT and CONNECT
//
$("#connectnodes").click(function () {
	if (mode == "SELECT") {
		// Change to CONNECT
		// IMPORTANT RETURN
		// Freeze draggable
		$(this).text("FINISHED");
		mode = "CONNECT";
	} else if (mode == "CONNECT") {
		// Change to SELECT
		$(this).text("CONNECT NODES");
		mode = "SELECT";
		selected_node = undefined;
	}
});

//
// AddNodeHandlers() : Configure behaviour of nodes in graph view
//
function AddNodeHandlers() {
	// Configure EVENT (CLICK)
	$(".node").off('click');
	$(".node").click(function () {
		if (mode == "CONNECT") {
			// Connect two nodes
			if (selected_node != undefined) {
				// Create connection between nodes
				if (($(this).index() - 1 != selected_node) && (nodes[selected_node].connections.indexOf($(this).index() - 1) <= -1) && (nodes[$(this).index() - 1].dependents.length <= 0 || nodes[$(this).index() - 1].t == "ADD")) {
					nodes[selected_node].connections.push($(this).index() - 1);
					nodes[$(this).index() - 1].dependents.push(selected_node);
					selected_node = undefined;
					// Redraw
					render();
				} else {
					// Invalid connection
					selected_node = undefined;
					alert("Connection invalid");
				}
			} else {
				// Selected node which will connect to another
				selected_node = $(this).index() - 1;
			}
		} else if (mode == "SELECT") {
			// SELECT mode
			// Initilise properties pane according to selected node
			properties_node = $(this).index() - 1;
			InitProperties(this, properties_node);

			// If training, then get the current output data and display in pane
			if (t_process_alive) {
				let exec_node = exec_order[properties_node];
				// IMPORTANT RETURN
				GetDims(exec_node);
				GetData(exec_node);
			}
		}
	});
}

//
// HideModal() : Hides the training modal
//
function HideModal() {
	$("#modal").removeClass("show");
	setTimeout(function () {
		$("#modal").hide();
	}, 200);
}

//
// AddInstruction(INSTRUCTION TYPE, ADD INSTRUCTION BUTTON)
//
function AddInstruction(t, obj) {
	// Hide get instruction type modal and get instruction list from button
	HideModal();
	$(obj).removeClass("emptylist");
	var list = $(`#instructions-list[t=${$(obj).attr("instr-set")}]`)
	switch (t) {
		case "ADD":
			// Insert ADD instruction
			$(list).append(`<div class="instruction" instr="add"><span>ADD <input placeholder="scalar"/></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div></div>`);
			break;
		case "DIV":
			// Insert DIV instruction
			$(list).append(`<div class="instruction" instr="div"><span>DIV <input placeholder="scalar"/></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div></div>`);
			break;
		case "MUL":
			// Insert MUL instruction
			$(list).append(`<div class="instruction" instr="mul"><span>MUL <input placeholder="scalar"/></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div></div>`);
			break;
		case "READ":
			// Insert READ instruction
			$(list).append(`<div class="instruction" instr="read"><span>READ <input placeholder="bytes"/> AS <input placeholder="datatype"/></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div>
			</div>`);
			break;
		case "SOFTMAX":
			// Insert SOFTMAX instruction
			$(list).append(`<div class="instruction" instr="softmax"><span>SOFTMAX TO <input placeholder="range"/></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div>
			</div>`);
			break;
		default:
			// Unknown instruction (should never reach this point)
			alert("UNKNOWN INSTRUCTION");
	}
	// Configure last instruction delete method
	$(list).children(".instruction").last().children(".instr_del").click(function () {
		var parent = $(this).parent().parent().get(0);
		$(this).parent().remove();
		if ($(parent).children(".instruction").length == 0) {
			// If no instruction add styling to add button
			$(`.instr_add[instr-set='${$(parent).attr("t")}']`).addClass("emptylist");
		}
	});
}

//
// GetInstructionType() : Displays modal prompting user to select instruction type
//
function GetInstructionType(obj) {
	// Populate the modal with instruction types
	$("#options").empty();
	for (opt in INSTR_T) {
		$("#options").append(`<div class="opt" opt="${INSTR_T[opt]}">${INSTR_T[opt]}</div>`);
	}
	// Show the modal
	$("#modal").show();
	$("#modal").addClass("show");

	// Add handler for instruction type selection
	$(".opt").off('click');
	$(".opt").click(function() {
		AddInstruction($(this).attr("opt"), obj);
	});
}

//
// GetNodeType() : Displays modal prompting user to select node type
//
function GetNodeType() {
	// Populate the modal with instruction types
	$("#options").empty();
	for (opt in NODE_T) {
		$("#options").append(`<div class="opt" opt="${NODE_T[opt]}">${NODE_T[opt]}</div>`);
	}
	// Show the modal
	$("#modal").show();
	$("#modal").addClass("show");

	// Add handler for node type to insert
	$(".opt").off('click');
	$(".opt").click(function () {
		AddNode($(this).attr("opt"), true);
		AddNodeHandlers();
		HideModal();
	});
}

//
// SetInstructionHandlers() : Configure the drag and drop interactivity for the INPUT and LOSS instruction containers
//
function SetInstructionHandlers() {
	InInstrSortable = new Sortable($(".instr[t='IN']").get(0), {
		group: "IN",
		sort: true,
		animation: 200,
		handle: ".instr_edit",
		draggable: ".instruction"
	});

	LossInstrSortable = new Sortable($(".instr[t='OUT']").get(0), {
		group: "IN",
		sort: true,
		animation: 200,
		handle: ".instr_edit",
		draggable: ".instruction",
		filter: ".instr_add"
	});
}

//
// SetNodeHandlers() : Configure the drag and drop interactivity for the graph view
//
function SetNodeHandlers() {
	NodesSortable = new Sortable($("#graph").get(0), {
		group: "NODES",
		sort: true,
		animation: 200,
		draggable: ".sortable",
		filter: ".data",
		onUpdate: function(evt) {
			Reorder();
		}
	})
}

//
// NodeSortableLock(LOCK DRAG AND DROP?) : Disables or enables drag and drop on graph view according to (LOCK DRAG AND DROP?)
//
function NodesSortableLock(locked) {
	NodesSortable.option("disabled", locked);
}

//
// ClosePropertiesPane() : Closes properties pane
//
function ClosePropertiesPane() {
	$("h1").text("Select Layer");
	$("#deletenode").hide();

	$("#properties-list").empty();
	$(".connection_title").hide();
	$("#connections-list").empty();

	$(".instr").hide();
	$(".instr_add").hide();
}

//
// CloseAllModals() : Closes all modals
//
function CloseAllModals() {
	$("#modal").hide();
	$("#training-modal").hide();
	$("#run-modal").hide();
}

//
// DeleteNode() : Deletes node from graph
//
function DeleteNode() {
	// Removes all dependents and connections
	for (dep in nodes[properties_node].dependents) {
		nodes[nodes[properties_node].dependents[dep]].connections.splice(nodes[nodes[properties_node].dependents[dep]].connections.indexOf(properties_node),1)
	}

	for (conn in nodes[properties_node].connections) {
		nodes[nodes[properties_node].connections[conn]].dependents.splice(nodes[nodes[properties_node].connections[dep]].dependents.indexOf(properties_node),1)
	}
	// Removes from nodes and graph view
	nodes.splice(properties_node, 1);
	$(".node")[properties_node].remove();

	// Closes properties pane
	ClosePropertiesPane();

	// Reorder deleted nodes
	ReorderDel(properties_node);
}

//
// SetButtonHandlers() : Sets handlers for adding instructions, adding and deleting nodes
//
function SetButtonHandlers() {
	$(".instr_add").click(function () {
		GetInstructionType(this);
	});
	$("#addnode").click(GetNodeType);
	$("#deletenode").click(DeleteNode);
}

//
// EVENT: document (READY)
// When entire app has loaded, add handlers and setup view
//
$(document).ready(function () {
	$(".cancel").click(HideModal);
	$(".instr_add").hide();

	ClosePropertiesPane();
	CloseAllModals()
	AddNodeHandlers();
	SetInstructionHandlers();
	SetNodeHandlers();
});
