var Module = module.exports;
Module.sendFile = sendFile;

const io = require("socket.io-client");

const socket = io('ws://localhost:3000');

socket.on("connect", () => {
    console.log(socket.id);
});
  
socket.on("disconnect", () => {
    console.log(socket.id);
});

function sendFile( filename, data ) {
    socket.emit("file", { filename: filename, data: data });
}


console.log("compiler client module loaded.");