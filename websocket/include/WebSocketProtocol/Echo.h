#ifndef WEBSOCKET_PROTOCOL_ECHO_H
#define WEBSOCKET_PROTOCOL_ECHO_H

#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>

#include "server_ws.hpp"

#include "config.h"

#include "WebSocketProtocol.h"

using namespace std;
using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

/*! \brief     This abstract class implements a specific echo protocol
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      18-04-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketProtocolEcho: public WebSocketProtocol {
      
 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketProtocolEcho (WebSocketServer &server, string sEndpointName);
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketProtocolEcho();

  virtual void onOpen    (shared_ptr<WebSocketServer::Connection> connection);
  virtual void onClose   (shared_ptr<WebSocketServer::Connection> connection, int status);
  virtual void onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec);
  virtual void onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message);

};

#endif
