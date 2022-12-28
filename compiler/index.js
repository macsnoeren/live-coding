/*********************************/
/* Compiler nodejs application   */
/*********************************/

const { spawn, exec } = require('child_process');
const io = require('socket.io')();
const fs = require('fs');
const config = require('./config');

var _interface = {};
var _status    = {};

io.on('connection', client => {
    client.on('create',  createClientEnvironment  );
    client.on('file',    eventFile                );
    client.on('compile', compile                  );
    client.on('run',     (data) => { run(client, data); } );
    client.on('stdin',   stdin                    );
    client.on('status',  status                   );
    client.on('cleanup', cleanupClientEnvironment );
    //client.on('disconnect', (reason) => { cleanupClientEnvironment(client.id) });
});

// Check if the clientId is valid, use it to validate all client ids
function validClientId (id) {
    const regex = /^[a-zA-Z][a-zA-Z0-9-_]+$/;
    return id.match(regex);
}

// Check if the filename is valid, use it always! file.txt, dir/file.txt, dir/dir/file.txt
function validFilename (filename) {
    const regex = /^[a-zA-Z][a-zA-Z0-9-_]+(\/[a-zA-Z0-9-_]+){0,2}\.[a-zA-Z]+$/;
    return filename.match(regex);
}

// Creates the directories found in the file name.
function createDirectories(clientId, filename) {
    if ( validFilename(filename) ) {
	dirs = filename.split('/');
	cur  = "clientenvironments/" + clientId + "/src";
	for ( i=0; i < dirs.length-1; i++ ) {
	    if ( !fs.existsSync(cur + "/" + dirs[i]) ) {
		fs.mkdirSync(cur + "/" + dirs[i]);
		cur = cur + "/" + dirs[i];
	    }
	}
	
    } else {
	console.log("createDirectories: Filename not correct!");
    }
}

function getAnnotations ( lines ) {
    var annon = { row: -1,
                  column: 0,
		  text: '',
		  type: ''
		};
    var annotations = [];
    var first = true;

    for ( i in lines ) {
	var m = lines[i].match(/:(\d+):*\d*: (.+):(.*)$/);
	if ( m ) {
	    if ( first ) {
		annon.row = m[1] - 1;
		annon.text = m[3];
		annon.type = m[2];
		first = false;
		
	    } else {
		annotations.push({ row: annon.row, column: annon.column, text: annon.text, type: annon.type});
		annon.row = m[1] - 1;
		annon.text = m[3];
		annon.type = m[2];	
	    }
	    
	} else {
	    annon.text = annon.text + "\n" + lines[i];
	}
    }
    
    if ( annon.row != -1 ) {
	annotations.push({ row: annon.row, column: annon.column, text: annon.text, type: annon.type});
    }

    console.log("ANNOTATIONS\n" + JSON.stringify(annotations));

    return annotations;
}


// Process the file event, it will create and store the file into the clientenvironment.
function eventFile( data ) {
    if ( "clientId" in data && validClientId(data.clientId) ) {
	if ( "filename" in data && "contents" in data && validFilename(data.filename) ) {
	    createDirectories(data.clientId, data.filename);
	    console.log("eventFile: Created file '" + data.filename + "'");
	    fs.writeFileSync("clientenvironments/" + data.clientId + "/src/" + data.filename, data.contents);

	} else {
	    console.log("eventFile: filename and/or data is not set.");
	}
	
    } else {
	console.log("eventFile: No clientId given.");
    }
}

function createClientEnvironment (data) {
    if ( "clientId" in data && validClientId(data.clientId) ) {
	io.emit("message", { clientId: data.clientId, message: "Create environment" });
	console.log("Setting up client environment for client: " + data.clientId);
	if ( !fs.existsSync("clientenvironments/" + data.clientId)) {
            fs.mkdirSync("clientenvironments/" + data.clientId);
	    fs.mkdirSync("clientenvironments/" + data.clientId + "/libs");
	    fs.mkdirSync("clientenvironments/" + data.clientId + "/tests");
	    fs.mkdirSync("clientenvironments/" + data.clientId + "/target");
	    fs.mkdirSync("clientenvironments/" + data.clientId + "/src");

	    /*
	    if ( "project" in data ) {
		eventFile({clientId: data.clientId, filename: data.project + ".java", contents: `
import static java.lang.System.*;
import java.util.Scanner;

class ` + data.project + ` {
    public static void main(String[] args) {
        System.out.println("Hello, World!"); 
        Scanner scanner = new Scanner(System.in);
        for ( int i=0; i < 2; i++ ) {
            System.out.println( scanner.nextLine() );
        }
    }
}
`});
	    }*/
	}

	if ( !(data.clientId in _status) ) {
	    _status[data.clientId] = "idle"; 
	}
	
	io.emit("message", { clientId: data.clientId, message: "Ready creating environment" });

    } else {
	console.log("createClientEnvironment: No clientId given.");
	io.emit("message", { clientId: data.clientId, message: "Error creating environment" });
    }
}

function cleanupClientEnvironment ( data ) {
    if ( "clientId" in data ) {
	console.log("Cleaning up client environment for client: " + data.clientId);
	if ( fs.existsSync("clientenvironments/" + data.clientId)) {
            fs.rmSync("clientenvironments/" + data.clientId, { recursive: true, force: true });
	    if ( data.clientId in _status ) {
		delete _status[data.clientId];
	    }
	}
    } else {
	console.log("createClientEnvironment: No clientId given.");
    }	
}

function compile ( data ) {
    if ( "clientId" in data && _status[data.clientId] == "idle" ) {
	io.emit("message", { clientId: data.clientId, message: "Starting compiler" });
	_status[data.clientId] = "compiling";
	exec('java -version', [], (error, stdout, stderr) => {
	    var version = stderr;
	    console.log("version: " + version);

	    exec('cd clientenvironments/' + data.clientId + '; find -name "*.java" > sources.txt; javac -Xlint:all -classpath libs/* -d target ' + "@sources.txt", [], (error, stdout, stderr) => {
		if (error) { // Compilation failed
		    io.emit("message", { clientId: data.clientId, message: "Compile errors" });
		    var annotations = getAnnotations(stderr.split('\n')); // TODO: Should be changed due to multiple files that are compiled.
		    console.log(annotations);
		    output = stderr;
		    console.log(output);
		    _status[data.clientId] = "idle";
		    
		} else { // Compilation success
		    io.emit("message", { clientId: data.clientId, message: "Compile success" });
		    console.log("Compilation success!");
		    _status[data.clientId] = "idle";
		}
	    });
	});	
    } else {
	console.log("compile: No clientId given.");
	io.emit("message", { clientId: data.clientId, message: "Compile call error" });
    }	
}
	
// Send stdin to a running application
function stdin ( data ) {
    if ( "clientId" in data && "stdin" in data ) {
	io.emit("message", { clientId: data.clientId, message: "Recived stdin string" });
	if ( data.clientId in _interface ) {
	    io.emit("message", { clientId: data.clientId, message: "Send stdin string" });
	    console.log("stdin: " + data.clientId + ": " + data.stdin);
	    var app = _interface[data.clientId];
	    app.stdin.write(data.stdin);
	}

    } else {
	console.log("stdin: clientId or stdin is missing.");
    }
}

function status ( data ) {
    if ( "clientId" in data ) {
	io.emit("status", { clientId: data.clientId, status: _status });
    }
}

function run ( client, data ) {
    if ( "clientId" in data && _status[data.clientId] == "idle" ) {
	var _id = data.clientId;
	io.emit("message", { clientId: _id, message: "Start to run the application" });
	_status[data.clientId] = "running";
	
	try {
	    process.chdir("clientenvironments/" + data.clientId + "/target");
	    
	} catch (err) {
	    console.log(err);
	    _status[data.clientId] = "idle";
	    return;
	}
	
	try {	    
	    var app = spawn("timeout", ["60", "/usr/bin/java", "-Xmx32m", "-Xmx32m", "MyJavaApplication"]);
	    app.stdin.setEncoding('utf-8');

	    app.on('error', (error) => {
		io.emit("message", { clientId: _id, message: "Error when running the application" });
		console.log("error");
		console.log(error);
		_status[data.clientId] = "idle";
	    });
	    
	    // TODO: Vulnerable to large inputs, iresponsive webbrowser
	    app.stdout.on('data', (data) => {
		io.emit("message", { clientId: _id, message: "Got stdout string from application" });
		var output = `${data}`;
		if ( !output.match(/\u0007|Parent pid/) ) {
		    io.to(client.id).emit("stdout", { clientId: _id, output: output });
		}
	    });
	    
	    app.stderr.on('data', (data) => {
		io.emit("message", { clientId: _id, message: "Got stderr string from application" });
		var output = `${data}`;
		io.to(client.id).emit("stderr", { clientId: _id, output: output });
	    });
	    
	    app.on('close', (code) => {
		io.emit("message", { clientId: _id, message: "Got close messahe from application" });
		console.log("close recieved");
		if ( data.clientId in _interface ) {
		    _status[data.clientId] = "idle";
		    delete _interface[data.clientId];
		}
	    });

	    _interface[data.clientId] = app;

	} catch (error) {
	    io.emit("message", { clientId: data.clientId, message: "Error during running the application" });
	    console.log('ERROR: ' + error);
	    _status[data.clientId] = "idle";
	}
	
    } else {
	io.emit("message", { clientId: data.clientId, message: "Run call error" });
	console.log("compile: No clientId given.");
    }	
}

console.log("compiler running on port " + config.port);
io.listen(config.port);
