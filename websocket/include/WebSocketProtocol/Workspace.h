#ifndef WEBSOCKET_PROTOCOL_WORKSPACE_H
#define WEBSOCKET_PROTOCOL_WORKSPACE_H

#include <cstdio>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <list>
#include <array>

#include "server_ws.hpp"

#include "config.h"

#include "WebSocketProtocol.h"
#include "WebSocketMessage/Workspace.h"

using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

/*! \brief     This class implements the Workspace basics. Language specialisation
 *             should be done in specialized classed. Generic tests can be done
 *             with this class.
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      18-04-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketProtocolWorkspace: public WebSocketProtocol {
  
 private:
  
 protected:
  std::list<WebSocketMessageWorkspace> m_vMessages;
  
  void addMessage( WebSocketMessageWorkspace & message ) { this->m_vMessages.push_back(message); }

 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketProtocolWorkspace (WebSocketServer &server, std::string sEndpointName);
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketProtocolWorkspace();

  /* Basic low level websocket functions */
  virtual void onOpen    (std::shared_ptr<WebSocketServer::Connection> connection);
  virtual void onClose   (std::shared_ptr<WebSocketServer::Connection> connection, int status);
  virtual void onError   (std::shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec);
  virtual void onMessage (std::shared_ptr<WebSocketServer::Connection> connection, std::shared_ptr<WebSocketServer::Message> message);

  virtual void newClientMessage ( WebSocketMessageWorkspace & message );

  bool isMessageAvailable() { return this->m_vMessages.size() > 0; }

  WebSocketMessageWorkspace getLastMessage ();

  void printMessages ();

  std::string exec(const char* cmd);

};

#endif
