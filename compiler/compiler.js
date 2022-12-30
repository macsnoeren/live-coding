var Module = module.exports;

Module.connect  = connect;
Module.sendFile = sendFile;
Module.create   = create;
Module.compile  = compile;
Module.run      = run;
Module.stdin    = stdin;
Module.cleanup  = cleanup;

const io = require("socket.io-client");

const socket = io('ws://localhost:3001');

function connect () {
    return myPromise = new Promise((resolve, reject) => {
	socket.on("connect", () => {
	    resolve(socket.id);	    
	});
    });
}

socket.on("stdout", (data) => {
    console.log("stdout");
    console.log(data);
});

socket.on("stderr", (data) => {
    console.log("stderr");
    console.log(data);
});

socket.on("message", (data) => {
    console.log("message");
    console.log(data);
});

socket.on("disconnect", () => {
    console.log(socket.id);
});

function create( clientId, project ) {
    socket.emit("create", { clientId: clientId, project: project });
}

function cleanup( clientId ) {
    socket.emit("cleanup", { clientId: clientId });
}

function sendFile( clientId, filename, data ) {
    socket.emit("file", { clientId: clientId, filename: filename, contents: data });
}

function compile( clientId ) {
    socket.emit("compile", { clientId: clientId } );
}

function run( clientId ) {
    socket.emit("run", { clientId: clientId } );
}

function stdin( clientId, stdin ) {
    socket.emit("stdin", { clientId: clientId, stdin: stdin } );
}

console.log("compiler client module loaded.");
