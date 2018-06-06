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

/*! Search the connection in the WorkspaceConnection arrays */
WorkspaceConnection * WebSocketProtocolWorkspace::getWorkspaceConnection ( std::shared_ptr<WebSocketServer::Connection> connection ) {
  WorkspaceConnection* pWsConnection = NULL;

  this->m_vMutex.lock();
  
  for ( unsigned int i=0; i < this->m_vUnknown.size(); ++i ) {
    if ( this->m_vUnknown.at(i)->getConnection() == connection ) {
      pWsConnection = this->m_vUnknown.at(i);
      cout << "getWorkspaceConnection: Found connection in unknown. (" << pWsConnection << ")" << endl;
    }
  }

  for ( unsigned int i=0; i < this->m_vTeachers.size(); ++i ) {
    if ( connection == this->m_vTeachers.at(i)->getConnection() ) {
      pWsConnection = this->m_vTeachers.at(i);
      cout << "getWorkspaceConnection: Found connection in teacher." << endl;
    }
  }

  for ( unsigned int i=0; i < this->m_vStudents.size(); ++i ) {
    if ( connection == this->m_vStudents.at(i)->getConnection() ) {
      pWsConnection = this->m_vStudents.at(i);
      cout << "getWorkspaceConnection: Found connection in student." << endl;
    }
  }

  this->m_vMutex.unlock();

  if ( pWsConnection == NULL ) {
	cout << "getWorkspaceConnection: Did not find any connection." << endl;
  }

  return pWsConnection;
}  

/*! A connection is opened. While it is not connected to any workspace, it
 *  should be pushed to the WorkspaceConnection Unknown array */
void WebSocketProtocolWorkspace::onOpen (shared_ptr<WebSocketServer::Connection> connection) {
  cout << "onOpen: Opened a connection with connection ID " << connection.get() << endl;

  WorkspaceConnection* pWsConnection = new WorkspaceConnection(connection);

  this->m_vUnknown.push_back(pWsConnection);
}

/*! A connection closed the connection and therefore it is required to be removed from the 
 *  WorkspaceConnection Arrays. When a student is closed, the teacher needs to be 
 *  updated. When a teacher leaves, its students needs to be updated. */
void WebSocketProtocolWorkspace::onClose (shared_ptr<WebSocketServer::Connection> connection, int status) {
  cout << "onClose: A connection has issued to close the connection " << connection.get() << " with status code " << status << endl;

  WorkspaceConnection* pWsConnection = this->getWorkspaceConnection(connection);

  cout << "onClose: Found WsConnection: " << (pWsConnection == NULL ? "No" : "Yes") << endl;
  
  if ( pWsConnection != NULL ) {
    bool   bTeacher   = pWsConnection->getTeacher();
	string sWorkspace = pWsConnection->getWorkspaceId(); 
	string  sId        = pWsConnection->getId();
	
    this->deleteConnection(connection);
	  
    if ( bTeacher ) { // Send message to all students and remove them all including the teacher
      cout << "onClose: Notify the students that the teacher has left the workspace!\n";
      string sMessage = "{ \"command\": \"teacher-quit\", \"status\": true, \"message\": \"Teacher has left the workspace!\" }\n";
      this->send2WorkspaceStudents(sWorkspace, sMessage);

    } else { // Send the teacher that this student has been removed
      cout << "onClose: Notify the teacher that the student has left the workspace!\n";
      string sMessage = "{ \"command\": \"student-del\", \"status\": true, \"id\": \"" + pWsConnection->getId() + "\" }\n";
      WorkspaceConnection* pWsTeacher = this->isExistingWorkspace( sWorkspace );
	  
      if ( pWsTeacher != NULL ) {
		cout << "onClose: Existing workspace, so notify the teacher!" << endl;
		this->send2WorkspaceTeacher(sWorkspace, sMessage);
		
      } else {
		cout << "onClose: Workspace does not exist, teacher has left the building already!" << endl;		  
	  }
    }

  } else {
    cout << "onClose: The closed connection is not found, so we do not need to do anything!" << endl;
  }
}

/*! A connection has issued an error, so we should clean it up. */
void WebSocketProtocolWorkspace::onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec) {
  cout << "onError: Connection has issued an error in the connection: " << connection.get() << ". "
       << "Error: " << ec << ", error message: " << ec.message() << endl;

  WorkspaceConnection* pWsConnection = this->getWorkspaceConnection(connection);
	   
  if ( pWsConnection != NULL ) {
	cout << "onError: Connection is found, so delete it." << endl;
    this->deleteConnection(connection);
	
  } else {
	cout << "onError: Connection is not found, so we do not need to do anything." << endl;
  }
}

/*! Send a message to a connection. */
void WebSocketProtocolWorkspace::send (shared_ptr<WebSocketServer::Connection> connection, string & message ) {
  cout << "send: Sending message to the client :'" << message << "'" << endl;
  auto send_stream = make_shared<WebSocketServer::SendStream>();
  *send_stream << message;
  connection->send(send_stream);
}

/*! A connection has send a message to the server! Process it! */
void WebSocketProtocolWorkspace::onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message) {

  WorkspaceConnection * pWsConnection = this->getWorkspaceConnection( connection );
  if ( pWsConnection == NULL  ) {
    cout << "onMessage: Got a message from a connection and could not find this connection! Create a connection?" << endl;
    string sMessage = "{ \"status\": false, \"message\": \"You are not authorized to send data!\" }\n";
    this->send(connection, sMessage);
    return;
  }

  cout << "onMessage: Connection '" << pWsConnection->getUsername() << "' (" << pWsConnection << ")" << endl;

  string sMessage = message->string();
  WorkspaceMessage wsMessage;
  if ( this->processMessage(sMessage, wsMessage) ) {
    if ( !this->executeMessage(wsMessage, pWsConnection) ) {
      cout << "onMessage: Could not execute the request!" << endl;
      string sMessage = "{ \"command\": \"" + wsMessage.command + "\"status\": false, \"message\": \"Could not execute your request!\" }\n";
      this->send(connection, sMessage);
    }

  } else {
    cout << "onMessage: Could not process the request!" << endl;
    string sMessage = "{ \"status\": false, \"message\": \"Could not process your request!\" }\n";
    this->send(connection, sMessage);
  }
}

/*! Generate a random token for the check of the clients. */
string WebSocketProtocolWorkspace::generateToken(size_t len) {
  string token;

  const string chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  
  for ( size_t i=0; i < len; ++i ) {
    size_t pos = (size_t) rand() % (size_t) (chars.length()-1);
    token.insert(i, 1, chars[pos]);
  }

  cout << "generateToken: Generated token: " << token << endl;

  return token;
}

/*! The message has been decoded in a request. This function executes the request from
 *  the client. */
bool WebSocketProtocolWorkspace::executeMessage ( WorkspaceMessage & wsMessage, WorkspaceConnection * pWsConnection ) {
  string sMessage = "";

  if ( wsMessage.command == "teacher-start" ) {
    // TODO: WorkspaceConnection must be added with role (unknown, teacher, student) Check if it has a unknown role
    WorkspaceConnection* pWsTeacher = this->isExistingWorkspace( wsMessage.workspace );
    if ( pWsTeacher != NULL ) {
      cout << "executeMessage: There is already a teacher that has created workspace: " << wsMessage.workspace << endl;
      sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Workspace already exists.\" }\n";
      this->send(pWsConnection->getConnection(), sMessage);
      return true;
    }

	cout << "executeMessage: Teacher wants to create a new workspace: " << wsMessage.workspace << endl;
	
    pWsConnection->setWorkspaceId( wsMessage.workspace );
    pWsConnection->setUsername(wsMessage.username);
    pWsConnection->setTeacher();
    pWsConnection->setToken( this->generateToken(50) );
    
    sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": true, \"token\": \"" + pWsConnection->getToken() + "\" }\n";
    if ( this->moveToTeachers(pWsConnection) ) {
	  cout << "onMessage: Notify the students that the teacher has come in again!\n";
      string sMessage = "{ \"command\": \"teacher-joined\", \"status\": true, \"message\": \"Teacher has left the workspace!\" }\n";
      this->send2WorkspaceStudents(wsMessage.workspace, sMessage);
	  
	} else {
      sMessage = "{ \"status\": false, \"message\": \"Internal error occurred and could not register the user.\" }\n";
    }

    this->send(pWsConnection->getConnection(), sMessage);
    return true;

  } else if ( wsMessage.command == "student-start" ) {
    // TODO: WorkspaceConnection must be added with role (unknown, teacher, student) Check if it has a unknown role, replace code below
	if ( pWsConnection->getTeacher() ) {
      cout << "executeMessage: A teacher cannot start a student workspace." << endl;
      sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"An illegal action occurred.\" }\n";
      this->send(pWsConnection->getConnection(), sMessage);
      return true;
    }	  

    WorkspaceConnection* pWsTeacher = this->isExistingWorkspace( wsMessage.workspace );
    if ( pWsTeacher == NULL ) {
      cout << "executeMessage: Student wants to join a non-existing workspace!" << endl;
      sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Workspace does not exist!\" }\n"; 
      this->send(pWsConnection->getConnection(), sMessage);
      return true;	  
	}
	
	cout << "executeMessage: Student wants to connect to the workspace: " << wsMessage.workspace << endl;
	
	pWsConnection->setWorkspaceId(wsMessage.workspace);
    pWsConnection->setUsername(wsMessage.username);
    pWsConnection->setToken( this->generateToken(50) );
    pWsConnection->setTeacherName(pWsTeacher->getUsername());

    if ( this->moveToStudents(pWsConnection) ) {
	  // Update the teacher!
	  sMessage = "{ \"command\": \"student-new\", \"workspace\": \"" + wsMessage.workspace + "\", \"name\": \"" + pWsConnection->getUsername() + "\", \"id\": \"" + pWsConnection->getId() + "\" }\n";
	  this->send(pWsTeacher->getConnection(), sMessage);

	  sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": true, \"token\": \"" + pWsConnection->getToken() + "\", \"workspace\": \"" + wsMessage.workspace + "\", \"teacher\": \"" + pWsConnection->getTeacherName() + "\" }\n";
      this->send(pWsConnection->getConnection(), sMessage);
      
    } else {
	  cout << "executeMessage: Could not move to the students." << endl;
	  sMessage = "{ \"command\": \"" + wsMessage.command + "\", \"status\": false, \"message\": \"Internal error occurred and could not register the user.\" }\n";
      this->send(pWsConnection->getConnection(), sMessage);

    }

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
    cout << (*it)->getUsername() << " <----" << endl;
    cout << (*it)->getWorkspaceId() << " <----" << endl;
    if ( (*it)->getWorkspaceId() == sWorkspaceId ) { // SEGFAULT: getWorkspaceId();
      pWsTeacher = (*it);
    }
  }  

  this->m_vMutex.unlock();
  
  return pWsTeacher;
}


// BUG: erase returns next iterator it and that one is deleted!!
bool WebSocketProtocolWorkspace::deleteConnection ( std::shared_ptr<WebSocketServer::Connection> connection ) {

  WorkspaceConnection* pWsConnection = NULL;

  this->m_vMutex.lock();
  for (auto it = this->m_vUnknown.begin(); it != this->m_vUnknown.end(); ) {
    pWsConnection = (*it);
    if ( pWsConnection->getConnection() == connection ) {
      it = this->m_vUnknown.erase(it);
      delete pWsConnection;

    } else {
      ++it;
    }
  }

  for (auto it = this->m_vTeachers.begin(); it != this->m_vTeachers.end(); ) {
    pWsConnection = (*it);
    if ( pWsConnection->getConnection() == connection ) {
      it = this->m_vTeachers.erase(it);
      delete pWsConnection;

    } else {
      ++it;
    }
  }

  for (auto it = this->m_vStudents.begin(); it != this->m_vStudents.end(); ) {
    pWsConnection = (*it);
    if ( pWsConnection->getConnection() == connection ) {
      it = this->m_vStudents.erase(it);
      delete pWsConnection;

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
    if ( (*it) == pWsConnection ) {
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
      //this->addClientMessage( this->m_vStudents.at(i)->getConnection(), sMessage );
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
      //this->addClientMessage( this->m_vTeachers.at(i)->getConnection(), sMessage );
    }
  }

  this->m_vMutex.unlock();
}

// Below function created to check if sending should be outside the onXXX function, this was not the bug!
void WebSocketProtocolWorkspace::addClientMessage ( std::shared_ptr<WebSocketServer::Connection> connection, std::string sMessage ) {
  WorkspaceClientMessage wcm;
  wcm.connection = connection;
  wcm.message    = sMessage;
  this->m_vClientMessages.push(wcm);
}

void WebSocketProtocolWorkspace::sendClientMessages () {
  while (!this->m_vClientMessages.empty()) {
    cout << "sendClientMessages: send message to a client." << endl;	  
    WorkspaceClientMessage wcm = this->m_vClientMessages.front();
    this->m_vClientMessages.pop();
    this->send(wcm.connection, wcm.message);
  }
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
