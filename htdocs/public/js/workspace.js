/* 
 * Main Workspace Application
 * Maurice Snoeren
 */

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
  //openWebsocket();
  setTimeout("endLoadingScreen();", 3000);
}

/* When the body is loaded, this function is called. */
function onBodyLoaded () {
  // onWindowLoaded is the event that is fired when the full page is loaded.
  // Do not use this one!
}

/* Function that ends the loading screen and startup the workspace. */
function endLoadingScreen () {
  workspaceStart();
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
  console.log("Open the websocket on " + websocketUri);

  websocket = new WebSocket(websocketUri);

  websocket.onopen    = function(evt) { onWebsocketOpen(evt)    };
  websocket.onclose   = function(evt) { onWebsocketClose(evt)   };
  websocket.onmessage = function(evt) { onWebsocketMessage(evt) };
  websocket.onerror   = function(evt) { onWebsocketError(evt)   };

  
}

function closeWebsocket () {
  websocket.close();
}

/* When the web socket is opened this function is called. */
function onWebsocketOpen ( evt ) {
  writeToScreen("CONNECTED");
  websocketSend("WebSocket rocks");
}

function onWebsocketClose ( evt ) {
  writeToScreen("DISCONNECTED");
}

function onWebsocketMessage ( evt ) {
  writeToScreen('<span style="color: blue;">RESPONSE: ' + evt.data+'</span>');
}

function onWebsocketError ( evt ) {
  writeToScreen('<span style="color: red;">ERROR:</span> ' + evt.data);
}

function websocketSend ( message ) {
  console.log("Hahahahaha");
  writeToScreen("SENT: " + message);
  websocket.send(message);
}

function writeToScreen ( message ) {
  //alert(message);
  $("#output").html(message);
}
