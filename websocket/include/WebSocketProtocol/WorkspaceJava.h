#ifndef WEBSOCKET_PROTOCOL_WORKSPACE_JAVA_H
#define WEBSOCKET_PROTOCOL_WORKSPACE_JAVA_H

#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <list>

#include "server_ws.hpp"

#include "config.h"

#include "WebSocketProtocol.h"

using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

/*! \brief     This class implements the JAVA live workspace environment.
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      18-04-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketProtocolWorkspaceJava: public WebSocketProtocol {
  
 private:
  
 protected:  

 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketProtocolWorkspaceJava (WebSocketServer &server, string sEndpointName);
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketProtocolWorkspaceJava();

};

#endif
