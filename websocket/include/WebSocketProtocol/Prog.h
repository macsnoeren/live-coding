#ifndef WEBSOCKET_PROTOCOL_PROG_H
#define WEBSOCKET_PROTOCOL_PROG_H

#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <list>

#include "server_ws.hpp"

#include "config.h"

#include "WebSocketProtocol.h"

using namespace std;
using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

struct WebSocketProtocolProgMessage {
  string raw;        // Raw data as it came to us! (id;idSchool;command;data)
  timeval timestamp; // Timestamp when the raw data came in (calculate the latency of delivery (user-friendly)
  
  string id;         // ID of the programming environment.
  string idSchool;   // ID of the school to find the devices.
  string command;    // The command that is given from the programming environment (run, stop, pause, connect, disconnect, program).
  string data;       // The data that is assiocated with the command.
};

/*! \brief     This abstract class implements a specific echo protocol
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      18-04-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketProtocolProg: public WebSocketProtocol {
  
 private:
  
 protected:
  std::list<WebSocketProtocolProgMessage> m_vMessages;
  
  void addMessage( WebSocketProtocolProgMessage & message ) { this->m_vMessages.push_back(message); }

 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketProtocolProg (WebSocketServer &server, string sEndpointName);
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketProtocolProg();

  virtual void onOpen    (shared_ptr<WebSocketServer::Connection> connection);
  virtual void onClose   (shared_ptr<WebSocketServer::Connection> connection, int status);
  virtual void onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec);
  virtual void onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message);

  bool isMessageAvailable() { return this->m_vMessages.size() > 0; }
  WebSocketProtocolProgMessage getLastMessage ();
  void printMessages ();
};

#endif
