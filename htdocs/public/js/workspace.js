/* 
 * Main Workspace Application
 * Maurice Snoeren
 */

/* Workspace environment */
var workspaceId = ""; 
var token       = "12345";
var username    = "unknown";
var teacher     = false;

/* Status */
const NOTCONNECTED     = 0;
const CONNECTWEBSOCKET = 1;
const CONNECTWORKSPACE = 2;
const CONNECTED        = 3;
var status             = NOTCONNECTED;

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
  username    = getUrlVar("username");
  var reUsername = new RegExp("^[a-zA-Z0-9 -_]{1,40}$");
  if ( !reUsername.test(username) ) {
    alert("ERROR: Username is niet geldig!");
    window.location.href = (teacher ? "teacher.html" : "index.html");
  }
  
  openWebsocket();

  setTimeout(endLoadingScreen, 1000);
}

function setWorkspaceInfo () {
  $('#workspaceinfo').html("Workspace: " + workspaceId + ", " + username + " (" + token + ")");
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
  websocketSend(command + ";" + workspaceId + ";" + username + ";" + token + ";" + data + "\n");
}

function onWebsocketClose ( evt ) {
  closeWebsocket();
}

function onWebsocketMessage ( evt ) {
  var data = parseJson(evt.data);

  if ( typeof(data) == "object" ) {

    if ( data.command == "teacher-start" ) {
      if ( status == CONNECTWORKSPACE ) {
	if ( data.status ) { // Success!
	  token = data.token;
	  statusWebsocket("Connected");
	  setWorkspaceInfo();
	  connecting = false;
	  connected  = true;
	  
	} else { // No success!
	  statusWebsocket("Workspace Error");
	  connectWorkspace();
	}
      } else {
	console.log("Got teacher-start message while I am not connecting with the workspace!");
      }
    }
  }
}

function onWebsocketError ( evt ) {
  closeWebsocket();
}

function websocketSend ( message ) {
  websocket.send(message);
}

function writeToScreen ( message ) {
  $("#output").html(message);
}

function compileCode () {
  websocketSend(editor.getValue());
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

function outputWebsocket (output) {
  $("#output").html(output);
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
