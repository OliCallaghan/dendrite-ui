//
// Save(LOCATION) : Saves the network at the location
//
function Save(location) {
	let nodes_str = JSON.stringify(nodes);
	fs.writeFileSync(path.join(location, "network.dend"), nodes_str);
}

//
// AddInstructionFromString(INSTRUCTION STRING, PIPELINE TYPE (IN / OUT)) : Adds instruction to the instruction list
//
function AddInstructionFromString(instr, pipeline_t) {
	const ar_regex_r = /^(ADD|DIV|MUL) (-?[0-9]+.[0-9]+)$/g.exec(instr);
	const softmax_regex_r = /^SOFTMAX TO ([0-9]+)$/g.exec(instr)
	const read_regex_r = /^READ ([0-9]+) AS (UNSIGNED CHAR|CHAR|INT|UNSIGNED INT|FLOAT|BIT)$/g.exec(instr)

	let list = $(`#instructions-list[t="${pipeline_t}"]`).get(0)

	if (ar_regex_r != null) {
		// Arithmetic instruction
		$(list).append(`<div class="instruction" instr="${ar_regex_r[1].toLowerCase()}"><span>${ar_regex_r[1]} <input placeholder="scalar" value="${ar_regex_r[2]}"/></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div></div>`);
	} else if (softmax_regex_r!= null) {
		// Softmax instruction
		$(list).append(`<div class="instruction" instr="softmax"><span>SOFTMAX TO <input placeholder="range" value="${softmax_regex_r[1]}" /></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div>
		</div>`);
	} else if (read_regex_r != null) {
		// Read instruction
		$(list).append(`<div class="instruction" instr="read"><span>READ <input placeholder="bytes" value="${read_regex_r[1]}" /> AS <input placeholder="datatype" value="${read_regex_r[2]}" /></span><div class="instr_edit">&equiv;</div><div class="instr_del">&times;</div>
		</div>`);
	}
}

//
// ImportPipeline(PIPELINE TYPE (IN / OUT)) : Imports the pipeline from file and places it in the network
//
function ImportPipeline(pipeline_t) {
	fs.readFile(path.join(file_location, `${pipeline_t.toLowerCase()}put_pipeline.instr`), function (err, data) {
		if (err) throw err; // IMPORTANT RETURN
		const instr_list = data.toString().split("\n")
		$(`#instructions-list[t="${pipeline_t}"]`).empty();
		instr_list.forEach(function (instr) {
			// Add instruction to the GUI
			AddInstructionFromString(instr, pipeline_t);
		});
	})
}

//
// PopulateGraph() : Populate the graph with data from nodes (after loading data from file)
//
function PopulateGraph() {
	$(".node").remove();
	for (let node in nodes) {
		let l_t = nodes[node].t;
		$("#new").removeAttr('id');
		switch (l_t) {
			case "IN":
				$("#graph").append(`<div id="new" class="node data" t="IN">INPUT</div>`);
				break;
			case "LOSS":
				$("#graph").append(`<div id="new" class="node data" t="LOSS">LOSS</div>`);
				break;
			case "FC":
			case "CONV":
			case "BIAS":
				$("#graph").append(`<div id="new" class="node learnable sortable" t="${l_t}">${l_t}</div>`);
				break;
			case "LOG":
			case "ReLU":
			case "TAN":
			case "SOFTMAX":
			case "BN":
			case "POOL":
			case "DROPOUT":
				$("#graph").append(`<div id="new" class="node activation sortable" t="${l_t}">${l_t}</div>`);
				break;
			case "ADD":
				$("#graph").append(`<div id="new" class="node op sortable" t="ADD">ADD</div>`)
				break;
			default:
				alert("Unknown layer type");
				break;
		}
		nodes[node].elem = $("#new").get(0);
	}
	// Add node handlers
	AddNodeHandlers();
	// Redraw
	render();
}

//
// Open(LOCATION) : Open the network given the file path
//
function Open(location) {
	// Clear the graph
	$(".node").remove()

	// Return the properties view to the default
	$("h1").text("Select Layer");

	$(".instr").hide();
	$("#deletenode").hide();
	$("#modal").hide();
	$("#training_modal").hide();
	$(".connection_title").hide();
	$("#connections-list").empty();
	$("#properties-list").empty();

	$(".instr_add").hide();

	let nodes_str;
	try {
		// Load graph data
		nodes_str = fs.readFileSync(path.join(location, "network.dend"));
		nodes = JSON.parse(nodes_str);
		// Populate the graph and data IO pipelines
		PopulateGraph();
		ImportPipeline("IN");
		ImportPipeline("OUT");
	} catch (err) {
		if (err == 'ENOENT') {
			// Directory is not a network save
			return false;
		} else if (err instanceof SyntaxError) {
			// Corrupted network save
			return false;
		} else {
			// Some other error
			throw err;
		}
	}

}

//
// EVENT: #save (CLICK)
// Handles saving the network
//
$("#save").click(function () {
	if (file_location == undefined) {
		// If the network has not been saved yet
		dialog.showSaveDialog({
			title: "Select network save location",
			buttonLabel: "Save"
		}, function (path) {
			if (path != undefined) {
				file_location = path
				$("#sidebar-filename").text(file_location);
				// Save the network
				CreateNetworkFolderLocation(file_location);
				Save(file_location);
			}
		});
	} else {
		// Save the network
		Save(file_location);
	}
});

//
// EVENT: #open (CLICK)
// Handles the network being opened
//
$("#open").click(function () {
	// Get the file location
	dialog.showOpenDialog({
		title: "Select network location",
		buttonLabel: "Open",
		properties: ["openDirectory"]
	}, function (path_str) {
		if (path_str != undefined) {
			file_location = path_str[0];
			// Open the file
			$("#sidebar-filename").text(path.basename(file_location));
			Open(file_location);
		}
	});
})

//
// EVENT: #new (CLICK)
// Handles creating blank network
$("#new").click(function () {
	// Save network before losing unsaved changes
	if (file_location != undefined) {
		Save(file_location);
	}
});
