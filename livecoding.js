/******************************************************
 * JMNL Innovation (c) 2018, 2019, 2020
 *
 * Version: 0.1 - beta release
 * Date   : 17-08-2018
 * Author : Maurice Snoeren
 * Email  : learn2code@jmnl.nl
 ******************************************************/

// Note: Make stats about people misusing the infrastructure by loading 100% of processes. After x times, they will be kicked out.

var io    = null;
var ioL2C = null;
var cfg   = require('./conf/config.json');
var sha1  = require('sha1');
var fs    = require('fs');
var utf8  = require('utf8');

const { spawn, exec } = require('child_process');
var kill              = require('tree-kill');

var nameSpace = '/learn2code'; // Default namespace

module.exports = {
  startLearn2Code: function ( socketIO, ns ) {
    io = socketIO;
    nameSpace = ns;
    initialization();
  }
}

function initialization ( ) {
  ioL2C = io.of(nameSpace); 
  ioL2C.on('connection', function(socket) {
      console.log('a user connected');	     
      userConnected(socket);
      socket.on('disconnect', function(){
	  userDisconnected(socket);
      });
      initWebSocket(socket);
  });

  console.log('Learn2Code Websocket is running!');
}


/* Websocket server */

/*
Documentation short:

Server websocket is listening to the following events:
V teacher-login: elevate the connected user to a teacher and create to a workspace
V student-login: elevate the connected user to a student and connect to a workspace
? workspace-update: update the workspace data of the workspaces and users
- workspace-get: get the workspace info from a student in the workspace, from compile
- workspace-push: push info to the students (and teacher?) in the workspace
- workspace-challenge: set the workspace challenge, used to validate the code and result
V compile: compile request from a connected user, also updates the workspace data
V execute: execut request from a connected user
V console: console request from a connected user
V console-input: input that should be sent to the active console

Server websocket is sending to the connected users the following events:
V student-update: teacher receives the result of a student
V student-add
V student-del
V teacher-left
V teacher-back
V workspace-update: everyone receives a list of the students when added and removed
V login: result of the login
V compiler-result: compiler result and execution result
V compiler-execution: Execution result of the compiler
V console-output: the output from the console is sent over

*/

/* Initialization of the events of the web socket.io. */
function initWebSocket (socket) {
  socket.on('teacher-login', function(msg) {
    teacherLogin(socket, msg);
  });

  socket.on('student-login', function(msg) {
    studentLogin(socket, msg);
  });

  socket.on('workspace-update', function(msg) {
    workspaceUpdate(socket, msg);
  });

  socket.on('workspace-get', function(msg) {
    workspaceGet(socket, msg);
  });

  socket.on('workspace-push', function(msg) {
    workspacePush(socket, msg);
  });

  socket.on('workspace-challenge', function(msg) {
    workspaceChallenge(socket, msg);
  });  

  socket.on('compile', function(msg) {
    compileRequest(socket, msg);
  });

  socket.on('execute', function(msg) {
    executeRequest(socket, msg);
  });

  socket.on('console', function(msg) {
    consoleRequest(socket, msg);
  });

  socket.on('console-input', function(msg) {
    consoleInput(socket, msg);
  });

}

/* Helper functions */

/* Determines whether the provided data exists. */
function dataExists (data) {
  return ( typeof data !== 'undefined' && data );
}

/* For debugging an easy function to display the content of
 * a variabele. */
function debugVar (data) {
  console.log('DEBUG:' + JSON.stringify(data) );
}

/* Logic concerning Live Coding Platform */

/*! Contains all the workspace information. 
 *  A _open workspace is create where everyone is able to connect to */
var workspaces = {_open: {
    timestampWorkspace: Date.now(),
    name: "_open",
    teacherSocket: null,
    challenge: "",
    students: []
  }};


/* Function creates the user data structure and add it to the socket.
   User is not yet logged in. */
function userConnected (socket) {
  console.log('user-connected');
  socket.lcdata = {
    timestampConnected: Date.now(),
    timestampLoggedIn: 0,

    id        : "",
    token     : sha1( Date.now() + socket.id ),
    username  : "",
    role      : "",

    workspace : {}, // Object filled with workspace information
      
    editor    : {
      code        : "",
      compiler    : "",
      success     : false,
      annotations : "",
      result      : "",
    },

    request: {
      busy: false,
      status: "No request pending",
      timestampRequest: 0,
      app: null
    },

    debug     : [],
  };

}

/* Function is called when a user has disconnected from the
 * web socket.io server. */
function userDisconnected (socket) {
  console.log('user-disconnected');

  if ( socket.lcdata.request.app != null ) {
    console.log('Killing application while user is disconnecting.');
    kill(socket.lcdata.request.app.pid);
  }

  if ( socket.lcdata.role == "teacher" ) {
    console.log('teacher is gone!');
    socket.lcdata.workspace.teacherSocket = null;
    
    io.of(nameSpace).to(socket.lcdata.workspace.name).emit('teacher-left', { timestamp: Date.now() });

    // Remove the workspace when nobody is in!
    if ( socket.lcdata.workspace.teacherSocket == null &&
	 socket.lcdata.workspace.students.length == 0 ) {
      workspaceDel(socket.lcdata.workspace.name);
    }

  } else if ( socket.lcdata.role == "student" ) {
    removeStudentFromWorkspace(socket.lcdata.workspace, socket);

    // Remove the workspace when nobody is in!
    if ( socket.lcdata.workspace.teacherSocket == null &&
	 socket.lcdata.workspace.students.length == 0 ) {
      workspaceDel(socket.lcdata.workspace.name);
    }

  } else {
  }
}

/* Function handles the teacher-login event from the websocket request. */
function teacherLogin (socket, data) {
    console.log('login-teacher: ' + JSON.stringify(data) );
    
    // FEATURE: Add this with a password, so teachers must sign up first (or with a token)
    if ( dataExists(data.username) && dataExists(data.workspace) &&
	 data.username != "" && data.workspace != "" ) {
	
	if ( socket.lcdata.username == "" ) {
	    socket.lcdata.username  = data.username;
	    var workspace = createWorkspace(socket, data.workspace);
	    
	    if ( workspace != null ) {
		socket.lcdata.id = sha1( socket.lcdata.token + data.username );
		socket.lcdata.timestampLoggedIn = Date.now();
		socket.lcdata.workspace = workspace;
		socket.lcdata.role = "teacher";
		socket.join(workspace.name); // Create a room for the workspace
		socket.emit("login", { 
	            result: true,
		    token: socket.lcdata.token,
		    id: socket.lcdata.id,
		    role: socket.lcdata.role,
		    workspace: {
			name: socket.lcdata.workspace.name,
			challenge: socket.lcdata.workspace.challenge,
			teacher: socket.lcdata.username, 
			students: socket.lcdata.workspace.students
		    },
		    message: "Successfully created workspace and logged in."
		});	
		
	    } else {
		socket.lcdata.username  = "";
		socket.emit("login", { 
	            result: false,
		    message: "Workspace already taken, please create another."
		});
	    }
	    
	} else {
	    socket.emit("login", { 
		result: false,
		message: "Already logged into the system, please logout first!"
	    });
	}
    } else {  
	socket.emit("login", { 
	    result: false,
	    message: "Please give a username and workspace to login."
	});
    }
}

/* Function handles the student-login event from the web socket.io. */
function studentLogin (socket, data) {
    console.log('login-student: ' + JSON.stringify(data));
    
    if ( dataExists(data.username) && dataExists(data.workspace) &&
	 data.username != "" && data.workspace != "" ) {
	if ( socket.lcdata.username == "" ) {
	    socket.lcdata.username  = data.username;
	    
	    var workspace = getWorkspace(data.workspace);
	    if ( workspace != null ) {
		socket.lcdata.id = sha1( socket.lcdata.token + data.username );
		socket.lcdata.timestampLoggedIn = Date.now();
		socket.lcdata.workspace = workspace;
		socket.lcdata.role = "student";
		socket.join(workspace.name); // Join a room with the same name as the workspace
		var teacher = ( workspace.teacherSocket == null ? "Afwezig" : workspace.teacherSocket.lcdata.username );
		socket.emit("login", { 
	            result: true,
		    token: socket.lcdata.token,
		    id: socket.lcdata.id,
		    role: socket.lcdata.role,
		    workspace: {
		        name: socket.lcdata.workspace.name,
			challenge: socket.lcdata.workspace.challenge,
			teacher: teacher, 
			students: socket.lcdata.workspace.students
		    },
		    message: "Successfully connected to workspace and logged in."
		});
		addStudent2Workspace(workspace, socket);
		
	    } else {
		socket.lcdata.username  = "";
		socket.emit("login", { 
	            result: false,
		    message: "Workspace does not exists."
		});
	    }
	    
	} else {
	    socket.emit("login", { 
	        result: false,
		message: "Already logged into the system, please logout first!"
	    });
	}
    } else {  
	socket.emit("login", { 
	    result: false,
	    message: "Please give a username and workspace to login."
	});
    }
}

function studentInWorkspace (workspace, id) {
    var students = workspace.students;
    
    for ( var i=0; i < students.length; i++ ) {
	if ( students[i].id == id ) {
	    return true;
	}
    }
    
    return false;
}

function addStudent2Workspace (workspace, socket) {
    var id = socket.lcdata.id;
    
    console.log("Add student to the workspace (" + id + ")");
    
    if ( !studentInWorkspace(workspace, id) ) {
	var student = {
	    id: id,
	    name: socket.lcdata.username,
	    success: socket.lcdata.editor.success
	};
	
	workspace.students.push(student);
	
	if ( workspace.teacherSocket != null ) {
	    workspace.teacherSocket.emit('student-add', student);
	}
	
    } else {
	console.log("addStudent2Workspace: Already added to the workspace!");
    }
}

function removeStudentFromWorkspace (workspace, socket) {
    var id = socket.lcdata.id;
    var students = workspace.students;
    
    console.log("Remove student from the workspace (" + id + ")");
    
    for ( var i=0; i < students.length; i++ ) {
	if ( students[i].id == id ) {
	    var student = students[i];
	    
	    students.splice(i, 1); // Remove the student
	    
	    printWorkspaces();
	    
	    if ( workspace.teacherSocket != null ) {
		workspace.teacherSocket.emit('student-del', student);
	    }
	    
	    return true;
	}
    }
    
    return false;
}


/* Function is called when a workspace-update event has occurred. */
function workspaceUpdate(socket, msg) {
    console.log('workspace-update: ' + JSON.stringify(msg) );
}

function workspaceDel (name) {
  if ( name != "_open" && isWorkspace(name) ) {
    delete workspaces[name];
    return true;
  }

  return false;
}

function workspacePush (socket, data) {
  if ( socket.lcdata.role != 'teacher' ) {
    console.log("workspacePush is only for the teacher.");
    return;
  }

  socket.to(socket.lcdata.workspace.name).emit('teacher-push', data);
}

/* The user has requested a compile request. */
function compileRequest (socket, data) { // Only JAVA yet!
  console.log('compile: ' + JSON.stringify(data) );

  if ( data.compiler == "java" || data.compiler == "java-8" ) {
    compileJava(socket, data, false, false);

  } else if ( data.compiler == "cpp" ) {
    compileCpp(socket, data, false, false);

  } else if ( data.compiler == "c" ) {
    compileC(socket, data, false, false);

  } else if ( data.compiler == "python" ) {
    compilePython(socket, data, false, false);

  } else if ( data.compiler == "perl" ) {
    compilePerl(socket, data, false, false);

  } else {
    socket.emit('compiler-result', { status: false, output: "Compiler not available." } );
  }
}

/* Function compiler JAVA code, executes and creates an activeconsole to the
 * application. All with the use of a jail. */
function compileJava (socket, data, execution, activeconsole) {
  var request = socket.lcdata.request; // Get the request
  var editor  = socket.lcdata.editor;  // Get the editor data

  editor.code        = data.code; // Update the workspace information of this user
  editor.compiler    = data.compiler;
  editor.success     = false;
  editor.annotations = [];
  editor.result      = "";

  if ( request.busy ) { // User already requested a request, so cannot do anything!
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
    return;
  }

  request.busy = true; // Update status and send status
  request.status = "Preparation for compilation.";
  request.timestampRequest = Date.now();
  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

  var m = data.code.match(/public class ([^{]+) {/i);
  if ( m != null && m.length > 1 ) {

    var javaMainFunction = m[1];
    var javaFile         = javaMainFunction + '.java';
    var tempDir          = socket.lcdata.id;

    console.log('Start in directory ' + process.cwd());
    console.log('Creating and compiler file: ' + javaFile);
    var dirCurrent = process.cwd();
    try {
      console.log('Go to compiler dir: ' + cfg.compilerDir);
      process.chdir(cfg.compilerDir); // Go to the compilation directory

    } catch (err) {
      console.log("compileJava Error: " + err);

      socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator. (" + err + ")" } );

      request.busy = false; // Update status and send status
      request.status = "Internal error occured.";
      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

      return;
    }

    if ( ! fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    fs.writeFile(cfg.compilerDir + '/' + tempDir + '/' + javaFile, data.code, function( error ) {
      if ( error ) {
        console.log('writeFile error: ' + error);
      
      } else {
	request.status = "Compiling your application."; // Update status and send status
	socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	console.log('Java version check in directory ' + process.cwd());
	exec('java -version', [], (error, stdout, stderr) => {
	  var version = stderr;

	  console.log('Compilation in directory ' + process.cwd());
	  exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 60 javac -Xlint:all ' + javaFile, [], (error, stdout, stderr) => {
	    if (error) {
	      var annotations = getAnnotations(stderr.split('\n'));
	      socket.emit('compiler-result', { status: false, version: version, output: stderr, annotations: annotations } );

	      editor.annotations = annotations;
	      editor.result      = stderr;

	      compilerCleanUpFiles(socket, tempDir);

	      request.status = "Compiled with errors."; // Update status and send status
	      request.busy   = false;
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	      if ( socket.lcdata.role != "teacher" && 
		   socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							                       editor: editor });
	      }

	      return;

	    } else {
	      socket.emit('compiler-result', { status: true, version: version });

	      if ( !execution && !activeconsole ) { // Only compilation, so end the request here!
		request.status = "Compiled successfully."; // Update status and send status
		request.busy   = false;
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		
		editor.status = true;
		editor.result = "";
		editor.success = true; // This needs to be challenged!!
		
		if ( socket.lcdata.role != "teacher" &&
		     socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
		  socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
		}

		compilerCleanUpFiles(socket, tempDir);
	      }

	      if ( execution && !activeconsole ) {
		editor.success = true; // Send an update to the teacher about the compilation success
		if ( socket.lcdata.workspace.teacherSocket != null ) {
		  socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
		}

		request.status = "Executing your code."; // Update status and send status
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		  
		console.log('Execution in directory ' + process.cwd());
		exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 10 java ' + javaMainFunction, [], (error, stdout, stderr) => {
	          if (error) {
		    console.log("ERROR" + stderr + stdout);
		    socket.emit('compiler-execution', { status: false, output: stderr + stdout });

		    request.status = "Execution with errors."; // Update status and send status
		    request.busy   = false;
		    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	          } else {
		    var output = stdout;

		    var mo = output.split('\u0007');		    
		    if ( mo && mo.length > 1 ) {
		      output = mo[1];
		    }		      

		    mo = output.split('Parent pid');
		    if ( mo && mo.length > 1 ) {
		      output = mo[0];
		    }

		    utf8.decode(output);

		    socket.emit('compiler-execution', { status: true, output: output });

		    compilerCleanUpFiles(socket, tempDir);

		    request.status = "Execution successfully."; // Update status and send status
		    request.busy   = false;
		    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
                  }
		});
	      }

	      if ( activeconsole && !execution ) { // A console will be established
		editor.success = true; // Send an update to the teacher about the compilation success
		if ( socket.lcdata.workspace.teacherSocket != null ) {
		  socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
		}

		request.status = "Activating a console for your application."; // Update status and send status
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		try {
		  process.chdir(cfg.compilerDir + '/' + tempDir);
		  
		} catch (err) {
		  socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator." } );
		  return;
		}

		console.log('Active console in directory ' + process.cwd());

		try {
		  var app = spawn('firejail', ['--profile=' + cfg.firejailProfile, '--whitelist=' + cfg.compilerDir + '/' + tempDir, 'timeout', 60*10, 'java', javaMainFunction]); // 10 minutes time
		  app.stdin.setEncoding('utf-8');

		  // TODO: Vulnerable to large inputs, iresponsive webbrowser
		  app.stdout.on('data', (data) => {
		    var output = `${data}`;
		    if ( !output.match(/\u0007|Parent pid/) ) {
		      socket.emit('console-output', { status: 'running', type: 'stdout', output: output } );
		    }
		  });

		  app.stderr.on('data', (data) => {
		    var output = `${data}`;				  
		    socket.emit('console-output', { status: 'running', type: 'stderr', output: output } );
		  });

		  app.on('close', (code) => {
		    socket.emit('console-output', { status: 'stopped', type: 'close', output: `Process exited with code ${code}\n` });
		    process.chdir(dirCurrent); // Is required while compilerCleanUpFiles thinks he is in parent process dir.
		    compilerCleanUpFiles(socket, tempDir);

		    request.status = "Console application closed."; // Update status and send status
		    request.busy   = false;
		    request.app    = null;
		    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		  });

		  request.app = app; // for STDIN purposes

		  request.status = "Console application activated."; // Update status and send status
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		  //setTimeout(function() {kill(app.pid)}, 10);


		} catch (error) {
		  console.log('ERROR: ' + error);
		  
		  socket.emit('console-output', { status: 'stopped', type: 'error', output: error });

		  request.status = "Execution with errors, could not setup a console."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		}
	      }
	    }
	  });
	});
      }	     
    });

    process.chdir(dirCurrent);
    console.log('End in directory ' + process.cwd());

  } else {
    socket.emit('compiler-result', { status: false, output: "Could not compile the JAVA code, please contact the administrator." } );
  }
}

/* Function compiler C code, executes and creates an activeconsole to the
 * application. All with the use of a jail. */
function compileC (socket, data, execution, activeconsole) {
  var request = socket.lcdata.request; // Get the request
  var editor  = socket.lcdata.editor;  // Get the editor data

  editor.code        = data.code; // Update the workspace information of this user
  editor.compiler    = data.compiler;
  editor.success     = false;
  editor.annotations = [];
  editor.result      = "";

  if ( request.busy ) { // User already requested a request, so cannot do anything!
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
    return;
  }

  request.busy = true; // Update status and send status
  request.status = "Preparation for compilation.";
  request.timestampRequest = Date.now();
  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

  var codeFile         = 'main.c';
  var tempDir          = socket.lcdata.id;

  console.log('Start in directory ' + process.cwd());
  var dirCurrent = process.cwd();
  try {
    process.chdir(cfg.compilerDir); // Go to the compilation directory

  } catch (err) {
    console.log("compileJava Error: " + err);
    
    socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator. (" + err + ")" } );

    request.busy = false; // Update status and send status
    request.status = "Internal error occured.";
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

    return;
  }

  if ( ! fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  fs.writeFile(cfg.compilerDir + '/' + tempDir + '/' + codeFile, data.code, function( error ) {
    if ( error ) {
      console.log('writeFile error: ' + error);
      
    } else {
      request.status = "Compiling your application."; // Update status and send status
      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

      console.log('C version check in directory ' + process.cwd());
      exec('gcc --version', [], (error, stdout, stderr) => {
        var version = stderr;

	console.log('Compilation in directory ' + process.cwd());
	exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '"  timeout 60 gcc -Wall -Wextra -Werror ' + codeFile + ' -o main', [], (error, stdout, stderr) => {

	  if (error) {
	    var annotations = getAnnotations(stderr.split('\n'));
	    socket.emit('compiler-result', { status: false, version: version, output: stderr, annotations: annotations } );

	    editor.annotations = annotations;
	    editor.result      = stderr;

	    compilerCleanUpFiles(socket, tempDir);

	    request.status = "Compiled with errors."; // Update status and send status
	    request.busy   = false;
	    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	    if ( socket.lcdata.role != "teacher" && 
		 socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
	      socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							     editor: editor });
	    }

	    return;

	  } else {
	    socket.emit('compiler-result', { status: true, version: version });

	    if ( !execution && !activeconsole ) { // Only compilation, so end the request here!
	      request.status = "Compiled successfully."; // Update status and send status
	      request.busy   = false;
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		
	      editor.status = true;
	      editor.result = "";
	      editor.success = true; // This needs to be challenged!!
		
	      if ( socket.lcdata.role != "teacher" &&
		   socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
	      }

	      compilerCleanUpFiles(socket, tempDir);
	    }

	    if ( execution && !activeconsole ) {
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Executing your code."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		  
	      console.log('Execution in directory ' + process.cwd());
	      exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 10 ./main', [], (error, stdout, stderr) => {

	        if (error) {
		  socket.emit('compiler-execution', { status: false, output: stderr + stdout });

		  request.status = "Execution with errors."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		} else {
		  var output = stdout;

		  var mo = output.split('\u0007');		    
		  if ( mo && mo.length > 1 ) {
		    output = mo[1];
		  }		      

		  mo = output.split('Parent pid');
		  if ( mo && mo.length > 1 ) {
		    output = mo[0];
		  }

		  utf8.decode(output);

		  socket.emit('compiler-execution', { status: true, output: output });

		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Execution successfully."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		}
	      });
	    }

	    if ( activeconsole && !execution ) { // A console will be established
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Activating a console for your application."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	      try {
		process.chdir(cfg.compilerDir + '/' + tempDir);
		  
	      } catch (err) {
		socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator." } );
		return;
	      }

	      console.log('Active console in directory ' + process.cwd());

	      try {
		var app = spawn('firejail', ['--profile=' + cfg.firejailProfile, '--whitelist=' + cfg.compilerDir + '/' + tempDir, 'timeout', 60*10, './main']); // 10 minutes time

		app.stdin.setEncoding('utf-8');

		// TODO: Vulnerable to large inputs, iresponsive webbrowser
		app.stdout.on('data', (data) => {
		  var output = `${data}`;
		  if ( !output.match(/\u0007|Parent pid/) ) {
		    socket.emit('console-output', { status: 'running', type: 'stdout', output: output } );
		  }
		});

		app.stderr.on('data', (data) => {
		  var output = `${data}`;				  
		  socket.emit('console-output', { status: 'running', type: 'stderr', output: output } );
		});

		app.on('close', (code) => {
		  socket.emit('console-output', { status: 'stopped', type: 'close', output: `Process exited with code ${code}\n` });
		  process.chdir(dirCurrent); // Is required while compilerCleanUpFiles thinks he is in parent process dir.
		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Console application closed."; // Update status and send status
		  request.busy   = false;
		  request.app    = null;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		});

		request.app = app; // for STDIN purposes

		request.status = "Console application activated."; // Update status and send status
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		//setTimeout(function() {kill(app.pid)}, 10);


	      } catch (error) {
		console.log('ERROR: ' + error);
		  
		socket.emit('console-output', { status: 'stopped', type: 'error', output: error });

		request.status = "Execution with errors, could not setup a console."; // Update status and send status
		request.busy   = false;
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
	      }
	    }
	  }
	});
      });
    }	     
  });

  process.chdir(dirCurrent);
  console.log('End in directory ' + process.cwd());
}

/* Function compiler C++ code, executes and creates an activeconsole to the
 * application. All with the use of a jail. */
function compileCpp (socket, data, execution, activeconsole) {
  var request = socket.lcdata.request; // Get the request
  var editor  = socket.lcdata.editor;  // Get the editor data

  editor.code        = data.code; // Update the workspace information of this user
  editor.compiler    = data.compiler;
  editor.success     = false;
  editor.annotations = [];
  editor.result      = "";

  if ( request.busy ) { // User already requested a request, so cannot do anything!
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
    return;
  }

  request.busy = true; // Update status and send status
  request.status = "Preparation for compilation.";
  request.timestampRequest = Date.now();
  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

  var codeFile         = 'main.cpp';
  var tempDir          = socket.lcdata.id;

  console.log('Start in directory ' + process.cwd());
  var dirCurrent = process.cwd();
  try {
    process.chdir(cfg.compilerDir); // Go to the compilation directory

  } catch (err) {
    console.log("compileJava Error: " + err);
    
    socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator. (" + err + ")" } );

    request.busy = false; // Update status and send status
    request.status = "Internal error occured.";
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

    return;
  }

  if ( ! fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  fs.writeFile(cfg.compilerDir + '/' + tempDir + '/' + codeFile, data.code, function( error ) {
    if ( error ) {
      console.log('writeFile error: ' + error);
      
    } else {
      request.status = "Compiling your application."; // Update status and send status
      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

      console.log('C++ version check in directory ' + process.cwd());
      exec('g++ --version', [], (error, stdout, stderr) => {
        var version = stderr;

	console.log('Compilation in directory ' + process.cwd());
	exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 60 g++ -std=c++14 -Wall -Wextra -Werror -lstdc++ ' + codeFile + ' -o main', [], (error, stdout, stderr) => {

	  if (error) {
	    var annotations = getAnnotations(stderr.split('\n'));
	    socket.emit('compiler-result', { status: false, version: version, output: stderr, annotations: annotations } );

	    editor.annotations = annotations;
	    editor.result      = stderr;

	    compilerCleanUpFiles(socket, tempDir);

	    request.status = "Compiled with errors."; // Update status and send status
	    request.busy   = false;
	    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	    if ( socket.lcdata.role != "teacher" && 
		 socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
	      socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							     editor: editor });
	    }

	    return;

	  } else {
	    socket.emit('compiler-result', { status: true, version: version });

	    if ( !execution && !activeconsole ) { // Only compilation, so end the request here!
	      request.status = "Compiled successfully."; // Update status and send status
	      request.busy   = false;
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		
	      editor.status = true;
	      editor.result = "";
	      editor.success = true; // This needs to be challenged!!
		
	      if ( socket.lcdata.role != "teacher" &&
		   socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
	      }

	      compilerCleanUpFiles(socket, tempDir);
	    }

	    if ( execution && !activeconsole ) {
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Executing your code."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		  
	      console.log('Execution in directory ' + process.cwd());
	      exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 10 ./main', [], (error, stdout, stderr) => {

	        if (error) {
		  socket.emit('compiler-execution', { status: false, output: stderr + stdout });

		  request.status = "Execution with errors."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		} else {
		  var output = stdout;

		  var mo = output.split('\u0007');		    
		  if ( mo && mo.length > 1 ) {
		    output = mo[1];
		  }		      

		  mo = output.split('Parent pid');
		  if ( mo && mo.length > 1 ) {
		    output = mo[0];
		  }

		  utf8.decode(output);

		  socket.emit('compiler-execution', { status: true, output: output });

		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Execution successfully."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		}
	      });
	    }

	    if ( activeconsole && !execution ) { // A console will be established
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Activating a console for your application."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	      try {
		process.chdir(cfg.compilerDir + '/' + tempDir);
		  
	      } catch (err) {
		socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator." } );
		return;
	      }

	      console.log('Active console in directory ' + process.cwd());

	      try {
		var app = spawn('firejail', ['--profile=' + cfg.firejailProfile, '--whitelist=' + cfg.compilerDir + '/' + tempDir, 'timeout', 60*10, './main']); // 10 minutes time

		app.stdin.setEncoding('utf-8');

		// TODO: Vulnerable to large inputs, iresponsive webbrowser
		app.stdout.on('data', (data) => {
		  var output = `${data}`;
		  if ( !output.match(/\u0007|Parent pid/) ) {
		    socket.emit('console-output', { status: 'running', type: 'stdout', output: output } );
		  }
		});

		app.stderr.on('data', (data) => {
		  var output = `${data}`;				  
		  socket.emit('console-output', { status: 'running', type: 'stderr', output: output } );
		});

		app.on('close', (code) => {
		  socket.emit('console-output', { status: 'stopped', type: 'close', output: `Process exited with code ${code}\n` });
		  process.chdir(dirCurrent); // Is required while compilerCleanUpFiles thinks he is in parent process dir.
		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Console application closed."; // Update status and send status
		  request.busy   = false;
		  request.app    = null;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		});

		request.app = app; // for STDIN purposes

		request.status = "Console application activated."; // Update status and send status
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		//setTimeout(function() {kill(app.pid)}, 10);


	      } catch (error) {
		console.log('ERROR: ' + error);
		  
		socket.emit('console-output', { status: 'stopped', type: 'error', output: error });

		request.status = "Execution with errors, could not setup a console."; // Update status and send status
		request.busy   = false;
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
	      }
	    }
	  }
	});
      });
    }	     
  });

  process.chdir(dirCurrent);
  console.log('End in directory ' + process.cwd());
}

/* Function compiler Python code, executes and creates an activeconsole to the
 * application. All with the use of a jail. */
function compilePython (socket, data, execution, activeconsole) {
  var request = socket.lcdata.request; // Get the request
  var editor  = socket.lcdata.editor;  // Get the editor data

  editor.code        = data.code; // Update the workspace information of this user
  editor.compiler    = data.compiler;
  editor.success     = false;
  editor.annotations = [];
  editor.result      = "";

  if ( request.busy ) { // User already requested a request, so cannot do anything!
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
    return;
  }

  request.busy = true; // Update status and send status
  request.status = "Preparation for compilation.";
  request.timestampRequest = Date.now();
  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

  var codeFile         = 'main.py';
  var tempDir          = socket.lcdata.id;

  console.log('Start in directory ' + process.cwd());
  var dirCurrent = process.cwd();
  try {
    process.chdir(cfg.compilerDir); // Go to the compilation directory

  } catch (err) {
    console.log("compileJava Error: " + err);
    
    socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator. (" + err + ")" } );

    request.busy = false; // Update status and send status
    request.status = "Internal error occured.";
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

    return;
  }

  if ( ! fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  fs.writeFile(cfg.compilerDir + '/' + tempDir + '/' + codeFile, data.code, function( error ) {
    if ( error ) {
      console.log('writeFile error: ' + error);
      
    } else {
      request.status = "Compiling your application."; // Update status and send status
      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

      console.log('Python version check in directory ' + process.cwd());
      exec('python --version', [], (error, stdout, stderr) => {
        var version = stderr;

	console.log('Compilation in directory ' + process.cwd());
	exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 60 python -m py_compile ' + codeFile, [], (error, stdout, stderr) => {

	  if (error) {
	    var annotations = getAnnotations(stderr.split('\n'));
	    socket.emit('compiler-result', { status: false, version: version, output: stderr, annotations: annotations } );

	    editor.annotations = annotations;
	    editor.result      = stderr;

	    compilerCleanUpFiles(socket, tempDir);

	    request.status = "Compiled with errors."; // Update status and send status
	    request.busy   = false;
	    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	    if ( socket.lcdata.role != "teacher" && 
		 socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
	      socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							     editor: editor });
	    }

	    return;

	  } else {
	    socket.emit('compiler-result', { status: true, version: version });

	    if ( !execution && !activeconsole ) { // Only compilation, so end the request here!
	      request.status = "Compiled successfully."; // Update status and send status
	      request.busy   = false;
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		
	      editor.status = true;
	      editor.result = "";
	      editor.success = true; // This needs to be challenged!!
		
	      if ( socket.lcdata.role != "teacher" &&
		   socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
	      }

	      compilerCleanUpFiles(socket, tempDir);
	    }

	    if ( execution && !activeconsole ) {
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Executing your code."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		  
	      console.log('Execution in directory ' + process.cwd());
	      exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 10 python ' + codeFile, [], (error, stdout, stderr) => {

	        if (error) {
		  socket.emit('compiler-execution', { status: false, output: stderr + stdout });

		  request.status = "Execution with errors."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		} else {
		  var output = stdout;

		  var mo = output.split('\u0007');		    
		  if ( mo && mo.length > 1 ) {
		    output = mo[1];
		  }		      

		  mo = output.split('Parent pid');
		  if ( mo && mo.length > 1 ) {
		    output = mo[0];
		  }

		  try {
		    utf8.decode(output);

		  } catch (err) {
		    console.log("UTF-8 Encoding failed: " + err);
		  }

		  socket.emit('compiler-execution', { status: true, output: output });

		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Execution successfully."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		}
	      });
	    }

	    if ( activeconsole && !execution ) { // A console will be established
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Activating a console for your application."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	      try {
		process.chdir(cfg.compilerDir + '/' + tempDir);
		  
	      } catch (err) {
		socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator." } );
		return;
	      }

	      console.log('Active console in directory ' + process.cwd());

	      try {
		var app = spawn('firejail', ['--profile=' + cfg.firejailProfile, '--whitelist=' + cfg.compilerDir + '/' + tempDir, 'timeout', 60*10, 'python', codeFile]); // 10 minutes time

		app.stdin.setEncoding('utf-8');

		// TODO: Vulnerable to large inputs, iresponsive webbrowser
		app.stdout.on('data', (data) => {
		  var output = `${data}`;
		  if ( !output.match(/\u0007|Parent pid/) ) {
		    socket.emit('console-output', { status: 'running', type: 'stdout', output: output } );
		  }
		});

		app.stderr.on('data', (data) => {
		  var output = `${data}`;				  
		  socket.emit('console-output', { status: 'running', type: 'stderr', output: output } );
		});

		app.on('close', (code) => {
		  socket.emit('console-output', { status: 'stopped', type: 'close', output: `Process exited with code ${code}\n` });
		  process.chdir(dirCurrent); // Is required while compilerCleanUpFiles thinks he is in parent process dir.
		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Console application closed."; // Update status and send status
		  request.busy   = false;
		  request.app    = null;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		});

		request.app = app; // for STDIN purposes

		request.status = "Console application activated."; // Update status and send status
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		//setTimeout(function() {kill(app.pid)}, 10);


	      } catch (error) {
		console.log('ERROR: ' + error);
		  
		socket.emit('console-output', { status: 'stopped', type: 'error', output: error });

		request.status = "Execution with errors, could not setup a console."; // Update status and send status
		request.busy   = false;
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
	      }
	    }
	  }
	});
      });
    }	     
  });

  process.chdir(dirCurrent);
  console.log('End in directory ' + process.cwd());
}

/* Function compiler Python code, executes and creates an activeconsole to the
 * application. All with the use of a jail. */
function compilePerl (socket, data, execution, activeconsole) {
  var request = socket.lcdata.request; // Get the request
  var editor  = socket.lcdata.editor;  // Get the editor data

  editor.code        = data.code; // Update the workspace information of this user
  editor.compiler    = data.compiler;
  editor.success     = false;
  editor.annotations = [];
  editor.result      = "";

  if ( request.busy ) { // User already requested a request, so cannot do anything!
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
    return;
  }

  request.busy = true; // Update status and send status
  request.status = "Preparation for compilation.";
  request.timestampRequest = Date.now();
  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

  var codeFile         = 'main.pl';
  var tempDir          = socket.lcdata.id;

  console.log('Start in directory ' + process.cwd());
  var dirCurrent = process.cwd();
  try {
    process.chdir(cfg.compilerDir); // Go to the compilation directory

  } catch (err) {
    console.log("compileJava Error: " + err);
    
    socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator. (" + err + ")" } );

    request.busy = false; // Update status and send status
    request.status = "Internal error occured.";
    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

    return;
  }

  if ( ! fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  fs.writeFile(cfg.compilerDir + '/' + tempDir + '/' + codeFile, data.code, function( error ) {
    if ( error ) {
      console.log('writeFile error: ' + error);
      
    } else {
      request.status = "Compiling your application."; // Update status and send status
      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

      console.log('Perl version check in directory ' + process.cwd());
      exec('perl --version', [], (error, stdout, stderr) => {
        var version = stderr;

	console.log('Compilation in directory ' + process.cwd());
	exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 60 perl -c ' + codeFile, [], (error, stdout, stderr) => {

	  if (error) {
	    var annotations = getAnnotations(stderr.split('\n'));
	    socket.emit('compiler-result', { status: false, version: version, output: stderr, annotations: annotations } );

	    editor.annotations = annotations;
	    editor.result      = stderr;

	    compilerCleanUpFiles(socket, tempDir);

	    request.status = "Compiled with errors."; // Update status and send status
	    request.busy   = false;
	    socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	    if ( socket.lcdata.role != "teacher" && 
		 socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
	      socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							     editor: editor });
	    }

	    return;

	  } else {
	    socket.emit('compiler-result', { status: true, version: version });

	    if ( !execution && !activeconsole ) { // Only compilation, so end the request here!
	      request.status = "Compiled successfully."; // Update status and send status
	      request.busy   = false;
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		
	      editor.status = true;
	      editor.result = "";
	      editor.success = true; // This needs to be challenged!!
		
	      if ( socket.lcdata.role != "teacher" &&
		   socket.lcdata.workspace.teacherSocket != null ) { // Send data to teacher!
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
								 editor: editor });
	      }

	      compilerCleanUpFiles(socket, tempDir);
	    }

	    if ( execution && !activeconsole ) {
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Executing your code."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		  
	      console.log('Execution in directory ' + process.cwd());
	      exec('cd ' + cfg.compilerDir + '/' + tempDir + '; firejail --profile=' + cfg.firejailProfile + ' --whitelist="' + cfg.compilerDir + '/' + tempDir + '" timeout 10 perl ' + codeFile, [], (error, stdout, stderr) => {

	        if (error) {
		  socket.emit('compiler-execution', { status: false, output: stderr + stdout });

		  request.status = "Execution with errors."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		} else {
		  var output = stdout;

		  var mo = output.split('\u0007');		    
		  if ( mo && mo.length > 1 ) {
		    output = mo[1];
		  }		      

		  mo = output.split('Parent pid');
		  if ( mo && mo.length > 1 ) {
		    output = mo[0];
		  }

		  utf8.decode(output);

		  socket.emit('compiler-execution', { status: true, output: output });

		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Execution successfully."; // Update status and send status
		  request.busy   = false;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		}
	      });
	    }

	    if ( activeconsole && !execution ) { // A console will be established
	      editor.success = true; // Send an update to the teacher about the compilation success
	      if ( socket.lcdata.workspace.teacherSocket != null ) {
		socket.lcdata.workspace.teacherSocket.emit('student-update', { id: socket.lcdata.id,
							       editor: editor });
	      }

	      request.status = "Activating a console for your application."; // Update status and send status
	      socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

	      try {
		process.chdir(cfg.compilerDir + '/' + tempDir);
		  
	      } catch (err) {
		socket.emit('compiler-result', { status: false, output: "Internal error occurred [101], please contact the administrator." } );
		return;
	      }

	      console.log('Active console in directory ' + process.cwd());

	      try {
		var app = spawn('firejail', ['--profile=' + cfg.firejailProfile, '--whitelist=' + cfg.compilerDir + '/' + tempDir, 'timeout', 60*10, 'perl', codeFile]); // 10 minutes time

		app.stdin.setEncoding('utf-8');

		// TODO: Vulnerable to large inputs, iresponsive webbrowser
		app.stdout.on('data', (data) => {
		  var output = `${data}`;
		  if ( !output.match(/\u0007|Parent pid/) ) {
		    socket.emit('console-output', { status: 'running', type: 'stdout', output: output } );
		  }
		});

		app.stderr.on('data', (data) => {
		  var output = `${data}`;				  
		  socket.emit('console-output', { status: 'running', type: 'stderr', output: output } );
		});

		app.on('close', (code) => {
		  socket.emit('console-output', { status: 'stopped', type: 'close', output: `Process exited with code ${code}\n` });
		  process.chdir(dirCurrent); // Is required while compilerCleanUpFiles thinks he is in parent process dir.
		  compilerCleanUpFiles(socket, tempDir);

		  request.status = "Console application closed."; // Update status and send status
		  request.busy   = false;
		  request.app    = null;
		  socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
		});

		request.app = app; // for STDIN purposes

		request.status = "Console application activated."; // Update status and send status
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });

		//setTimeout(function() {kill(app.pid)}, 10);


	      } catch (error) {
		console.log('ERROR: ' + error);
		  
		socket.emit('console-output', { status: 'stopped', type: 'error', output: error });

		request.status = "Execution with errors, could not setup a console."; // Update status and send status
		request.busy   = false;
		socket.emit('compiler-status', { busy: request.busy, status: request.status, elapsedtime: (Date.now() - request.timestampRequest)/1000 });
	      }
	    }
	  }
	});
      });
    }	     
  });

  process.chdir(dirCurrent);
  console.log('End in directory ' + process.cwd());
}

/* The user wants to give input to the console application that is running. */
function consoleInput ( socket, data ) {
  console.log("consoleInput " + JSON.stringify(data));
  var request = socket.lcdata.request;

  if ( !request.busy ) {
    socket.emit('console-output', {status: "stopped", type: "input", output: "No console is running [1]!\n"});
    return;
  }
  
  if ( request.app == null ) {
    socket.emit('console-output', {status: "stopped", type: "input", output: "No console is running [2]!\n"});
    return;
  }

  if ( data.command == 'stop') {
    kill(request.app.pid);

  } else if ( data.command == 'input' ) {
    request.app.stdin.write(data.input);

  } else {
    console.log('console-output', data.command + " is unknown!\n");
  }
}

function compilerCleanUpFiles ( socket, tempDir ) {
  console.log('Cleanup in directory ' + cfg.compilerDir + '/' + tempDir);
  exec('cd ' + cfg.compilerDir + '; rm -Rv ' + tempDir, [], (error, stdout, stderr) => {
    if ( error ) {
      console.error("ERROR DURING CLEANUP: " + error);
    }
      console.log(stdout);
  });
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

function executeRequest (socket, data) {
  console.log('execute: ' + JSON.stringify(data) );

  if ( data.compiler == "java" || data.compiler == "java-8" ) {
    compileJava(socket, data, true, false);

  } else if ( data.compiler == "cpp" ) {
    compileCpp(socket, data, true, false);

  } else if ( data.compiler == "c" ) {
    compileC(socket, data, true, false);

  } else if ( data.compiler == "python" ) {
    compilePython(socket, data, true, false);

  } else if ( data.compiler == "perl" ) {
    compilePerl(socket, data, true, false);

  } else {
    socket.emit('compiler-result', { status: false, output: "Compiler is not available." } );
  }
}

function consoleRequest (socket, data) {
  console.log('console: ' + JSON.stringify(data) );

  if ( data.compiler == "java" || data.compiler == "java-8" ) {
    compileJava(socket, data, false, true);

  } else if ( data.compiler == "cpp" ) {
    compileCpp(socket, data, false, true);

  } else if ( data.compiler == "c" ) {
    compileC(socket, data, false, true);

  } else if ( data.compiler == "python" ) {
    compilePython(socket, data, false, true);

  } else if ( data.compiler == "perl" ) {
    compilePerl(socket, data, false, true);

  } else {
    socket.emit('compiler-result', { status: false, output: "Compiler is not available." } );
  }
}

/* Workspace functions */

function isWorkspace ( workspace ) {
  for ( index in workspaces ) {
    if ( index == workspace ) {
      return true;
    }
  }

  return false;
}

function getWorkspace ( workspace ) {
  for ( index in workspaces ) {
    if ( index == workspace ) {
      return workspaces[index];
    }
  }

  return null;
}

function createWorkspace ( socket, name ) {
  console.log("Creating workspace '" + name + "' for teacher '" + socket.lcdata.username);

  printWorkspaces();

  var workspace = getWorkspace(name);

  if ( workspace == null ) { // Unique workspaces only!
    var workspace = { 
      timestampWorkspace: Date.now(),
      name: name,
      teacherSocket: socket,
      challenge: "",
      students: []
    };
    
    workspaces[name] = workspace;
    return workspace;

  } else { // Already exist, or teacher left the workspace?
    if ( workspaces[name].teacherSocket == null ) { // Workspace exist, but not teacher attached  update the teacher
      console.log("Teacher is back!!");
      workspaces[name].teacherSocket = socket;
      
      io.of(nameSpace).to(name).emit('teacher-back', { name: socket.lcdata.username, timestamp: Date.now() });

      return workspaces[name];
      
    } else {
      return null;
    }
  }
}

/* Some debugging functions */

function printWorkspaces () {
  //console.log(JSON.stringify(workspaces));

  for ( index in workspaces ) { 
    var teacher = ( workspaces[index].teacherSocket == null ? "none" : workspaces[index].teacherSocket.lcdata.username );
    console.log("Workspace: " + workspaces[index].name);
    console.log(" Created: "  + workspaces[index].timestampWorkspace);
    console.log(" Teacher: "  + teacher);
    console.log(" Students: " + workspaces[index].students.length);
  }
}
