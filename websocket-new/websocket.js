#!/usr/bin/env nodejs

// Global: TCP Listen Port of the websocket
var portWebsocket = 3000;

// Global: TCP Listen Port of the TCP/IP connection for the remote compilers
var portCompiler  = 20000;

// Nodejs application takes one argument as port websocket
if ( process.argv.length > 2 ) {
  portWebsocket = process.argv[2];
}

// Global servers and sha1 is used to create a token
var WebSocketServer = require('websocket').server;
var http            = require('http');
var net             = require('net');
var sha1            = require('sha1');

/////////////////////////////////////////////////////////////
// PART - HTTP SERVER                                      //
/////////////////////////////////////////////////////////////

var server = http.createServer ( 
  function(request, response ) {
    // process HTTP request. Since we're writing just WebSockets
    // server we don't have to implement anything.
});

server.listen(portWebsocket, function() {
  log('Server is listening on port ' + portWebsocket);
});


/////////////////////////////////////////////////////////////
// WEBSOCKET SERVER                                        //
/////////////////////////////////////////////////////////////

wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

function originIsAllowed(origin) {
  console.log((new Date()) + ' Origin ' + origin);
  return true;
}

var workspaces  = [];

// WebSocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);

  console.log((new Date()) + ' Connection accepted: ' + connection.remoteAddress );

  connection.on('message', function ( message ) { onMessage( connection, message ); });
  connection.on('close', function( ) { onClose( connection ); });
});

// Process the messages that are recieved.
function onMessage ( connection, message ) {
  if (message.type === 'utf8') {
   console.log("onMessage: " + message.utf8Data);

    var date = new Date();

    try {
      var json = JSON.parse( message.utf8Data );
    }
    catch (error) {
      console.log("JSON ERROR: " + error.message);
    }

    try {
      onCommand(connection, json);
    }
    catch (error) {
      console.log("onCommand ERROR: " + error.message);
    }

    print();
  }
}

// Process when a websocket client closed the connection
function onClose ( connection ) {
  console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
  deleteConnection(connection);
}

// General function that logs the message with a time stamp to console.
function log ( message ) {
  console.log("LOG: " + (new Date()) + ": " + message);
}

// General function that logs the variable to the console as debugging message
function debug ( data ) {
  console.log("DEBUG: " + JSON.stringify(data));
}

// This function processes the messages that came in.
// The commands that have been implemented are:
// - student-start: A student want to start a workspace
// - teacher-start: A teacher want to start a workspace
// - compile      : Request compilation of the code
// - execute      : Request compilation of the code AND execution of the binary
function onCommand ( connection, json ) {
  console.log("onCommand: '" + json.command + "'\n");

  //// Command: student-login
  if ( json.command == "student-start" ) {
    if ( !checkElements( json, ['command', 'workspace', 'username'] ) ) {
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Invalid message!" }));

    } else if ( isStudent(connection) ) { // Already known as student
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Already connected as student!" }));

    } else if ( isTeacher(connection) ) { // Already known as student
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Already connected as teacher!" }));

    } else if ( !isWorkspace(json.workspace) ) {
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Workspace does not exist!" }));

    } else if ( getWorkspace(json.workspace).students.length > 2 ) {
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Maximum amount of students reached for this workspace!" }));

    } else  { // Not known, so can elevate to a student and add it to the workspace!
      var result = addStudent(connection, json.username, json.workspace);
      var output = { command: json.command, status: false, message: "Login error.", token: token };
      if ( result != null ) {
	var output = { command: json.command, status: true, message: "Successfull login.", token: token, teacher: (result.workspace.teacher != null ? result.workspace.teacher.username : null) };
	connection.sendUTF(JSON.stringify(output));
	sendWorkspace(json.workspace);

      } else {
	connection.sendUTF(JSON.stringify(output));
      }
      //console.log("onMessage: send( " + JSON.stringify(output) + ")");
    }

  //// Command: teacher-login
  } else if ( json.command == "teacher-start" ) {
    if ( !checkElements( json, ['command', 'workspace', 'username'] ) ) {
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Invalid message!" }));
      
    } else if ( isStudent(connection) ) { // Already known as student
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Already connected as student!" }));

    } else if ( isTeacher(connection) ) { // Already known as student
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Already connected as teacher!" }));

    } else if ( isWorkspace(json.workspace) && hasWorkspaceTeacher(workspace) ) {
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Workspace already exists!" }));
      
    } else  { // Not known, so can elevate to a student and add it to the workspace!
      var result = addTeacher(connection, json.username, json.workspace);
      var output = { command: json.command, status: false, message: "Please try another workspace." };

      if ( result != null ) {
	output = { command: json.command, status: true, message: "Successfull login.", token: token };
	connection.sendUTF(JSON.stringify(output));
	sendWorkspace(json.workspace);

      } else {
	connection.sendUTF(JSON.stringify(output));
      }
      //console.log("onMessage: send( " + JSON.stringify(output) + ")");
    }

  //// Compile code && Execute code
  } else if ( json.command == "compile" || json.command == "execute" ) {
    if ( !checkElements( json, ['command', 'code', 'token', 'compiler', 'checker'] ) ) { // checker: assignment
      connection.sendUTF(JSON.stringify({ command: json.command, status: false, message: "Invalid message!" }));
    
    } else  { // Not known, so can elevate to a student and add it to the workspace!
      addRequest(connection, json);
    }

  //// Unknown command
  } else { 
    connection.sendUTF(JSON.stringify({ command: "error", status: false, message: "Unknown command." }));
  }
}

// Updates the workspace data to all participants!
function sendWorkspace (workspace) {
  if ( typeof(workspace) != "object" ) { // workspace is the name of the workspace, not the object!
    //debug("sendWorkspace: It is the name of the workspace that has been given.");
    workspace = getWorkspace(workspace);
  }

  if ( workspace != null ) {    
    var result      = { command: "workspace", teacher: "", students: [] };  
    var connections = [];

    // Create the workspace data
    if ( workspace.teacher != null ) {
      result.teacher = workspace.teacher.username;
      connections.push(workspace.teacher.connection);
    }
	  
    for ( var j=0; j < workspace.students.length; j++ ) {
      var student = workspace.students[j];
      var data = { username: student.username, status: student.status };
      result.students.push(data);
      connections.push(student.connection);
    }

    // Send the workspace information to all the clients!
    for ( var i=0; i < connections.length; i++ ) {
      connections[i].sendUTF(JSON.stringify(result));
    }
  }
}

// Adds a new teacher to an existing workspace (when teacher is away) or creates a new
// workspace and returns the workspace and teacher information. Otherwise, the function returns null.
function addTeacher ( connection, username, workspace ) {
  var d = new Date();
  token = sha1( d.getTime() + username + workspace );

  if ( isWorkspace(workspace) ) {
    if ( workspaces[workspace].teacher == null ) {
      console.log("addTeacher: Teacher '" + username + "' is back in the existing workspace '" + workspace + "'");
      workspaces[workspace].teacher = { username: username, token: token, connection: connection };
      return { workspace: workspaces[workspace], teacher: { username: username, token: token, connection: connection } };

    } else {
      console.log("addTeacher: Teacher '" + workspaces[workspace].teacher.username + "' already logged in into this workspace '" + workspace + "'");
      return null;
    }

  } else {
    console.log("addTeacher: Created workspace '" + workspace + "' and added teacher '" + username + "'");
    workspaces[workspace] = { teacher: { username: username, token: token, connection: connection }, students: [] };
    return { workspace: workspaces[workspace], teacher: { username: username, token: token, connection: connection } };
  }
}

// Adds a new student to an existing workspace and returns an object containing the workspace
// and student information. Otherwise, the function returns null.
function addStudent ( connection, username, workspace ) {
  var d = new Date();
  token = sha1( d.getTime() + username + workspace );

  if ( isWorkspace(workspace) ) {
    console.log("addstudent: Add student '" + username + "' to workspace '" + workspace + "'");
    workspaces[workspace].students.push( { username: username, token: token, connection: connection,
					     status: "", code: "", assignment: "", timestamp: "" } );
    return { workspace: workspaces[workspace], student: { username: username, token: token, connection: connection } };
    
  } else {
    console.log("addStudent: Workspace does not exist, so student cannot log into this workspace '" + workspace + "'");
    return null;
  }
}

// Checks whether the connection is already registered as student. If so, it returns the workspace and student
// information. Otherwise, it returns null.
function isStudent (connection) {
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);
    for ( var i=0; i < ws.length; i++ ) {
      workspace = workspaces[ws[i]];
      
      for ( var i=0; i < workspace.students.length; i++ ) {
	if ( connection == workspace.students[i].connection ) {
	  return { workspace: workspace, student: workspace.students[i] };
	}
      }
    }
  }

  return null;
}

// Checks whether the connection is already registered as teacher. If so, it returns the workspace and teacher
// information. Otherwise, it returns null.
function isTeacher (connection) {
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);
    for ( var i=0; i < ws.length; i++ ) {
      workspace = workspaces[ws[i]];

      if ( workspace.teacher != null && connection == workspace.teacher.connection ) {
	return { workspace: workspace, teacher: workspace.teacher };
      }
    }
  }

  return null;
}

function deleteWorkspace (workspaceName) {
  var workspacesTmp = [];
  
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);
    
    for ( var i=0; i < ws.length; i++ ) {
      if ( ws[i] != workspaceName ) {
	workspacesTmp[ws[i]] = workspaces[ws[i]];
      }
    }
    
    workspaces = workspacesTmp;
  }
}

function deleteConnection (connection) {
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);

    for ( var i=0; i < ws.length; i++ ) {
      workspace = workspaces[ws[i]];
      
      if ( workspace.teacher != null && connection == workspace.teacher.connection ) {
	console.log("deleteConnection: Delete teacher: '" + workspace.teacher.username + "'");
	workspace.teacher = null;
      }

      for ( var j=0; j < workspace.students.length; j++ ) {
	if ( connection == workspace.students[j].connection ) {
	  console.log("deleteConnection: Delete student: '" + workspace.students[i].username + "'");
	  workspace.students.splice(j, 1);
	}
      }

      if ( workspace.students.length > 0 || workspace.teacher != null ) {
	sendWorkspace(workspace);
	
      } else { // Delete the workspace, while nobody is using it.
	deleteWorkspace(ws[i]);
	return; // Nothing to do anymore!
      }
    }    
  }

  print ();

  return null;
}

function checkElements ( data, elements ) {
  for ( var i=0; elements.length < i; i++ ) {
    //console.log("Check element '" + elements[i] + "': '" + data.indexOf(elements[i]) + "'");
    if ( data.indexOf(elements[i]) < 0 ) {
      return false;
    }
  }

  return true;
}

function isWorkspace (workspace) {
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);
    for ( var i=0; i < ws.length; i++ ) {
      if ( ws[i] == workspace ) {
        return true;
      }
    }
  }

  return false;
}

function getWorkspace (workspace) {
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);
    for ( var i=0; i < ws.length; i++ ) {
      if ( ws[i] == workspace ) {
        return workspaces[ws[i]];
      }
    }
  }

  return null;
}

function hasWorkspaceTeacher (workspace) {
  if ( typeof(workspaces) == 'object' ) {
    if ( workspaces.indexOf(workspace) > 0 ) { // It exists!
      return ( workspaces[workspace].teacher != null );
    }
  }

  return false;
}

// Prints the workspaces to the console!
function print () {
  if ( typeof(workspaces) == 'object' ) {
    var ws = Object.keys(workspaces);
    for ( var i=0; i < ws.length; i++ ) {
      workspace = workspaces[ws[i]];
      console.log("Workspace: " + ws[i]);
      console.log("  Teacher: " + ( workspace.teacher != null ? workspace.teacher.username : "not available"));
      for ( var j=0; j < workspace.students.length; j++ ) {
	console.log("   Student: " + workspace.students[j].username);
      }
    }
  }

  return null;  
}

/////////////////////////////////////////////////////////////
// TCP COMPILE REMOTE SERVER (CONCEPT)                     //
/////////////////////////////////////////////////////////////

var clients         = [];
var requests        = [];
var processing      = [];
var workers         = [];

function addRequest ( connection, request ) {
  if ( clients.length <= 0 ) {
    try {
      connection.sendUTF(JSON.stringify({ command: "compile-status", status: true, message: "No compilers are available to process your request!" }));
    }
    catch (error) {
      console.log("addRequests: senUTF socket error: " + error.message);
    }

    return;
  }

  for ( var i=0; i < processing.length; i++ ) {
    if ( connection == processing[i].connection ) {
      try {
	connection.sendUTF(JSON.stringify({ command: "compile-status", status: true, message: "Compiler is still busy with your request!" }));
      }
      catch (error) {
	console.log("addRequests: senUTF socket error: " + error.message);
      }

      return;
    }
  }

  for ( var i=0; i < requests.length; i++ ) {
    if ( connection == requests[i].connection ) {
      try {
	connection.sendUTF(JSON.stringify({ command: "compile-status", status: true, message: "Your request is pending to be compiled by the compiler!" }));
      }
      catch (error) {
	console.log("addRequests: senUTF socket error: " + error.message);
      }

      return;
    }
  }
 
  // Add the request to the queue!
  requests.push({ connection: connection, request: request });

  try {
    connection.sendUTF(JSON.stringify({ command: "compile-status", status: true, message: "Your request has been received!" }));
  }
  catch (error) {
    console.log("addRequests: senUTF socket error: " + error.message);
  }
}

function getRequest () {
  var request = null;

  if ( requests.length > 0 ) {
    request = requests.shift(); // pops first element from array
    processing.push(request);
  }

  return request;
}

function processRequests () {
  for ( var i=0; i < clients.length; i++ ) {
    if ( clients[i].request == null ) {
      //console.log("Client " + i + " is waiting for compile requests");
      var request = getRequest(); // { connection, request }

      console.log("DEBUG alivecounter: " + clients[i].alivecounter + "\n");

      if ( request != null ) {
	console.log("processRequests: Send the request to worker '" + i + "'!");
	request.timestamp = (new Date()).getTime();
	clients[i].request = request;
	clients[i].alivecounter = 0;
	try {
	  clients[i].socket.write(JSON.stringify(request.request));
	}
	catch (error) {
	  console.log("processRequests: Writing socket error: " + error.message);
	}

	console.log("processRequests: Total requests in the queue: " + requests.length);
	console.log("processRequests: Total pending  in the queue: " + processing.length);

      } else { // Client is still waiting
	if ( clients[i].alivecounter++ > 10 ) {
	  try {
	    var timestamp = (new Date()).getTime();
	    clients[i].socket.write("alive-message:" + timestamp + "\n");
	    clients[i].alivecounter = 0;
	  }
	  catch (error) {
	    console.log("sendAliveMessage: Writing socket error: " + error.message);
	  }
	}
      }
    }
  }

  // Opschonen van de workers.
  checkProcessingTasks();

  // Opschonen van requests die een worker hebben die kapot is gegaan.

  //console.log("Total requests in the queue: " + requests.length);
  //console.log("Total pending  in the queue: " + processing.length);
}

function checkProcessingTasks () {
  for ( var i=0; i < processing.length; i++ ) {
    if ( processing[i].timestamp > (new Date()).getTime() + (10 * 1000) ) {
      try {
	console.log("checkProcessingTasks: Timeout");
	processing[i].connection.sendUTF(JSON.stringify({ command: "compile-error", status: true, message: "Your request taking too long, sorry!\n" }));
      }
      catch (error) {
	console.log("checkProcessingTasks: sendUTF socket error: " + error.message);
      }
    }
  }  
}

function sendAliveMessage () {
  var timestamp = (new Date()).getTime();

  for ( var i=0; i < clients.length; i++ ) {
    try { // Maybe a write method that creates a try catch
      try {
	//console.log("alive-message:" + timestamp);
	clients[i].socket.write("alive-message:" + timestamp + "\n");
      }
      catch (error) {
	console.log("sendAliveMessage: Writing socket error: " + error.message);
      }
    }
    catch (e) {
      console.error(e);
      clients.splice(i, 1); // remove client
    }
  }
}

function finishRequest ( socket, message ) {
  for ( var i=0; i < clients.length; i++ ) {
    if ( clients[i].socket == socket && clients[i].request != null ) {
      var request = clients[i].request;
      clients[i].request = null;
      
      try {
	request.connection.sendUTF(message);
      }
      catch (error) {
	console.log("checkProcessingTasks: sendUTF socket error: " + error.message);
      }

      deletePendingWorker(request);
      //clients[i].socket.write(message);
      // update the workspace and send all information to the workspace?!
    }
  }
}

function deletePendingWorker ( request ) {
  for ( var i=0; i < processing.length; i++ ) {
    if ( processing[i] == request ) {
      processing.splice(i, 1);
      return;
    }
  }
}

net.createServer( function (socket) { // Accepted client connection
  socket.name = socket.remoteAddress + ":" + socket.remotePort;

  clients.push( { socket: socket, request: null, alivecounter: 0 } );

  //socket.write("Welcome " + socket.name + "\n");

  // Handle incoming messages from clients.
  socket.on('data', 
    function (data) {
      finishRequest(socket, data);
  });

  // Remove the client from the list when it leaves
  socket.on('end', function () {
	      // TODO! Maar wat??
	      // clients.splice(clients.indexOf(socket), 1);
    // Acknowledge the request that was carried out 
    // delete the socket
  });
  
}).listen(portCompiler);

setInterval(processRequests, 1000);
//setInterval(sendAliveMessage, 10000);
