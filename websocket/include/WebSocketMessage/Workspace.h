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
  /*! This static variable is used to create a unique id. */
  static unsigned int _nextId;

  //ip;username;token;idstudent;idteacher;idclassroom;command;message

  bool m_bTeacher; // Is this the teacher that is connected?

  std::string m_sIdWorkspace; // ID of the workspace environment
  std::string m_sIp;          // IP of the student connection
  std::string m_sUsername;    // Username of the student
  std::string m_sToken;       // Token obtained at login or sign-in
  std::string m_sCommand;     // The remaining message based on basic decoding
  std::string m_sMessage;     // The remaining message based on basic decoding

 public: 
  
  /*! The unique id of this object. This id is created when the class is instantiated.
   *  It is constant because the values are created by the detector and cannot be changed. */
  const unsigned int uintId;

  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketMessageWorkspace (std::shared_ptr<WebSocketServer::Connection> pConnection, std::string sRawMessage );
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketMessageWorkspace ();

  virtual void newMessage();

  virtual std::string getMessage() { return this->m_sMessage; }
};

#endif
