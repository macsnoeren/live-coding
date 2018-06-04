#include "WebSocketProtocol/Workspace.h"

using namespace std;

unsigned int WorkspaceConnection::_nextId = 0; // Declaration of static value.

WorkspaceConnection::WorkspaceConnection ( std::shared_ptr<WebSocketServer::Connection> connection ): m_wsConnection(connection), m_iId(WorkspaceConnection::_nextId++) {
  this->m_sIp          = "";
  this->m_bConnected   = false;
  this->m_bTeacher     = false;
  this->m_sUsername    = "unknown";
  this->m_sToken       = "";
  this->m_sWorkspaceId = "";
  this->m_sTeacherName = "";
}

WorkspaceConnection::~WorkspaceConnection ( ) {

}

/********************/

WebSocketProtocolWorkspace::WebSocketProtocolWorkspace (WebSocketServer &server, string sEndpointName): WebSocketProtocol(server, sEndpointName) {
  
}

WebSocketProtocolWorkspace::~WebSocketProtocolWorkspace() {
  this->m_vMutex.lock();
  for ( unsigned int i=0; i < this->m_vUnknown.size(); ++i ) {
    WorkspaceConnection* pWsConnection = this->m_vUnknown.at(i);
    delete pWsConnection;
  }
  this->m_vUnknown.clear();

  for ( unsigned int i=0; i < this->m_vTeachers.size(); ++i ) {
    WorkspaceConnection* pWsConnection = this->m_vTeachers.at(i);
    delete pWsConnection;
  }
  this->m_vTeachers.clear();

  for ( unsigned int i=0; i < this->m_vStudents.size(); ++i ) {
    WorkspaceConnection* pWsConnection = this->m_vStudents.at(i);
    delete pWsConnection;
  }
  this->m_vStudents.clear();

  this->m_vMutex.unlock();
}  

WorkspaceConnection * WebSocketProtocolWorkspace::getWorkspaceConnection ( std::shared_ptr<WebSocketServer::Connection> connection ) {
  WorkspaceConnection* pWsConnection = NULL;

  this->m_vMutex.lock();
  for ( unsigned int i=0; i < this->m_vUnknown.size(); ++i ) {
    if ( this->m_vUnknown.at(i)->getConnection() == connection ) {
      pWsConnection = this->m_vUnknown.at(i);
      cout << "Found connection in unknown. (" << pWsConnection << ")" << endl;
      cout << "Namely 1: " << this->m_vUnknown.at(i)->getUsername() << endl;
      cout << "Namely 2: " << pWsConnection->getUsername() << endl;
      this->m_vMutex.unlock();
      return pWsConnection;
    }
  }

  for ( unsigned int i=0; i < this->m_vTeachers.size(); ++i ) {
    if ( connection == this->m_vTeachers.at(i)->getConnection() ) {
      pWsConnection = this->m_vTeachers.at(i);
      cout << "Found connection in teacher." << endl;
      this->m_vMutex.unlock();
      return pWsConnection;
    }
  }

  for ( unsigned int i=0; i < this->m_vStudents.size(); ++i ) {
    if ( connection == this->m_vStudents.at(i)->getConnection() ) {
      pWsConnection = this->m_vStudents.at(i);
      cout << "Found connection in student." << endl;
      this->m_vMutex.unlock();
      return pWsConnection;
    }
  }

  this->m_vMutex.unlock();

  cout << "Did not find any connection." << endl;

  return NULL;
}  

void WebSocketProtocolWorkspace::onOpen (shared_ptr<WebSocketServer::Connection> connection) {
  cout << "Server: Opened connection " << connection.get() << endl;

  WorkspaceConnection* pWsConnection = new WorkspaceConnection(connection);
  this->m_vUnknown.push_back(pWsConnection);
  this->printMessages();
}

void WebSocketProtocolWorkspace::onClose   (shared_ptr<WebSocketServer::Connection> connection, int status) {
  cout << "Server: Closed connection " << connection.get() << " with status code " << status << endl;
  this->deleteConnection(connection);
}

void WebSocketProtocolWorkspace::onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec) {
  cout << "Server: Error in connection " << connection.get() << ". "
       << "Error: " << ec << ", error message: " << ec.message() << endl;
  //this->deleteConnection(connection);
}

void WebSocketProtocolWorkspace::send (shared_ptr<WebSocketServer::Connection> connection, string & message ) {
  cout << "Sending message to the client :'" << message << "'" << endl;
  auto send_stream = make_shared<WebSocketServer::SendStream>();
  *send_stream << message;
  connection->send(send_stream);
}

void WebSocketProtocolWorkspace::onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message) {

  WorkspaceConnection * pWsConnection = this->getWorkspaceConnection( connection );
  if ( pWsConnection == NULL  ) {
    cout << "Could not find this connection!" << endl;
    string sMessage = "{ \"status\": false, \"message\": \"You are not authorized to send data!\" }\n";
    this->send(connection, sMessage);
    return;
  }

  cout << "Found connection (" << pWsConnection << ")" << endl;
  cout << "Found connection: " << pWsConnection->getUsername() << endl;

  string sMessage = message->string();
  WorkspaceMessage wsMessage;
  if ( this->processMessage(sMessage, wsMessage) ) {
    if ( !this->executeMessage(wsMessage, pWsConnection) ) {
      cout << "Could not execute the request!" << endl;
      string sMessage = "{ \"status\": false, \"message\": \"Could not execute your request!\" }\n";
      this->send(connection, sMessage);
    }

  } else {
    cout << "Could not process the request!" << endl;
    string sMessage = "{ \"status\": false, \"message\": \"Could not process your request!\" }\n";
    this->send(connection, sMessage);
  }

  //string message_str = message->string();
  //WebSocketMessageWorkspace m(connection, message_str);
  // Check if the message is valid, if not do not push it to the newclient message function.

  this->printMessages();
}

string WebSocketProtocolWorkspace::generateToken(size_t len) {
  string token(len, ' ');

  const string chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  
  for ( size_t i=0; i < len; ++i ) {
    size_t pos = (size_t) rand() % (size_t) (chars.length()-1);
    token.insert(i, 1, chars[pos]);
  }

  cout << "Generated token: " << token << endl;

  return token;
}

bool WebSocketProtocolWorkspace::executeMessage ( WorkspaceMessage & wsMessage, WorkspaceConnection * pWsConnection ) {
  cout << "Execute message....\n";
  if ( wsMessage.command == "teacher-start" ) {
    pWsConnection->setUsername(wsMessage.username);
    pWsConnection->setTeacher();
    pWsConnection->setToken( this->generateToken(50) );
    pWsConnection->setWorkspaceId( wsMessage.workspace );
    
    string sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": true, \"token\": \"" + pWsConnection->getToken() + "\" }\n";
    if ( !this->moveToTeachers(pWsConnection) ) {
      sMessage = "{ \"status\": false, \"message\": \"Internal error occured and could not register the user.\" }\n";
    }

    this->send(pWsConnection->getConnection(), sMessage);

    return true;

  } else if ( wsMessage.command == "student-start" ) {
    pWsConnection->setUsername(wsMessage.username);
    pWsConnection->setToken( this->generateToken(50) );

    string sMessage = "";

    WorkspaceConnection* pWsTeacher = this->isExistingWorkspace( wsMessage.workspace );
    cout << "Check if the workspace exist" << endl;
    if ( pWsTeacher != NULL ) {
      cout << "Existing workspace!" << endl;
      pWsConnection->setTeacherName(pWsTeacher->getUsername());
      pWsConnection->setWorkspaceId( wsMessage.workspace );

      if ( this->moveToStudents(pWsConnection) ) {
	// Update the teacher
	// TODO: UNIQUE USER ID!! => Connection ID??
	sMessage = "{ \"command\": \"student-new\", \"workspace\": \"" + wsMessage.workspace + "\", \"name\": \"" + pWsConnection->getUsername() + "\", \"id\": \"" + pWsConnection->getId() + "\" }\n";
	this->send(pWsTeacher->getConnection(), sMessage);

	sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": true, \"token\": \"" + pWsConnection->getToken() + "\", \"workspace\": \"" + wsMessage.workspace + "\", \"teacher\": \"" + pWsConnection->getTeacherName() + "\" }\n";
      
      } else {
	cout << "Could not move to the students." << endl;
	sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Internal error occured and could not register the user.\" }\n";
      }
    } else { // Not existing workspace
      cout << "Not existing workspace!" << endl;
      sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Workspace does not exist!\" }\n";      
    }

    this->send(pWsConnection->getConnection(), sMessage);

    return true;

  } else {
    cout << "Could not execute the message!" << endl;
  }

  return false;
}

WorkspaceConnection*  WebSocketProtocolWorkspace::isExistingWorkspace ( std::string sWorkspaceId ) {
  WorkspaceConnection * pWsTeacher = NULL;

  this->m_vMutex.lock();

  for ( auto it = this->m_vTeachers.begin(); it != this->m_vTeachers.end(); ++it ) {
    if ( (*it)->getWorkspaceId() == sWorkspaceId ) {
      pWsTeacher = (*it);
    }
  }  

  this->m_vMutex.unlock();
  
  return pWsTeacher;
}


bool WebSocketProtocolWorkspace::deleteConnection ( std::shared_ptr<WebSocketServer::Connection> connection ) {

  this->m_vMutex.lock();
  for (auto it = this->m_vUnknown.begin(); it != this->m_vUnknown.end(); ) {
    if ( (*it)->getConnection() == connection ) {
      it = this->m_vUnknown.erase(it);
      delete *it;

    } else {
      ++it;
    }
  }

  for (auto it = this->m_vTeachers.begin(); it != this->m_vTeachers.end(); ) {
    if ( (*it)->getConnection() == connection ) {
      it = this->m_vTeachers.erase(it);
      delete *it;

    } else {
      ++it;
    }
  }

  for (auto it = this->m_vStudents.begin(); it != this->m_vStudents.end(); ) {
    if ( (*it)->getConnection() == connection ) {
      it = this->m_vStudents.erase(it);
      delete *it;

    } else {
      ++it;
    }
  }
  this->m_vMutex.unlock();

  return true;
}

bool WebSocketProtocolWorkspace::deleteFromUnknown ( WorkspaceConnection * pWsConnection ) {
  this->m_vMutex.lock();
  for (auto it = this->m_vUnknown.begin(); it != this->m_vUnknown.end(); ) {
    if ( *it == pWsConnection ) {
      it = this->m_vUnknown.erase(it);
      this->m_vMutex.unlock();
      return true;

    } else {
      ++it;
    }
  }
  this->m_vMutex.unlock();

  return false;
}

bool WebSocketProtocolWorkspace::moveToTeachers ( WorkspaceConnection * pWsConnection ) {
  if ( !this->deleteFromUnknown(pWsConnection) )
    return false;

  this->m_vMutex.lock();
  this->m_vTeachers.push_back(pWsConnection);
  this->m_vMutex.unlock();

  return true;
}

bool WebSocketProtocolWorkspace::moveToStudents ( WorkspaceConnection * pWsConnection ) {
  if ( !this->deleteFromUnknown(pWsConnection) )
    return false;

  this->m_vMutex.lock();
  this->m_vStudents.push_back(pWsConnection);
  this->m_vMutex.unlock();

  return true;
}

WebSocketMessageWorkspace WebSocketProtocolWorkspace::getLastMessage () {
  WebSocketMessageWorkspace message = this->m_vMessages.front();
  this->m_vMessages.pop_front();

  return message;
}

void WebSocketProtocolWorkspace::printMessages () {
  for (auto v : this->m_vMessages) {
    std::cout << "=> " << v.getRawMessage() << "\n";
  }

  cout << "Connections:\n-Unknown: " << this->m_vUnknown.size() << "\n-Teachers: " << 
    this->m_vTeachers.size() << "\n-Students: " << this->m_vStudents.size() << endl;
}

void WebSocketProtocolWorkspace::newClientMessage ( WebSocketMessageWorkspace & message ) {
  
  



  this->addMessage(message);
}

bool WebSocketProtocolWorkspace::processMessage ( string & message, WorkspaceMessage & wsMessage) {
  cout << "Processing message '" << message << "'" << endl;

  if ( message.at(message.length()-1) == '\n' ) {
    message = message.substr(0, message.length()-1);
  }

  size_t pos = 0;
  size_t posPrev = 0;
  string token   = ";";

  // Find command
  pos = message.find(token, posPrev);
  if ( pos == string::npos )
    return false;

  wsMessage.command = message.substr(posPrev, pos - posPrev);
  posPrev = pos + 1;
  cout << "Found command: " << wsMessage.command << endl;

  // Find workspace ID
  pos = message.find(token, posPrev);
  if ( pos == string::npos )
    return false;

  wsMessage.workspace = message.substr(posPrev, pos - posPrev);
  posPrev = pos + 1;
  cout << "Found workspace: " << wsMessage.workspace << endl;

  // Find username
  pos = message.find(token, posPrev);
  if ( pos == string::npos )
    return false;

  wsMessage.username = message.substr(posPrev, pos - posPrev);
  posPrev = pos + 1;
  cout << "Found username: " << wsMessage.username << endl;

  // Find token
  pos = message.find(token, posPrev);
  if ( pos != string::npos ) {
    wsMessage.token = message.substr(posPrev, pos - posPrev);
    cout << "Found token: " << wsMessage.token << endl;

    // Get the data
    wsMessage.data = message.substr(pos+1, message.length() - pos);
    cout << "Found data: " << wsMessage.data << endl;

  } else {
    wsMessage.token = message.substr(posPrev, message.length() - posPrev);
  }  
  
  return true;
}

// For testing only!
string WebSocketProtocolWorkspace::exec (const char* cmd) {
  array<char, 128> buffer;
  string result;
  shared_ptr<FILE> pipe(popen(cmd, "r"), pclose);

  if (!pipe) throw std::runtime_error("popen() failed!");

  while (!feof(pipe.get())) {
    if (fgets(buffer.data(), 128, pipe.get()) != nullptr)
      result += buffer.data();
  }

  return result;
}
