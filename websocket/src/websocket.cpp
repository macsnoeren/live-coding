#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>

#include "config.h"
#include "server_ws.hpp"
#include "WebSocketProtocol.h"
#include "WebSocketProtocol/Echo.h"
#include "WebSocketProtocol/Workspace.h"

using namespace std;
using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

int main() {
  WebSocketServer server;
  server.config.port = 3000;

  WebSocketProtocolEcho e(server, "echo");
  WebSocketProtocolWorkspace p(server, "workspace");

  thread server_thread([&server]() {
    // Start WS-server
    server.start();
  });

  // Wait for server to start so that the client can connect
  this_thread::sleep_for(chrono::seconds(1));

  cout << "Server started" << endl;

  while (1) {
    // Hier kan alles aan elkaar geknoopt worden. De berichten die binnenkomen verwerken en andere dingen weer aansturen.
    
    //    p.printMessages();

    sleep(0);
  }

  server_thread.join();
}
