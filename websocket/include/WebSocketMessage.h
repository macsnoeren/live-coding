#ifndef WEBSOCKET_MESSAGE_H
#define WEBSOCKET_MESSAGE_H

#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <sys/time.h>

#include "server_ws.hpp"

#include "config.h"

using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

/*! \brief     This class accepts a raw connection message and decodes this message.
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      29-03-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketMessage {
  
 protected:

  std::shared_ptr<WebSocketServer::Connection> m_pConnection;
  const std::string m_sRawMessage;
  timeval           m_tvTimestamp;
    
 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketMessage (std::shared_ptr<WebSocketServer::Connection> pConnection, std::string sRawMessage );
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketMessage();

  std::string getRawMessage () { return this->m_sRawMessage; }

  void sendClientMessage ( std::string sMessage );

};

#endif
