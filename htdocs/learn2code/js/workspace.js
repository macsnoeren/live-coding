/* 
 * Main Workspace Application
 * Maurice Snoeren
 */

var version = "0.3 beta";

/* Socket.IO and Events */
var socket = io('/learn2code');
socket.on('connect',             function ()    { onWebsocketConnection();            } );
socket.on('connect_error',       function ()    { onWebsocketConnectionError();       } );
socket.on('disconnect',          function ()    { onWebsocketDisconnection();         } );
socket.on('login',               function(data) { onWebsocketLogin(data);             } );
socket.on('compiler-result',     function(data) { onWebsocketCompilerResult(data);    } );
socket.on('compiler-execution',  function(data) { onWebsocketCompilerExecution(data); } );
socket.on('compiler-status',     function(data) { onWebsocketCompilerStatus(data);    } );
socket.on('console-output',      function(data) { onWebsocketConsoleOutput(data);     } );
socket.on('student-update',      function(data) { onWebsocketStudentUpdate(data);     } );
socket.on('student-add',         function(data) { onWebsocketStudentAdd(data);        } );
socket.on('student-del',         function(data) { onWebsocketStudentDel(data);        } );
socket.on('teacher-left',        function(data) { onWebsocketTeacherLeft(data);       } );
socket.on('teacher-back',        function(data) { onWebsocketTeacherBack(data);       } );
socket.on('teacher-push',        function(data) { onWebsocketTeacherPush(data);       } );

updateLoaderInfo("Connecting to the workspace server.");
 
/* Workspace environment */
var workspace     = {};
var token         = "";
var username      = "";
var id            = "";
var teacher       = false;
var language      = $("#compiler").val();
var fontSize      = 12;

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
  $(document).bind('keydown', function(e) {
		     if(e.ctrlKey && (e.which == 83)) { // Ctr-S prevention
		       e.preventDefault();
		       onCtrlSave();
		       return false;
		     }
		   });
}

function logout () {
  window.location.href = "index.html";
} 

/* When the body is loaded, this function is called. */
function onBodyLoaded () {
  // onWindowLoaded is the event that is fired when the full page is loaded.
  // Do not use this one!
}

/* Function is called when the user pressen ctr-s. Could get some saving functionality later. */
function onCtrlSave() {
  console.log("onCtrlSave: crt-s is pressed");
}

/*! Function that ends the loading screen and startup the workspace. */
function endLoadingScreen () {
  $("#ws-loader-container").html("<h3><b>Succes!!</b></h3>");
  $("#ws-progress-bar").width(600);
  $(".ws-loader").fadeOut(2000, function () { workspaceStart(); updateLoaderInfo(""); });
}
 
/*! Function updates the loader info, so the user knows what is happening. */
function updateLoaderInfo ( text ) {
  $('#ws-loader-info').html(text);
}

/*! Function updates the text of the status bar, so the user knows what is happening. */
function updateStatusBar ( text ) {
  $('#status-bar').html(text);

  // TODO: This must be better! With console-status or so?
  if ( text == 'Console application activated.' ) { // A console is active
    $('#console-close').show();
  }
}

/* 
 * Workspace functions
 */

/* The function that is called when the workspace is visible, started and can be used by the user. 
 *  This function should be implemented by the project-age-challenge. */
function workspaceStart () {

}

/*! If the id is found, the student data is returns, otherwise null */
function getStudent ( studentId ) {
  students = workspace.students;

  for ( var i=0; i < students.length; i++ ) {
    if ( students[i].id == studentId ) {
      return students[i];
    }
  }

  return null;
}

/* Grabs the code from the student that has been selected and put it into the
 * workspace. */
function grabCode () {
  loadEditorCode( $('#studentDetailModalCode').text() );
  $('.nav-item a[data-target="#tabWorkspace"]').tab('show'); // Show the tab workspace!
}

function changeFontSize (size) {
  $("#editor").css("font-size", size + "px");
  $("#output").css("font-size", size + "px");
}

function increaseFontSize () {
  changeFontSize( ++fontSize );
}

function decreaseFontSize () {
  changeFontSize( --fontSize );
}

/* 
 * Web Socket
 */

function onWebsocketConnection () {
  var workspaceName = getUrlVar("workspace");  
  username          = getUrlVar("username");
  teacher           = ( getUrlVar("teacher") == "yes" ? true : false ); 

  // Remove unwanted chars!
  //username = username.replace(/[^a-zA-Z0-9]/g, '');
  username = username.replace(/[<>"'()\/\\]/g, '');
  username = ( username.length > 30 ? username.substring(0, 30) + "..." : username );

  updateLoaderInfo("Logging into the workspace.");
  updateStatusBar("Logging into the workspace.");

  if ( teacher ) { // Login!
    socket.emit('teacher-login', { username: username, workspace: workspaceName });

  } else {
    socket.emit('student-login', { username: username, workspace: workspaceName });
  }
}

function onWebsocketConnectionError () {
  console.log("Server is not responding, you can go on!");
  updateLoaderInfo("Error during connection to the workspace, re-trying.");
  updateStatusBar("Connection lost with workspace ... reconnecting.");
}

// When the websocket has been disconnected, this function is called.
function onWebsocketDisconnection () {
  console.log("Server is disconnected, you can go on!");
  updateLoaderInfo("Workspace server disconnected.");
  updateStatusBar("Disconnected with the workspace server.");
}

// When a login event comes in, this function is called.
function onWebsocketLogin ( data ) {
  if ( data.result ) {
    token     = data.token;
    id        = data.id;
    role      = data.role;
    workspace = data.workspace;

    endLoadingScreen();

    updateLoaderInfo("Logged into the workspace successfully.");
    updateStatusBar("Connected with the workspace server and logged in.");

    updateWorkspace();

    console.log(JSON.stringify(data));

  } else {
    updateLoaderInfo("Login failed: " + data.message);
    updateStatusBar("Login failed: " + data.message);
    $('#ws-loader-image').hide();
    $('#ws-loader-button').show();
  }
}

// ???
function onWebsocketMessage ( data ) {
  console.log("WebsocketMessage: " + JSON.stringify(data));
}

// BUG FIX: Fixed the html conversion to no conversion
function onWebsocketCompilerResult ( data ) {
  $('#output').text('');

  if ( !data.status ) {
    //$('#output').text(data.output);
    loadCompileResult(data.output);
  }

  editor.getSession().setAnnotations(data.annotations);
}

function onWebsocketCompilerStatus ( data ) {
  updateStatusBar(data.status);
}

function onWebsocketCompilerExecution ( data ) {
  if ( data.status ) {
    //$('#output').text(data.output);
    loadCompileResult(data.output);


  } else {
    //$('#output').text('Execution failed!');
    loadCompileResult(data.output);
  }
}

function onWebsocketConsoleOutput ( data ) {
  $('#output').append(data.output);
}

/*! Function is called when a student is added to the workspace. */
function onWebsocketStudentAdd ( data ) {
  console.log("WebsocketStudentAdd: " + JSON.stringify(data));
  
  for ( var i=0; i < workspace.students.length; i++ ) {
    if ( workspace.students[i].id == data.id ) {
      workspace.students[i].name = data.name;
      workspace.students[i].success = data.success;
      return;
    } 
  }

  workspace.students.push({ id: data.id, name: data.name, success: data.success });

  updateWorkspace();
}

/*! Function is called when a student leaves the workspace. */
function onWebsocketStudentDel ( data ) {
  for ( var i=0; i < workspace.students.length; i++ ) {
    if ( workspace.students[i].id == data.id ) {
      workspace.students.splice(i, 1);
      updateWorkspace();
      return;
    } 
  }
}

/* When the students compiles, it is updated. */
function onWebsocketStudentUpdate ( data ) {
  console.log("WebsocketStudentUpdate: " + JSON.stringify(data));

  for ( var i=0; i < workspace.students.length; i++ ) {
    if ( workspace.students[i].id == data.id ) {
      workspace.students[i].success = data.editor.success;
      workspace.students[i].editor  = data.editor;
      updateWorkspace();
      return;
    } 
  }
}

function onWebsocketTeacherLeft ( data ) {
  console.log("WebsocketTeacherLeft: " + JSON.stringify(data));
}

function onWebsocketTeacherBack ( data ) {
  console.log("WebsocketTeacherBack: " + JSON.stringify(data));
}

function onWebsocketTeacherPush ( data ) {
  console.log("WebsocketTeacherPush: " + JSON.stringify(data));
  showTeacherCodeModel(data);
}

/*! Update the workspace info at the top of the page. */
function updateWorkspaceInfo () {
  /*$('#workspace-info').html('Workspace:  ' + workspace.name + '<br/>' +
			    (teacher ? '' : 'Docent: ' + (workspace.teacher != '' ? workspace.teacher + '<br/>' : '<b>Afwezig</b><br/>') + '</div>') + 
			    (teacher ? 'Docent' : 'Student') + ': ' + username);*/
  $('#workspace-info').html(username + ' @ ' + workspace.name + (!teacher && workspace.teacher ? ' (' + workspace.teacher + ')': ''));
}

function updateWorkspace () {
  updateWorkspaceInfo();
  updateStudentDisplay();
}

function updateStudentDisplay ( ) {
  var output = "";

  if ( workspace.students.length == 0 ) {
    output = "Geen studenten in de workspace...";
  }

  for ( var i=0; i < workspace.students.length; ++i ) {
    output += _updateStudent(workspace.students[i]);
  }    
  
  output += "<div class=\"float-non\"></div>";
  
  $('#student-overview').html(output);
}

function _updateStudent ( student ) {
  var image = "../images/person-blue.png";

  if ( typeof student.editor !== 'undefined' ) {
    if ( student.success ) {
      image = "../images/person-green.png";
      
    } else {
      image = "../images/person-red.png";
    }
  }

  var nameStudent = ( student.name.length > 15 ? student.name.substring(0, 15) + "..." : student.name);

  return '<div onClick="showStudentDetailModal(\'' + student.id + '\')" style="cursor: pointer;" class="float-left text-center"><img width="150px" src="' + image + '"/><br>' + nameStudent  + '</div>';
}

function showCompilerResult ( ) {
  $('#compileResultModal').modal('show');
}

function showStudentDetailModal ( studentId ) {
  student = getStudent(studentId);

  if ( student == null ) {
    alert('Error: Could not find student.');
  }

  $('#studentDetailModalName').html(student.name);

  if ( student.editor ) {
    $('#studentDetailModalCode').text(student.editor.code);

  } else {
    $('#studentDetailModalCode').html('Student has not compiled yet!');
  }

  $('#studentDetailModal').modal('show');
}

// Uses the showStudentDetailModel
function showTeacherCodeModel ( data ) {
  $('#studentDetailModalName').html('Docent stuurt de volgende code (' + data.compiler + ')');
  $('#studentDetailModalCode').text(data.code);
  $('#studentDetailModal').modal('show');
}

function compileCode (event) {
  event.preventDefault();
  socket.emit('compile', { token: token, compiler: language, code: editor.getValue() });
}

function executeCode (event) {
  event.preventDefault();
  socket.emit('execute', { token: token, compiler: language, code: editor.getValue() });
}

function consoleCode (event) {
  event.preventDefault();
  socket.emit('console', { token: token, compiler: language, code: editor.getValue() });
}

function consoleClose ( ) {
  socket.emit('console-input', { command: 'stop', input:  'User closed the console' });
  $('#console-close').hide();
}

function workspacePush (event) {
  event.preventDefault();
  socket.emit('workspace-push', { token: token, compiler: language, code: editor.getValue() });
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

/* Example url: list.json (main list of different parts) 
 * example.json containing the different examples */
/* Same with challenges? Challenges also contain executable code for the
*  server in a different directory, maybe a get part that reads it. */
function getExamples () {
  alert("start");
  var t = $.get( "https://dev.codingskills.nl/learn2code/examples/list.json", function( data ) {
	   alert( "Data Loaded: " + data );
	 });
  alert(JSON.stringify(t));
  $.ajax({
    url: "https://dev.codingskills.nl/learn2code/examples/list.json",
    success: function (data) { alert("JA"); }
    });
}

/* Helper Functions */

// BUG FIX: Characters were not displayed correctly!
function getUrlVar(key){
  var result = new RegExp(key + "=([^&]*)", "i").exec(window.location.search);
  return decodeURIComponent(escape( result && unescape(result[1].replace("+", " ")) || "" ));
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

