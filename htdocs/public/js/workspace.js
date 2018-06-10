/* 
 * Main Workspace Application
 * Maurice Snoeren
 */

/* Workspace environment */
var workspaceId   = ""; 
var token         = "12345";
var username      = "unknown";
var userid        = "unknown";
var teacher       = false;
var teacherName   = "";
var teacherJoined = true;
var students      = [];
var ranking       = []; // Ranking of the student with success compilation
var language      = $("#compiler").val();
var assignment    = "compile-success";

/* Status */
const NOTCONNECTED     = 0;
const CONNECTWEBSOCKET = 1;
const CONNECTWORKSPACE = 2;
const CONNECTED        = 3;
var status             = NOTCONNECTED;

/* Student Status */
const NORESULT       = 0;
const COMPILEERROR   = 1;
const COMPILING      = 2;
const COMPILESUCCESS = 3;
const NOCOMPILATION  = 4;

/* The web socket uri to connect with. */
var websocketUri = "wss://vmacman.jmnl.nl/websocket/workspace";
var websocket    = null;
//wss://echo.websocket.org/";

/* 
 * Pre loading screen
 * Note: pre-loading images and video should be done still.
 */

/* Create the event handler when the window is loaded. */
window.onload = function () { onWindowLoaded(); }

/* Load the project and workspace code, start the first level and remove the loading screen.
 * When errors occur, please show an error screen.
 * TODO: eval? while it could go wrong in the code, and the loading screen hangs!
 */
function onWindowLoaded () {
  if ( getUrlVar("teacher") == "yes" ) {
    teacher = true;
  }

  // Check the workspace ID that is given by the application before sending!
  workspaceId = getUrlVar("workspace");  
  var reWorkspace = new RegExp("^\\w{5,10}$");
  if ( !reWorkspace.test(workspaceId) ) {
    alert("ERROR: WorkspaceId is niet geldig!");
    window.location.href = (teacher ? "teacher.html" : "index.html");
  }

  // Check the username
  username = getUrlVar("username");
  var reUsername = new RegExp("^[a-zA-Z0-9 -_]{1,40}$");
  if ( !reUsername.test(username) ) {
    alert("ERROR: Username is niet geldig!");
    window.location.href = (teacher ? "teacher.html" : "index.html");
  }
  
  openWebsocket();

  //setTimeout(endLoadingScreen, 1000);
}

function logout () {
  closeWebsocket();
  window.location.href = "index.html";
} 

function setWorkspaceInfo () {
  //$('#workspaceinfo').html("Workspace (" + (teacher ? "Docent" : "Student") + "): " + workspaceId + ", " + username + " (" + token + ")" + (!teacher ? ", Teacher: " + teacherName : ""));
  
  bgcolor = "background-color: #ffad99;";
  if ( status == CONNECTED && teacherJoined ) {
	bgcolor = "background-color: #e0ffb3;";
  }
    
  $('#workspaceinfo').html("<div class=\"py-2 px-2\" style=\"" + bgcolor + "\"\>Workspace:  " + workspaceId + " als " +
                           (teacher ? "docent" : "student") + " met naam " + username + " (" + userid + ")" +
                           (teacher ? " " : "<br/>Docent: " + teacherName) + (teacherJoined ? "" : " (niet meer aanwezig)") + "</div>");
}

/* When the body is loaded, this function is called. */
function onBodyLoaded () {
  // onWindowLoaded is the event that is fired when the full page is loaded.
  // Do not use this one!
}

/* Function that ends the loading screen and startup the workspace. */
function endLoadingScreen () {
  $("#ws-loader-container").html("<h3><b>Succes!!</b></h3>");
  $("#ws-progress-bar").width(600);
  $(".ws-loader").fadeOut(2000, function () { workspaceStart(); });
  //workspaceStart();
}
 
/* 
 * Workspace functions
 */

/* The function that is called when the workspace is visible, started and can be used by the user. 
 *  This function should be implemented by the project-age-challenge. */
function workspaceStart () {

}

/* 
 * Web Socket
 */

/* Initialize the websocket and connect the events to the functions. */
function openWebsocket () {
  if ( status == NOTCONNECTED ) {
    status = CONNECTWEBSOCKET;
    statusWebsocket("Connecting");

    console.log("Connecting to the websocket on '" + websocketUri + "'");
    
    websocket = new WebSocket(websocketUri);
    
    websocket.onopen    = function(evt) { onWebsocketOpen(evt)    };
    websocket.onclose   = function(evt) { onWebsocketClose(evt)   };
    websocket.onmessage = function(evt) { onWebsocketMessage(evt) };
    websocket.onerror   = function(evt) { onWebsocketError(evt)   };  

  } else {
    console.log("Connection is already in progress.");    
  }
}

function closeWebsocket () {
  if ( status != NOTCONNECTED ) {
    websocket.close();
    statusWebsocket("Closed");
    status = NOTCONNECTED;
    console.log("setTimeout");
    setTimeout(openWebsocket, 10000);
    token = "";
    
  } else {
    console.log("Cannot close a socket that is not connected or is in a connecting state!");
    //alert("Connection Error\nPlease try again later.");
    window.location.href = (teacher ? "teacher.html" : "index.html");
  }
}

/* When the web socket is opened this function is called. */
function onWebsocketOpen ( evt ) {
  if ( status == CONNECTWEBSOCKET ) {
    status = CONNECTWORKSPACE;
    statusWebsocket("Connect Workspace");

    // Socket is opened, STEP 1: Workspace Id needs to be send first to get a token    
    connectWorkspace();

  } else {
    console.log("Got open event while there is no connection?!");
  }
}

function connectWorkspace () {
  if ( teacher ) {
    send2Server("teacher-start", "");
    
  } else {
    send2Server("student-start", "");
  }
}

function send2Server ( command, data ) {
  websocketSend(command + ";" + language + ";" + workspaceId + ";" + assignment + ";" + username + ";" + token + ";" + data + "\n");
}

function onWebsocketClose ( evt ) {
  closeWebsocket();
}

function onWebsocketMessage ( evt ) {
  var data = parseJson(evt.data);

  if ( typeof(data) == "object" ) {

    if ( data.command == "teacher-start" || data.command == "student-start" ) {
      if ( status == CONNECTWORKSPACE ) {
	if ( data.status ) { // Success!
	  status = CONNECTED;
	  teacher = ( data.command == "teacher-start" );
	  teacherName = ( !teacher ? data.teacher : "" );
	  token = data.token;
	  userid = data.id;
	  statusWebsocket("Connected");
	  setWorkspaceInfo();
	  endLoadingScreen(); // workspace is ready!
	  
	} else { // No success!
	  statusWebsocket("Workspace Error");
	  alert("Workspace Error:\n\n" + data.message + "\n\nProbeer het later opnieuw!");

	  window.location.href = (teacher ? "teacher.html" : "index.html");
	}

      } else {
	console.log("Got teacher-start message while I am not connecting with the workspace!");
      }

    } else if ( data.command == "student-new" ) {
      addStudent(data);
      //alert("New Student: " + data.name + " (" + data.id + ")");

    } else if ( data.command == "student-del" ) { // Student is gone!
      delStudent(data);
      //alert("Delete Student: " + data.name);

    } else if ( data.command == "compile-result" || data.command == "compiler-result" ) {
      loadCompileResult(data.result + (data.execution ? data.execution : ""));
      if ( data.status ) {
		send2Server("compile-success", editor.getValue());
	    celebrateShow("Je hebt de opdracht goed volbracht door het programma foutloos te compileren!");
		
      } else {
  		send2Server("compile-error", editor.getValue());
	  }

    } else if ( data.command == "teacher-quit" ) {
      //alert("Teacher has left the workspace.\n");
      //window.location.href = (teacher ? "teacher.html" : "index.html");
	  teacherJoined = false;
	  setWorkspaceInfo();

    } else if ( data.command == "teacher-joined" ) {
      //alert("Teacher has rejoined the workspace.\n");
      //window.location.href = (teacher ? "teacher.html" : "index.html");
      teacherJoined = true;
      setWorkspaceInfo();
	  
	// TODO: change everything to indepent to language, so compile-java to compile. The language
	//       should be added to a different collumn
    } else if ( data.command == "compile" || data.command == "compile-error" || 
	            data.command == "execute" || data.command == "execute-error" ||
	            data.command == "compile-java" || data.command == "execute-java" ) { // Information on the compile-java command!
      loadCompileResult(data.message);
	  updateStudent(NOCOMPILATION);

    } else if ( data.command == "student-compile-success" ) {
      if ( data.id != userid ) {
	    addStudent2Ranking(data.id, data.name);
        updateStudent(data, COMPILESUCCESS);
	  }

    } else if ( data.command == "student-compile-error" ) { 
      if ( data.id != userid ) {
        updateStudent(data, COMPILEERROR);
	  }
	  
    } else if ( data.command == "student-compile-start" ) {
      if ( data.id != userid ) {
        updateStudent(data, COMPILING);
	  }

    } else {
      alert("Got unknown command: " + data.command);
    }
  }
}

function resetStudents () {
  ranking = [];
  
  for ( var i=0; i < students.length; i++ ) {
    students[i].status = NORESULT;
  }
  
  updateStudentDisplay();
}

function addStudent2Ranking ( id, name ) {
  for ( var i=0; i < ranking.length; i++ ) {
    if ( ranking[i].id == id ) { // Found!
	  return;
	}
  }

  ranking.push({ id: id, name: name });
}

function addStudent ( data ) {
  students.push( { name: data.name, id: data.id, status: NORESULT });
  updateStudentDisplay();
}

function delStudent ( data ) {
  newStudents = [];

  for ( var i=0; i < students.length; ++i ) {
    if ( data.id != students[i].id ) {
      newStudents.push(students[i]);
    }
  }

  students = newStudents;

  updateStudentDisplay();
}

function updateStudent ( data, status ) {
  for ( var i=0; i < students.length; ++i ) {
    if ( data.id == students[i].id ) {
      students[i].status = status; //( data.status ? COMPILESUCCESS : COMPILEERROR );
    }
  }  

  updateStudentDisplay();
}

function updateStudentDisplay ( ) {
  var output = "";

  var rankinghtml = "<div><p><b>Ranking ";
  for ( var i=0; i < ranking.length && i < 3; i++ ) { // First 3
    rankinghtml += (i+1) + ": " + ranking[i].name + " (" + ranking[i].id + ") ";	
  }
  rankinghtml += "</b></p></div>\n";
  
  if ( students.length == 0 ) {
    output = "Geen studenten in de workspace...";
  }

  for ( var i=0; i < students.length; ++i ) {
	  
/*	  
    var status = ( students[i].status == NORESULT ? "?" : ( students[i].status == COMPILESUCCESS ? "+" : "-" ) );  
    output += "(" + status + ":" + students[i].name + ":" + students[i].id + ") ";
*/

    
    output += _updateStudent(students[i]);
  }    
  
  output += "<div class=\"float-non\"></div>";
  
  $('#studentsoverview').html((ranking.length > 0 ? rankinghtml + output : output));
}

function _updateStudent ( student ) {
	var bgcolor = "background-color: #EEE;";
	if ( student.status == COMPILEERROR ) {
	  bgcolor = "background-color: #F00;";

	} else if ( student.status == COMPILING ) {
	  bgcolor = "background-color: #00F;";

	} else if ( student.status == COMPILESUCCESS ) {
	  bgcolor = "background-color: #0F0;";
	  
	} else if ( student.status == NOCOMPILATION ) {
	  bgcolor = "background-color: #999;";
	  
	}	
	
	return "<div style=\"" + bgcolor + "\" class=\"border border-primary student rounded-circle float-left text-center\"><br>" + student.name + "<br>" + student.id + "</div>";
}

function onWebsocketError ( evt ) {
  closeWebsocket();
}

function websocketSend ( message ) {
  websocket.send(message);
}

function compileCode (event) {
  event.preventDefault();
  //send2Server("compile-java", editor.getValue()); //old
  send2Server("compile", editor.getValue()); // new: language independent
  //window.location.href = "#output"; // Go to anchor
}

function executeCode (event) {
  event.preventDefault();
  //send2Server("execute-java", editor.getValue()); //old
  send2Server("execute", editor.getValue()); //new: language independent
  //window.location.href = "#output"; // Go to anchor
}

function processMessage (command, data) {
  console.log("Command: " + command + ". data: " + data + "\n");

  if ( command == "token" ) {
    token = data;
    statusWebsocket("Connected");
  }
}

function statusWebsocket (status) {
  $("#status").html(status);
}

/* ACE Editor Function */

function loadEditorCode ( code ) {
  editor.setValue(code);
  editor.gotoLine(1);
}

function loadCompileResult ( result ) {
  $('#output').html("<pre class=\"text-white\">" + result + "</pre>");
}

function onChangeCompiler ( value ) {
  language = value;
}

/* Confetti and celebration */

function celebrateShow ( message ) {
  window.addEventListener('resize', function(event){
			    confetti.resize();
			  });
  $('#confetti').show();
  confetti.start();
  $('#celebrationtext').html(message);
  $("#celebrationModal").on("hidden.bs.modal", function () { celebrateHide(); });
  $('#celebrationModal').modal('show');
  //setTimeout(celebrateHide, 3000);
}

function celebrateHide () {
  if ( confetti != null ) {
    confetti.stop();
    $('#confetti').hide();
  }
}

/* Helper Functions */

function getUrlVar(key){
  var result = new RegExp(key + "=([^&]*)", "i").exec(window.location.search);
  return result && unescape(result[1].replace("+", " ")) || ""; 
}

function parseJson ( json ) {
  try {
    return JSON.parse(json);
    
  } catch(e) {
    alert(json);
    alert(e);
  }

  return null;
}

