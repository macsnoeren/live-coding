#ifndef WEBSOCKET_PROTOCOL_WORKSPACE_H
#define WEBSOCKET_PROTOCOL_WORKSPACE_H

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

/*! The message data structure that is used to get messages from the student's
 *  and teacher's workspaces/classrooms. 
*/
struct WebSocketProtocolWorkspaceMessage {
  /* Raw Message */
  std::string raw;        // Raw data as it came to us!
  timeval timestamp; // Timestamp when the raw data came in (calculate the latency of delivery (user-friendly)
  
  /* Authentication information */
  std::string idStudent;   // ID of the workspace environment
  std::string idTeacher;   // ID of the teacher that is connected with the student
  std::string idClassroom; // ID of the teacher's classroom that has been created
  std::string ip;          // IP of the student connection
  std::string username;    // Username of the student
  std::string token;       // Token obtained at login or sign-in

  std::string message;     // The remaining message based on basic decoding
};

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
  std::list<WebSocketProtocolWorkspaceMessage> m_vMessages;
  
  void addMessage( WebSocketProtocolWorkspaceMessage & message ) { this->m_vMessages.push_back(message); }

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

  virtual void newClientMessage ( WebSocketProtocolWorkspaceMessage & message );

  bool isMessageAvailable() { return this->m_vMessages.size() > 0; }

  WebSocketProtocolWorkspaceMessage getLastMessage ();

  void printMessages ();
};

#endif
