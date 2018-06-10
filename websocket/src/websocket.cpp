#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <algorithm> // replace

#include "config.h"
#include "RemoteServer.h"
#include "server_ws.hpp"
#include "WebSocketProtocol.h"
#include "WebSocketProtocol/Echo.h"
#include "WebSocketProtocol/Workspace.h"

using namespace std;
using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

string jsonEscape ( string json ) {
  string chars = "\\/'\"";

  for ( size_t i=0; i < json.size(); ++i ) { // Search the full string
    for ( size_t j=0; j < chars.size(); ++j ) { // Search for the special chars
      if ( json.at(i) == chars.at(j) ) { // Found char, add a slash before char and add ++i
	json = json.insert(i, "\\"); 
	++i;

      } else if ( json.at(i) == '\n' ) {
	json.at(i) = ' ';
	json.insert(i, "<br>");
	i += 4; // size of <br>
      }
    }
  }

  return json;
}

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
  if ( !rm.start() ) {
    return 0;
  }

  // Waiting compiler requests
  std::vector<WorkspaceMessage> vWaitingCompileRequests;

  while (1) {
    // Hier kan alles aan elkaar geknoopt worden. De berichten die binnenkomen verwerken en andere dingen weer aansturen.

	
    // Dispatch the messages to the remote servers if available
	int counter = 0;
    while ( p.isCompileRequestAvailable() && counter++ < 10 ) {
      WorkspaceMessage wm = p.getCompileRequest();
      	  
	  wm.data = wm.command    + ":" + 
	            wm.language   + ":" +
                wm.assignment + ":" +
 				wm.data; // Push the extra data to the remote server
		  
      //if ( rm.pushRequest(wm.token, wm.data) ) {
      if ( rm.pushRequest(wm.token, wm.data) ) {
	    vWaitingCompileRequests.push_back(wm);
	
      } else {
	    string sMessage = "{ \"command\": \"compile-error\", \"status\": \"false\", \"message\": \"ERROR: No compilers available.\" }\n";      
	    p.send2Token(wm.token, sMessage);
      }
	  
	  usleep(100);
    }

    // Dispatch the answers to the web clients is available.
	counter = 0;
    while ( rm.isAnswerAvailable() && counter++ < 10 ) {
      string sAnswer;
      string sId;

      rm.pullAnswers(sId, sAnswer);

      cout << "ANSWER(" << sId << "): " << sAnswer << endl;

      /* Search the Compiler Request */
      for ( unsigned int i=0; i < vWaitingCompileRequests.size(); ++i ) {
	    if ( vWaitingCompileRequests.at(i).token == sId ) {
	      cout << "Found compiler request, send result" << endl;
	      //sAnswer = jsonEscape(sAnswer);
	      //string sMessage = "{ \"command\": \"compiler-result\", \"status\": true, \"result\": \"" + sAnswer + "\" }\n";      

	      // sAnswer must be json
	      p.send2Token(sId, sAnswer);
	      vWaitingCompileRequests.erase( vWaitingCompileRequests.begin() + i );
	      // send also this message to teacher as student-update
	    }
      }
	  usleep(100);
    }

	//Not required anymore!
	//p.sendClientMessages();
	
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
