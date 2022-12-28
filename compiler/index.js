/*********************************/
/* Compiler nodejs application   */
/*********************************/

const { spawn, exec } = require('child_process');
const io = require('socket.io')();
const fs = require('fs');

var _interface = {};

io.on('connection', client => {
    client.on('create',  createClientEnvironment  );
    client.on('file',    eventFile                );
    client.on('compile', compile                  );
    client.on('run',     (data) => { run(client.id, data); } );
    client.on('stdin',   stdin                    );
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
	
    } else {
	console.log("createClientEnvironment: No clientId given.");
    }
}

function cleanupClientEnvironment ( data ) {
    if ( "clientId" in data ) {
	console.log("Cleaning up client environment for client: " + data.clientId);
	if ( fs.existsSync("clientenvironments/" + data.clientId)) {
            fs.rmSync("clientenvironments/" + data.clientId, { recursive: true, force: true });
	}
    } else {
	console.log("createClientEnvironment: No clientId given.");
    }	
}

function compile ( data ) {
    if ( "clientId" in data ) {
	exec('java -version', [], (error, stdout, stderr) => {
	    var version = stderr;
	    console.log("version: " + version);

	    exec('cd clientenvironments/' + data.clientId + '; find -name "*.java" > sources.txt; javac -Xlint:all -classpath libs/* -d target ' + "@sources.txt", [], (error, stdout, stderr) => {
		if (error) { // Compilation failed
		    var annotations = getAnnotations(stderr.split('\n')); // TODO: Should be changed due to multiple files that are compiled.
		    console.log(annotations);
		    output = stderr;
		    console.log(output);
		    
		} else { // Compilation success
		    console.log("Compilation success!");
		}
	    });
	});	
    } else {
	console.log("compile: No clientId given.");
    }	
}
	
function runOld ( data ) {
    if ( "clientId" in data ) {
	console.log("start");
	exec('cd clientenvironments/' + data.clientId + "/target; java " + "MyJavaApplication", [], (error, stdout, stderr) => {
	    console.log(stdout);
	    //console.log(stderr);
	    if (error) { // Compilation failed
		output = stderr;
		console.log(output);
		
	    } else { // Compilation success
		console.log(stdout);
		console.log(stderr);
	    }
	});
    } else {
	console.log("compile: No clientId given.");
    }	
}

// Send stdin to a running application
function stdin ( data ) {
    if ( "clientId" in data && "stdin" in data ) {
	if ( data.clientId in _interface ) {
	    console.log("stdin: " + data.clientId + ": " + data.stdin);
	    var app = _interface[data.clientId];
	    app.stdin.write(data.stdin);
	}

    } else {
	console.log("stdin: clientId or stdin is missing.");
    }
}

function run ( clientId, data ) {
    if ( "clientId" in data ) {
	console.log("start");
	console.log(data.clientId);
	try {
	    process.chdir("clientenvironments/" + data.clientId + "/target");
	    
	} catch (err) {
	    console.log(err);
	}
	
	try {	    
	    var app = spawn("timeout", ["60", "/usr/bin/java", "-Xmx32m", "-Xmx32m", "MyJavaApplication"]);
	    app.stdin.setEncoding('utf-8');

	    app.on('error', (error) => {
		console.log("error");
		console.log(error);
	    });

	    var _id = data.clientId;
	    
	    // TODO: Vulnerable to large inputs, iresponsive webbrowser
	    app.stdout.on('data', (data) => {
		var output = `${data}`;
		if ( !output.match(/\u0007|Parent pid/) ) {
		    io.to(clientId).emit("stdout", { clientId: _id, output: output });
		}
	    });
	    
	    app.stderr.on('data', (data) => {
		var output = `${data}`;
		io.to(clientId).emit("stderr", { clientId: _id, output: output });
	    });
	    
	    app.on('close', (code) => {
		console.log("close recieved");
		if ( data.clientId in _interface ) {
		    delete _interface[data.clientId];
		}
	    });

	    _interface[data.clientId] = app;

	} catch (error) {
	    console.log('ERROR: ' + error);
	}
	
    } else {
	console.log("compile: No clientId given.");
    }	
}

console.log("compiler running on port 3000");
io.listen(3001);
