// Dependencies
var fs = require('fs');
var path = require("path")
const {dialog} = require('electron').remote
const {spawn, execFileSync} = require('child_process');

// Modal options and their values
var TRAINING_P = { ETA: undefined, ETA_DECAY: undefined, IT_DECAY: undefined, IT_TOTAL: undefined, IT_RETRN: undefined, IT_SAVE: undefined};
var RUN_P = { INPUT: undefined, CALC_ACCURACY: false };

// Execution mode
// IMPORTANT RETURN
var mode_exec = "STOP";
var training = false;

var file_location = undefined;
var t_process;
var t_process_alive = false;

var run_process;
var run_process_alive;

//
// ReturnNetworkExecutionOrder() : Returns the order which layers must be executed in
//
function ReturnNetworkExecutionOrder() {
	let order = [];

	// Queue of nodes to add, and counter to check if queue has been exhausted in case of invalid structure
	let queue = [0];
	let failed_attempts = 0;

	// Whilst there are elements in the queue and the queue has not been exhausted
	while ((queue.length != 0) && (failed_attempts < queue.length)) {
		const index = queue.shift();
		// Check if node has already been added to the execution order
		if (order.indexOf(index) <= -1) {
			let can_add = true;
			for (dpt in nodes[index].dependents) {
				if (order.indexOf(nodes[index].dependents[dpt]) <= -1) {
					// Layer cannot execute as its inputs have not been computed yet
					can_add = false
				}
			}

			if (can_add) {
				// Add the node to the execution order
				failed_attempts = 0;
				order.push(index);
				for (connection in nodes[index].connections) {
					// Add the connections of the node to the queue
					queue.push(nodes[index].connections[connection])
				}
			} else {
				// Return the node to the back of the queue
				queue.push(index);
				failed_attempts += 1;
			}
		}
	}
	return order;
}

//
// IsPropertyOf(LIST, PROPERTY, VALUE) : Returns whether the property is a property of the list; if applicable, verifies if numeric
//
function IsPropertyOf(list, property, val) {
	// Check if the list has the property
	if (list.hasOwnProperty(property) == false) {
		if (/^(connections|dependents|elem|t)$/.test(property)) {
			return true;
		} else {
			return false;
		}
	} else {
		// Verify that the property complies with whether it should be numeric
		if ((list[property] == "number") && isNaN(parseFloat(val))) {
			return false;
		}
		return true;
	}
}

//
// IsValidProperty() : Returns whether the property is valid for a particular layer type
//
function IsValidProperty(t, property, val) {
	switch (t) {
		case "FC":
			return IsPropertyOf(FC_PROPERTIES, property, val)
			break;
		case "BIAS":
			return IsPropertyOf(BIAS_PROPERTIES, property, val)
			break;
		case "IN":
			return IsPropertyOf(IN_PROPERTIES, property, val)
			break;
		case "LOSS":
			return IsPropertyOf(LOSS_PROPERTIES, property, val)
			break;
		case "CONV":
			throw "NEED TO IMPLEMENT CONV LAYER (see IsValidProperty)"
			break;
		case "LOG":
		case "ReLU":
		case "TAN":
		case "SOFTMAX":
		case "BN":
		case "POOL":
		case "DROPOUT":
		case "ADD":
			return true;
			break;
		default:
			alert("Invalid Layer Type");
	}
}

//
// GetDims(index) : Gets the output dimensions of layer at (INDEX); caveat, this index is the EXECUTION INDEX, not node index
//
function GetDims(index) {
	t_process.stdin.write(`DIMS${index}\n`);
	//alert(`DIMS${index}\n`);
}

//
// GetData(index) : Gets the output data of layer at (INDEX); this index is the EXECUTION INDEX, not node index
//
function GetData(index) {
	t_process.stdin.write(`DATA${index}\n`);
	$("#inspect-view-status-filename").text(`${nodes[index].t}_${index} `);
}

//
// Pause() : Pauses training of model
//
function Pause() {
	if (t_process_alive) t_process.stdin.write(`PAUSE\n`);
}

//
// Resume() : Resumes training of model
//
function Resume() {
	if (t_process_alive) t_process.stdin.write(`RESUME\n`);
}

//
// GetLayerPropertiesToCheck(LAYER TYPE) : Gets properties of layer type
//
function GetLayerPropertiesToCheck(type) {
	switch (type) {
		case "FC":
			return FC_PROPERTIES;
			break;
		case "BIAS":
			return BIAS_PROPERTIES;
			break;
		case "IN":
			return IN_PROPERTIES;
			break;
		case "LOSS":
			return LOSS_PROPERTIES;
			break;
		default:
			throw "Unsupported layer";
			break;
	}
}

//
// DoesNodeContainProperty(PROPERTY, NODE PROPERTY, CONSTRAINT) : Checks whether specific property has been set in the graph structure
//
function DoesNodeContainProperty(property, node_property, constraint) {
	if (node_property == undefined) {
		return false;
	} else if ((constraint == "number") && (isNaN(parseFloat(node_property)))) {
		return false;
	} else {
		return true;
	}
}

//
// verifyValidNetwork() : Computes validity of the network
//
function verifyValidNetwork(order) {
	// Check if first layer is INPUT layer
	if (nodes[order[0]].t != "IN") {
		return false;
	}

	// Check if first layer is LOSS layer
	if (nodes[order[order.length - 1]].t != "LOSS") {
		return false;
	}

	// Check if network contains any layers (excluding input and loss)
	if (order.length < 3) {
		// Network must only contain the input and loss layers
		return false;
	}

	// Verifiy hyperparameters
	for (node in nodes) {
		// IMPORTANT RETURN
		let should_fail = false;
		Object.keys(GetLayerPropertiesToCheck(nodes[node].t)).forEach(function (key) {
			const valid = DoesNodeContainProperty(key, nodes[node][key], GetLayerPropertiesToCheck(nodes[node].t)[key]);
			if (!valid) {
				should_fail = true;
			}
		});

		if (should_fail) {
			return false;
		}
	}

	// Network is valid
	return true;
}

//
// StringifyArray(ARRAY, ORDER) : Generates string of connections/dependents in array with new execution order indices, with ',' as a delimiter (and no whitespace)
//
function StringifyArray(arr, order) {
	var str = "";
	for (elem in arr) {
		str += order.indexOf(arr[elem]) + ","
	}
	return str.slice(0,-1);
}

//
// PackageAsString(INDEX, NODE, LAST_NODE, ORDER) : Packages the node as a string with ID and returns it for writing to model.struct
//
function PackageAsString(index, node, last_node, order) {
	switch (node.t) {
		case "IN":
			// INPUT layer
			return "<inp s=" + node.Input_Dimensions + ">\n";
			break;
		case "LOSS":
			// LOSS layer
			return "<loss f=" + node.Loss_Fn + ">\n<out s=" + node.Output_Dimensions + ">";
			break;
		default:
			// Any other layer type
			if (!last_node) {
				return `<lay t=${node.t} id=${index} i=${StringifyArray(node.dependents, order)} d=${StringifyArray(node.connections, order)}>\n`;
			} else {
				// Final layer must be dependent on itself
				return `<lay t=${node.t} id=${index} i=${StringifyArray(node.dependents, order)} d=${index}>\n`;
			}
	}
}

//
// CreateNetworkFolderLocation(DIRECTORY) : Generates folders for the network save
//
function CreateNetworkFolderLocation(dir) {
	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
		fs.mkdirSync(path.join(dir, "hparams"))
		fs.mkdirSync(path.join(dir, "lparams"))
	}
}

//
// WriteModelStruct(ARRAY OF NODE STRINGS, LOCATION) : Generates model.struct from given array of node strings
//
function WriteModelStruct(model_arr, location) {
	if (fs.existsSync(path.join(location, "model.struct"))) {
		// If model.struct exists, delete
		fs.unlinkSync(path.join(location, "model.struct"));
	}
	// Write to new model.struct file
	for (line in model_arr) {
		fs.appendFileSync(path.join(location, "model.struct"), model_arr[line]);
	}
}

//
// WritePipeline(LOCATION, INPUT OR OUTPUT PIPELINE) : Writes the corresponding I/O instruction pipeline for loading data
//
function WritePipeline(location, pipeline) {
	// Get pipeline file location
	const loc_instr = path.join(location, `${pipeline.toLowerCase()}put_pipeline.instr`);
	if (fs.existsSync(loc_instr)) {
		// If pipeline exists, delete
		fs.unlinkSync(loc_instr);
	}

	if (pipeline == "IN") {
		fs.writeFileSync(loc_instr, nodes[0].Data_Location + "\n");
		fs.appendFileSync(loc_instr, `JUMP ${nodes[0].Start_Read_Position}\n`);
		fs.appendFileSync(loc_instr, `LOOP FROM ${nodes[0].Loop_Start} TO ${nodes[0].Loop_End}\n`)
	} else if (pipeline == "OUT") {
		fs.writeFileSync(loc_instr, nodes[nodes.length - 1].Data_Location + "\n");
		fs.appendFileSync(loc_instr, `JUMP ${nodes[nodes.length - 1].Start_Read_Position}\n`);
		fs.appendFileSync(loc_instr, `LOOP FROM ${nodes[nodes.length - 1].Loop_Start} TO ${nodes[nodes.length - 1].Loop_End}\n`)
	} else {
		alert("UNKNOWN DATA PIPELINE " + pipeline);
		return false;
	}

	// Cycle through each instruction in the corresponding pipeline
	$(`#instructions-list[t='${pipeline.toUpperCase()}']`).children(".instruction").children("span").each(function () {
		// Clone the instruction
		var clone = $(this).clone();

		// Append the value in the textbox after the textbox
		$(this).children("input").each(function () {
			$(this).after($(this).val());
		});

		// Write the text in the instruction to the pipeline
		fs.appendFileSync(loc_instr, $(this).text() + "\n")

		// Replace the instruction with the original cloned instruction
		$(this).replaceWith(clone);
	});

	// Add REPEAT instruction at the end
	fs.appendFileSync(loc_instr, "REPEAT\n");
}

//
// CreateHyperparameters(EXECUTION ORDER, LOCATION) : For each node in the graph, create its hyperparameters
//
function CreateHyperparameters(order, loc) {
	for (node in order) {
		let exec_str = undefined;
		switch (nodes[order[node]].t) {
			case "FC":
				exec_str = `FC ${node} nodes=${nodes[order[node]].Nodes} mean=${nodes[order[node]].Mean} stddev=${nodes[order[node]].Deviation}`
				break;
			case "BIAS":
				exec_str = `B ${node} mean=${nodes[order[node]].Mean} stddev=${nodes[order[node]].Deviation}`
				break;
			default:
				console.log("No hyperparameters to be generated");
		}

		if (exec_str != undefined) {
			// Call dendrite to write its hyperparameters to file
			execFileSync(path.join(__dirname, "executables", "dendrite"), ["hp_gen", file_location + "/", exec_str]);
		}
	}
}

//
// packageToNetworkSave() : Verifies if network is valid then saves it and prompts user for training parameters
//
function packageToNetworkSave() {
	// Get execution order
	let order = ReturnNetworkExecutionOrder();
	exec_order = order;
	// Verify network
	if (!verifyValidNetwork(order)) {
		// Network is invalid
		return false;
	}

	// Get data to write to model.struct
	let model_arr = [];
	for (node in order) {
		model_arr.push(PackageAsString(node, nodes[order[node]], order.length - 2 == node, order));
	}
	WriteModelStruct(model_arr, file_location);

	// Write input_pipeline.instr
	WritePipeline(file_location, "IN");
	// Write output_pipeline.instr
	WritePipeline(file_location, "OUT");
	// Generate hyperparameters
	CreateHyperparameters(order, file_location);
	// Get training parameters
	GetTrainingParams()
}

//
// CheckIfTrainingParamsValid() : Verifies whether all training parameters have been specified
//
function CheckIfTrainingParamsValid() {
	let valid = true;
	Object.keys(TRAINING_P).forEach(function (p) {
		if ((TRAINING_P[p] == undefined) || (TRAINING_P[p] == "") || isNaN(parseFloat(TRAINING_P[p]))) {
			valid = false;
		}
	});
	return valid;
}

//
// HideTrainingModal() : Hides training parameters modal
//
function HideTrainingModal() {
	$("#training-modal").removeClass("show");
	setTimeout(function () {
		$("#training-modal").hide();
	}, 200);
}

//
// InitLayerDataViewData(LAYER OUTPUT DATA STRING) : Sets and styles the layer output in the layer inspect pane
//
function InitLayerDataViewData(data) {
	var arr = data.trim().split(" ")
	arr = arr.map((x) => {
		let color;
		if (x < -0.5) {
			color = "#F25A38";
		} else {
			color = "#F2EAE4";
		}
		return `<div class="laydata" style="background:rgba(242,90,56,${1/(1+Math.exp(-parseFloat(x) * 3))});color:${color};">${Math.round(parseFloat(x) * 100) / 100}</div>`;
	});

	$("#inspect-view").html(arr.join(''));
}

//
// Train() : Trains the network
//
function Train() {
	// Hide training modal
	HideTrainingModal();

	// Sets execution mode and app variables
	mode_exec = "TRAIN";
	training = true;
	t_process_alive = true;

	// Disable node sorting while training
	NodesSortableLock(true);

	// Start training
	t_process = spawn(path.join(__dirname, "executables", "dendrite"), ["train", file_location + "/", TRAINING_P.ETA, TRAINING_P.ETA_DECAY, TRAINING_P.IT_DECAY, TRAINING_P.IT_TOTAL, TRAINING_P.IT_RETRN, TRAINING_P.IT_SAVE]);

	t_process.unref();

	// Possible outputs from DENDRITE training
	const LOSS_RGX = /ITERATION ([0-9]+): ([0-9]+.[0-9]+)/g
	const DATA_RGX = /DATA: \[([0-9.-\s]+)\]/g
	const DIMS_RGX = /DIMS: (\[[0-9.-\s]+\])/g

	// Clear the loss graph
	ClearLoss();

	// DENDRITE output handler
	t_process.stdout.on('data', (data) => {
		// Incase data is buffered and joined together
		let data_str = data.toString().split("\n");
		data_str.forEach((str) => {
			// Determine message type
			let loss = LOSS_RGX.exec(str);
			let data = DATA_RGX.exec(str);
			let dims = DIMS_RGX.exec(str);
			console.log(str);
			if (loss != null) {
				// Graph the loss
				AddLossValuePoint(parseFloat(loss[2]), parseInt(loss[1]));
			} else if (data != null) {
				// Write the layer output to the layer inspect pane
				InitLayerDataViewData(data[1]);
			} else if (dims != null) {
				$("#inspect-view-status-dims").text(dims[1]);
				GetData(get_data_from_node);
			}
		})
	})

	// DENDRITE error handler
	t_process.stderr.on('data', (data) => {
		// Return error message to user
		alert(data.toString());
	})

	// DENDRITE training ends handler
	t_process.on('close', function (code) {
		// Returns app to original state before training
		t_process_alive = false;
		mode_exec = "STOP";
		training = false;
		$("#train").text("TRAIN");
		t_process.removeAllListeners('close');
		NodesSortableLock(false);
	});
}

//
// GetTrainingParams() : Opens modal view and adds handlers to save training parameters
//
function GetTrainingParams() {
	// Populate modal
	$("#training-options").empty();
	Object.keys(TRAINING_P).forEach(function (p) {
		$("#training-options").append(`<div class="training-opt" p="${p}">${p}:<input p="${p}" value="${TRAINING_P[p] || ''}" placeholder="${p}"></div>`);
	});

	// Removes any existing handlers for inputs
	$(".training-opt").children("input").off("focus");
	$(".training-opt").children("input").off("blur");

	// Add event handlers for input interaction
	$(".training-opt").children("input").focus(function () {
		$(this).parent().addClass("focused");
	});

	$(".training-opt").children("input").blur(function () {
		$(this).parent().removeClass("focused");
	});

	// Show modal
	$("#training-modal").show();
	$("#training-modal").addClass("show");

	// Add event handlers to save training parameters as they are entered
	$(".training-opt").children("input").off('keyup');
	$(".training-opt").children("input").keyup(function() {
		TRAINING_P[$(this).attr("p")] = $(this).val();
		if (CheckIfTrainingParamsValid()) {
			$('.training-confirm').addClass("enabled");
		} else {
			$('.training-confirm').removeClass("enabled");
		}
	});

	// Add handler for training button
	$(".training-confirm").off('click');
	$(".training-confirm").click(function () {
		if ($(this).hasClass("enabled")) {
			Train();
		}
	});

	// Add handler for cancel button
	$(".training-cancel").off('click');
	$(".training-cancel").click(function () {
		$("#train").text("TRAIN");
		HideTrainingModal();
	});
}

//
// EVENT: #train (CLICK)
// Prompts user to save the network before displaying training modal in preparation for training
$("#train").click(function () {
	// Re-assign button text
	$(this).text(mode_exec);
	if (training == false) {
		// Training is not in process
		if (file_location == undefined) {
			// Prompt user to save their network
			dialog.showSaveDialog({
				title: "Select network save location",
				buttonLabel: "Save"
			}, function (path) {
				if (path != undefined) {
					file_location = path
					// Save network
					CreateNetworkFolderLocation(file_location);
					if (!packageToNetworkSave()) {
						alert("Invalid graph to train");
					}
				}
			});
		} else {
			// Save network
			packageToNetworkSave();
		}
	} else {
		// Stop training
		t_process.kill();
	}
});

//
// GetDimsSize(DIMS) : Verifies if dimensions are valid, then calculates the total size of the dimensions (DIM1 * DIM2 * DIM3 * DIM4)
//
function GetDimsSize(dims) {
	// Verify dimensions
	let dims_arr = dims.split(",");
	if ((dims_arr).length != 4) {
		return false;
	}
	let accum = 1;
	for (dim in dims_arr) {
		let dim_n = parseInt(dims_arr[dim]);
		if (dim_n == NaN) {
			return false;
		} else if (dim_n <= 0) {
			return false;
		}
		// Compute size
		accum = accum * dim_n;
	}
	return accum;
}

//
// EVENT: #run (CLICK)
// Handles accuracy testing dialog which is shown to the user
//
$("#run").click(function () {
	$("#run-modal").show();
	$("#run-modal").addClass("show");
	$("#threshold-inp").show();
	$("#iterations-inp").show();
	$("#accuracy").hide();
	$(".run-cancel").text("Cancel");
});

//
// CheckNetworkSaveExists() : Verify the network save exists already
//
function CheckNetworkSaveExists() {
	if (file_location == undefined) return false;
	if (!fs.existsSync(path.join(file_location, 'model.struct'))) {
		return false;
	} else if (!fs.existsSync(path.join(file_location, 'hparams/'))) {
		return false;
	} else if (!fs.existsSync(path.join(file_location, 'lparams/'))) {
		return false;
	}
	return true;
}

//
// EVENT: .run-cancel (CLICK)
// Hides the accuracy testing dialog from display
//
$(".run-cancel").click(function() {
	$("#run-modal").removeClass("show");
	setTimeout(function () {
		$("#run-modal").hide();
	}, 200);
});

//
// RunAccuracy() : Tests accuracy of the network given a threshold and number of iterations
//
function RunAccuracy() {
	if (t_process_alive) {
		// Check if training
		alert("Stop training first");
	} else {
		// Extract iterations and threshold from modal
		let threshold = $("#threshold-inp").val();
		let iterations = $("#iterations-inp").val();

		// If invalid use default values
		if ((isNaN(parseFloat(threshold))) || !isFinite(parseFloat(threshold))) {
			threshold = 0.1;
		}

		if ((isNaN(parseFloat(iterations))) || !isFinite(parseFloat(iterations))) {
			iterations = 1000;
		}

		// Specify that the accuracy testing process is running
		run_process_alive = true;
		// Start the accuracy testing process
		run_process = spawn(path.join(__dirname, "executables", "dendrite"), ["run", file_location + "/", parseInt(iterations), parseFloat(threshold)]);

		// Change the accuracy display
		$("#threshold-inp").hide();
		$("#iterations-inp").hide();
		$("#accuracy").show();

		// ACCURACY TESTING output
		run_process.stdout.on('data', (data) => {
			$("#accuracy").text(data.toString());
		})

		// ACCURACY TESTING error
		run_process.stderr.on('data', (data) => {
			// Log the error to the user
			alert(data.toString());
		})

		// ACCURACY TESTING finishes
		run_process.on('exit', (code, signal) => {
			// Return app state to before accuracy testing
			run_process_alive = false;
			$(".run-cancel").text("Back");
		})
	}
}

//
// EVENT: .run-confirm (CLICK)
// Handles running the accuracy of the network
//
$(".run-confirm").click(function() {
	if (CheckNetworkSaveExists()) {
		// Run accuracy testing
		RunAccuracy();
	} else {
		alert("Train network first");
	}
});
