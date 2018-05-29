#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>

#include "config.h"
#include "RemoteServer.h"
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

  // Create the RemoteServer class to start the remote server service
  RemoteServer rm(20000);
  rm.start();

  vector<WebSocketMessageWorkspace> dispatchedMessages;

  while (1) {
    // Hier kan alles aan elkaar geknoopt worden. De berichten die binnenkomen verwerken en andere dingen weer aansturen.

    // Dispatch the messages to the remote servers if available
    if ( p.isMessageAvailable() ) {
      WebSocketMessageWorkspace message = p.getLastMessage();
      string sRequest = message.getRawMessage() + "\n";
      string sId      = to_string(message.uintId);
      rm.pushRequest(sId, sRequest);
      dispatchedMessages.push_back(message);
      // Push the result back to the webservice      
    }

    // Dispatch the answers to the web clients is available.
    if ( rm.isAnswerAvailable() ) {
      string sAnswer;
      string sId;
      rm.pullAnswers(sId, sAnswer);
      cout << "ANSWER(" << sId << "): " << sAnswer << endl;

      for ( unsigned int i=0; i < dispatchedMessages.size(); ++i ) {
	WebSocketMessageWorkspace & m = dispatchedMessages.at(i);
	if ( to_string(m.uintId) == sId ) {
	  cout << "FOUND MESSAGE!" << endl;
	  // Delete the message from the vector

	  // Send to the client
	  auto send_stream = make_shared<WebSocketServer::SendStream>();
	  *send_stream << sAnswer;
	  m.getConnection()->send(send_stream);	  
	}
      }
      
    }

    /*
    string sMessage = "Dit is een bericht aan de webclients\n";
    auto send_stream = make_shared<WebSocketServer::SendStream>();
    *send_stream << sMessage;
    
    for(auto &a_connection : server.get_connections())
      a_connection->send(send_stream);
    */

    usleep(100);
  }

  server_thread.join();
}
