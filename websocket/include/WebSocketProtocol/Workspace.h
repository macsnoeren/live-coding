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
#include <mutex>

#include "server_ws.hpp"

#include "config.h"

#include "WebSocketProtocol.h"
#include "WebSocketMessage/Workspace.h"

using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

struct WorkspaceMessage {
  std::string command;
  std::string workspace;
  std::string username;
  std::string token;
  std::string data;
};

class WorkspaceConnection {

 private:
  std::shared_ptr<WebSocketServer::Connection> m_wsConnection;

  /*! This static variable is used to create a unique id. */
  static unsigned int _nextId;

  bool m_bConnected;
  bool m_bTeacher;
  
  std::string m_sIp;
  const unsigned int m_iId;

  std::string m_sUsername;
  std::string m_sToken;
  std::string m_sWorkspaceId;
  std::string m_sTeacherName;

 public:
  explicit WorkspaceConnection (std::shared_ptr<WebSocketServer::Connection> connection);
  virtual ~WorkspaceConnection ();

  std::shared_ptr<WebSocketServer::Connection> getConnection () { return this->m_wsConnection; }

  void setUsername ( std::string sUsername ) { this->m_sUsername = sUsername; }
  std::string getUsername ( ) { return this->m_sUsername; }

  void setTeacher () { this->m_bTeacher = true; }
  bool getTeacher () { return this->m_bTeacher; }
  void setTeacherName ( std::string sTeacherName ) { this->m_sTeacherName = sTeacherName; }
  std::string getTeacherName () { return this->m_sTeacherName; }
  
  std::string getToken () { return this->m_sToken; }
  void setToken (std::string token) { this->m_sToken = token; }

  void setWorkspaceId ( std::string sWorkspaceId ) { this->m_sWorkspaceId = sWorkspaceId; }
  std::string getWorkspaceId () { return m_sWorkspaceId; }
 
  std::string getId() { return std::to_string(this->m_iId); }  
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
  std::vector<WorkspaceConnection*> m_vUnknown;
  std::vector<WorkspaceConnection*> m_vTeachers;
  std::vector<WorkspaceConnection*> m_vStudents;
  std::mutex m_vMutex;
  
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

  virtual std::string generateToken(size_t len);

  virtual void newClientMessage ( WebSocketMessageWorkspace & message );

  virtual bool processMessage ( std::string & message, WorkspaceMessage & wsMessage);
  
  virtual bool executeMessage ( WorkspaceMessage & wsMessage, WorkspaceConnection * pWsConnection );

  virtual void send ( std::shared_ptr<WebSocketServer::Connection> connection, std::string & message );

  bool isMessageAvailable() { return this->m_vMessages.size() > 0; }

  WebSocketMessageWorkspace getLastMessage ();

  void printMessages ();

  std::string exec(const char* cmd);

  WorkspaceConnection* getWorkspaceConnection( std::shared_ptr<WebSocketServer::Connection> connection );

  bool deleteConnection ( std::shared_ptr<WebSocketServer::Connection> connection );
  bool deleteFromUnknown ( WorkspaceConnection * pWsConnection );
  bool moveToTeachers ( WorkspaceConnection * pWsConnection );
  bool moveToStudents ( WorkspaceConnection * pWsConnection );

  WorkspaceConnection* isExistingWorkspace ( std::string sWorkspaceId );  

};

#endif
