#ifndef WEBSOCKET_MESSAGE_WORKSPACE_H
#define WEBSOCKET_MESSAGE_WORKSPACE_H

#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <sys/time.h>

#include "server_ws.hpp"

#include "config.h"

#include "WebSocketMessage.h"

using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

/*! \brief     This class accepts a raw connection message and decodes this message.
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      29-03-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketMessageWorkspace: public WebSocketMessage {
  
 protected:
  std::string m_sIdStudent;   // ID of the workspace environment
  std::string m_sIdTeacher;   // ID of the teacher that is connected with the student
  std::string m_sIdClassroom; // ID of the teacher's classroom that has been created
  std::string m_sIp;          // IP of the student connection
  std::string m_sUsername;    // Username of the student
  std::string m_sToken;       // Token obtained at login or sign-in
  std::string m_sMessage;     // The remaining message based on basic decoding

 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketMessageWorkspace (std::shared_ptr<WebSocketServer::Connection> pConnection, std::string sRawMessage );
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketMessageWorkspace ();

  virtual void newMessage();

  virtual std::string getMessage() { return this->m_sMessage; }
};

#endif
