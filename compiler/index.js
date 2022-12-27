/*********************************/
/* Compiler nodejs application   */
/*********************************/

const { spawn, exec } = require('child_process');
const io = require('socket.io')();
var fs    = require('fs');

io.on('connection', client => {
    setupClientEnvironment(client.id);
    client.on('file', (data) => { eventFile(client.id, data) });
    client.on('disconnect', (reason) => { cleanupClientEnvironment(client.id) });
});

function eventFile( clientId, data ) {
    filename = data.filename;
    contents = data.data;
    console.log("eventFile");
    console.log(clientId);
    console.log(filename);
    console.log(contents);

    // Add: Checks on filename and contents!

    fs.writeFileSync("clientenvironments/" + clientId + "/" + filename, contents);
}

function setupClientEnvironment ( clientId ) {
    console.log("Setting up client environment for client: " + clientId);
    if ( ! fs.existsSync("clientenvironments/" + clientId)) {
        fs.mkdirSync("clientenvironments/" + clientId);
    }
}

function cleanupClientEnvironment ( clientId ) {
    console.log("Cleaning up client environment for client: " + clientId);
    if ( fs.existsSync("clientenvironments/" + clientId)) {
        fs.rmSync("clientenvironments/" + clientId, { recursive: true, force: true });
    }
}

console.log("compiler running on port 3000");
io.listen(3000);

// Testing
//const io_client = require('./compiler');
//io_client.sendFile("test.java", "hallo");