/******************************************************
 * JMNL Innovation (c) 2018, 2019, 2020
 *
 * Version: 0.1 - beta release
 * Date   : 17-08-2018
 * Author : Maurice Snoeren
 * Email  : learn2code@jmnl.nl
 ******************************************************/

// Note: Make stats about people misusing the infrastructure by loading 100% of processes. After x times, they will be kicked out.

var cfg     = require('./conf/config.json');
var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var learn2code = require('./learn2code.js');

var workingDir = process.cwd();

// Catch all uncaught exceptions, otherwise the application breaks!
process.on('uncaughtException', function(err) {
  console.log('Uncaught exception: ' + err);
});

app.get('/', function(req, res){
  res.sendFile(workingDir + '/htdocs/index.html');
});

// serves all the static files for the main web application.
app.get(/^(.+)$/, function(req, res){ 
  res.sendFile( workingDir + "/htdocs" + req.params[0]); 
});

http.listen(cfg.webServerPort, function(){
  console.log('listening on *:' + cfg.webServerPort);
});

learn2code.startLearn2Code(io, '/learn2code');
