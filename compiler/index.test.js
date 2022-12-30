const index = require('./index');
const io = require("socket.io-client");

let socket;

beforeAll((done) => {
    done();
});

/**
 *  Cleanup WS & HTTP servers
 */
afterAll((done) => {
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
});

