var Module = module.exports;

Module.sendFile = sendFile;
Module.create   = create;
Module.compile  = compile;
Module.run      = run;
Module.stdin    = stdin;
Module.cleanup  = cleanup;

const io = require("socket.io-client");

const socket = io('ws://localhost:3001');

socket.on("connect", () => {
    console.log(socket.id);

    // For automatic testing
    create("client-id-123", "MyJavaApplication");
    sendFile("client-id-123", "myjavaapplication.java", `
import static java.lang.System.*;
import java.util.Scanner;

class MyJavaApplication {
    public static void main(String[] args) {
        System.out.println("Hello, World!"); 
        Scanner scanner = new Scanner(System.in);
        for ( int i=0; i < 2; i++ ) {
            System.out.println( scanner.nextLine() );
        }
    }
}
`);
    compile("client-id-123");
    setTimeout(() => {run("client-id-123");}, 2000);    
    setTimeout(() => {stdin("client-id-123", "test\n");}, 4000);    
    setTimeout(() => {stdin("client-id-123", "test\n");}, 6000);    
    setTimeout(() => {stdin("client-id-123", "test\n");}, 8000);    
    setTimeout(() => {stdin("client-id-123", "test\n");}, 10000);    
    setTimeout(() => {stdin("client-id-123", "test\n");}, 12000);    
    //cleanup("client-id-123");
});

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
