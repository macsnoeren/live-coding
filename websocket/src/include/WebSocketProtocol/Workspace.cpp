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

void WebSocketProtocolWorkspace::onClose (shared_ptr<WebSocketServer::Connection> connection, int status) {
  cout << "Server: Closed connection " << connection.get() << " with status code " << status << endl;

  WorkspaceConnection* pWsConnection = this->getWorkspaceConnection(connection);

  if ( pWsConnection != NULL ) {
    if ( pWsConnection->getTeacher() ) { // Send message to all students and remove them all including the teacher
      cout << "Teacher has been closing the connection!\n";
      string sMessage = "{ \"command\": \"teacher-quit\", \"status\": true, \"message\": \"Teacher has left the workspace!\" }\n";
      this->send2WorkspaceStudents(pWsConnection->getWorkspaceId(), sMessage);
      //this->deleteStudentsFromWorkspace(pWsConnection->getWorkspaceId()); // Cannot do this, it must be at the client!

    } else { // Send the teacher that this student has been removed
      cout << "Student has been closing the connection!\n";
      string sMessage = "{ \"command\": \"student-del\", \"status\": true, \"id\": \"" + pWsConnection->getId() + "\" }\n";
      WorkspaceConnection* pWsTeacher = this->isExistingWorkspace( pWsConnection->getWorkspaceId() ); // SEGFAULT
      if ( pWsTeacher != NULL ) {
	cout << "Existing workspace, so sending the teahcer!" << endl;
	this->send2WorkspaceTeacher(pWsConnection->getWorkspaceId(), sMessage);
      }
    }

  } else {
    cout << "CHECK: pWsConnection == NULL" << endl;
  }

  this->deleteConnection(connection);
}

void WebSocketProtocolWorkspace::onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec) {
  cout << "Server: Error in connection " << connection.get() << ". "
       << "Error: " << ec << ", error message: " << ec.message() << endl;
  this->deleteConnection(connection);
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
      string sMessage = "{ \"command\": \"" + wsMessage.command + "\"status\": false, \"message\": \"Could not execute your request!\" }\n";
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
  string token;

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

  string sMessage = "";

  if ( wsMessage.command == "teacher-start" ) {
    WorkspaceConnection* pWsTeacher = this->isExistingWorkspace( wsMessage.workspace );
    if ( pWsTeacher != NULL ) {
      cout << "Workspace already exists!!" << endl;
      sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Workspace ID already exists.\" }\n";
      this->send(pWsConnection->getConnection(), sMessage);

      return true;
    }

    pWsConnection->setUsername(wsMessage.username);
    pWsConnection->setTeacher();
    pWsConnection->setToken( this->generateToken(50) );
    pWsConnection->setWorkspaceId( wsMessage.workspace );
    
    sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": true, \"token\": \"" + pWsConnection->getToken() + "\" }\n";
    if ( !this->moveToTeachers(pWsConnection) ) {
      sMessage = "{ \"status\": false, \"message\": \"Internal error occured and could not register the user.\" }\n";
    }

    this->send(pWsConnection->getConnection(), sMessage);

    return true;

  } else if ( wsMessage.command == "student-start" ) {
    pWsConnection->setUsername(wsMessage.username);
    pWsConnection->setToken( this->generateToken(50) );

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

  } else if ( wsMessage.command == "compile-java" || wsMessage.command == "compile-java-8" ) {    
    this->addCompileRequest(wsMessage);
    sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Your request has been received...\" }\n";      
    this->send(pWsConnection->getConnection(), sMessage);
    return true;

  } else if ( wsMessage.command == "teacher-push" ) { // Teacher wants to push code
    //sMessage = ??
    //this->sendWorkspace(pWsConnection->getWorkspaceId(), "teacher-push", sMessage);

  } else {
    cout << "Could not execute the message!" << endl;
  }

  return false;
}

WorkspaceConnection* WebSocketProtocolWorkspace::getConnectionFromToken( string sToken ) {
  WorkspaceConnection* pWsConnection = NULL;

  this->m_vMutex.lock();
  for ( unsigned int i=0; i < this->m_vUnknown.size(); ++i ) {
    if ( this->m_vUnknown.at(i)->getToken() == sToken ) {
      pWsConnection = this->m_vUnknown.at(i);
      cout << "Found connection in unknown. (" << pWsConnection << ")" << endl;
      cout << "Namely 1: " << this->m_vUnknown.at(i)->getUsername() << endl;
      cout << "Namely 2: " << pWsConnection->getUsername() << endl;
      this->m_vMutex.unlock();
      return pWsConnection;
    }
  }

  for ( unsigned int i=0; i < this->m_vTeachers.size(); ++i ) {
    if ( sToken == this->m_vTeachers.at(i)->getToken() ) {
      pWsConnection = this->m_vTeachers.at(i);
      cout << "Found connection in teacher." << endl;
      this->m_vMutex.unlock();
      return pWsConnection;
    }
  }

  for ( unsigned int i=0; i < this->m_vStudents.size(); ++i ) {
    if ( sToken == this->m_vStudents.at(i)->getToken() ) {
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

bool WebSocketProtocolWorkspace::send2Token(string sToken, string sMessage) {
  cout << "Send message to token " << sToken << endl;

  WorkspaceConnection* pWsConnection = this->getConnectionFromToken(sToken);

  if ( pWsConnection != NULL ) {
    this->send(pWsConnection->getConnection(), sMessage);
    return true;

  } else {
    return false;
  }
}


WorkspaceConnection*  WebSocketProtocolWorkspace::isExistingWorkspace ( string sWorkspaceId ) {
  WorkspaceConnection * pWsTeacher = NULL;

  this->m_vMutex.lock();

  for ( auto it = this->m_vTeachers.begin(); it != this->m_vTeachers.end(); ++it ) {
    cout << "Get workspace ID" << endl;
    cout << (*it)->getConnection() << " <----" << endl;
    if ( (*it)->getWorkspaceId() == sWorkspaceId ) { // SEGFAULT: getWorkspaceId();
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
  cout << "--------------------------------" << endl;

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

    cout << "--------------------------------" << endl;

    // Get the data
    wsMessage.data = message.substr(pos+1, message.length() - pos);
    cout << "Found data: " << wsMessage.data << endl;

  } else {
    wsMessage.token = message.substr(posPrev, message.length() - posPrev);
  }  

  cout << "--------------------------------" << endl;
  
  return true;
}

void WebSocketProtocolWorkspace::send2WorkspaceStudents ( std::string sWorkspace, std::string sMessage ) {
  this->m_vMutex.lock();

  for ( unsigned int i=0; i < this->m_vStudents.size(); ++i ) {
    if ( this->m_vStudents.at(i)->getWorkspaceId() == sWorkspace ) {
      this->send( this->m_vStudents.at(i)->getConnection(), sMessage );
    }
  }

  this->m_vMutex.unlock();
}

// Do not use this function!
void WebSocketProtocolWorkspace::deleteStudentsFromWorkspace ( std::string sWorkspace ) {
  this->m_vMutex.lock();

  for (auto it = this->m_vStudents.begin(); it != this->m_vStudents.end(); ) {
    if ( (*it)->getWorkspaceId() == sWorkspace ) {
      it = this->m_vStudents.erase(it);
      delete *it;
      
    } else {
      ++it;
    }
  }

  this->m_vMutex.unlock();
}

void WebSocketProtocolWorkspace::send2WorkspaceTeacher ( std::string sWorkspace, std::string sMessage ) {
  cout << "send 2 teacher" << endl;
  this->m_vMutex.lock();

  for ( unsigned int i=0; i < this->m_vTeachers.size(); ++i ) {
    cout << "Teacher" << endl;
    if ( this->m_vTeachers.at(i)->getWorkspaceId() == sWorkspace ) {
      cout << "found a teacher" << endl;
      this->send( this->m_vTeachers.at(i)->getConnection(), sMessage );
    }
  }

  this->m_vMutex.unlock();
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
