const index = require('./index');
const io = require("socket.io-client");

let socket;

jest.setTimeout(20000);

beforeAll((done) => {
    done();
});

/**
 *  Cleanup WS & HTTP servers
 */
afterAll((done) => {
    index.io.disconnectSockets();
    index.io.close();
    done();
});

/**
 * Run before each test
 */
beforeEach((done) => {
    socket = io('ws://localhost:3001');
    done();
});

/**
 * Run after each test
 */
afterEach((done) => {
  if (socket.connected) {
    socket.disconnect();
  }
  done();
});


describe('Live coding compiler', () => {
    test('Connect to server', (done) => {
	socket.on('connect', () => {
	    expect(socket.id).toBeDefined();
	    done();
	});
    });
    
    test('Create environment', (done) => {
	let counter = 0;
	let lastMessage = "";
	socket.on('connect', () => {
	    socket.emit("create", { clientId: "testing", project: "test" });
	});
	socket.on("message", (data) => {
	    counter = counter + 1;
	    lastMessage = data;
	});

	setTimeout(() => {
	    expect(socket.id).toBeDefined();
	    expect(counter).toBe(2);
	    expect(lastMessage).toStrictEqual({clientId: "testing", message: "Ready creating environment"});
	    done();
	}, 50);
    });
    
    test('Send file', (done) => {
	const logSpy = jest.spyOn(global.console, 'log');
	let counter = 0;
	let lastMessage = "";
	socket.on('connect', () => {
	    socket.emit("create", { clientId: "testing", project: "test" });
	    socket.emit("file", { clientId: "testing", filename: "myjavaapplication.java", contents: `
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
`});
	    socket.on("message", (data) => {
		counter = counter + 1;
		lastMessage = data;
	    });
	});

	setTimeout(() => {
	    expect(socket.id).toBeDefined();
	    expect(counter).toBe(2);
	    expect(logSpy.mock.calls).toContainEqual(["eventFile: Created file 'myjavaapplication.java'"]);
	    expect(lastMessage).toStrictEqual({clientId: "testing", message: "Ready creating environment"});
	    done();
	}, 1000);
    });

    test('Compile', (done) => {
	const logSpy = jest.spyOn(global.console, 'log');
	let counter = 0;
	let lastMessage = "";
	socket.on('connect', () => {
	    socket.emit("create", { clientId: "testing", project: "test" });
	    socket.emit("file", { clientId: "testing", filename: "myjavaapplication.java", contents: `
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
`});
	});

	socket.emit("compile", { clientId: "testing" });

	socket.on("message", (data) => {
	    counter = counter + 1;
	    lastMessage = data;
	});

	setTimeout(() => {
	    expect(socket.id).toBeDefined();
	    //expect(counter).toBe(4);
	    expect(logSpy.mock.calls).toContainEqual(["Compilation success!"]);
	    expect(lastMessage).toStrictEqual({clientId: "testing", message: "Compile success"});
	    done();
	}, 2000);
    });
    
    test('Run', (done) => {
	const logSpy = jest.spyOn(global.console, 'log');
	let counter = 0;
	let lastMessage = "";
	let lastStdout;
	socket.on('connect', () => {
	    socket.emit("create", { clientId: "testing", project: "test" });
	    socket.emit("file", { clientId: "testing", filename: "myjavaapplication.java", contents: `
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
`});
	    socket.on("message", (data) => {
		counter = counter + 1;
		lastMessage = data;
	    });
	    
	    socket.on("stdout", (data) => {
		counter = counter + 1;
		lastStdout = data;
	    });

	    socket.emit("compile", { clientId: "testing" });
	    setTimeout(() => { socket.emit("run",   { clientId: "testing" });                         }, 2000);
	    setTimeout(() => { socket.emit("stdin", { clientId: "testing", stdin: "Testregel 1\n" }); }, 3000);
	    setTimeout(() => { socket.emit("stdin", { clientId: "testing", stdin: "Testregel 2\n" }); }, 4000);
	});
		
	setTimeout(() => {
	    expect(socket.id).toBeDefined();
	    expect(lastMessage).toStrictEqual({clientId: "testing", message: "Got close message from application"});
	    expect(lastStdout.output).toMatch("Testregel 2");
	    done();
	}, 6000);
    });

});

