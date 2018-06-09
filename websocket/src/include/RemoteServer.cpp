#include "RemoteServer.h"

using namespace std;

// TODO: check when connection is dead! repush the message on the stack!
void _threadClientMain ( RemoteServer* rs, struct sockaddr_in sClientAddr, int iClientFd ) {
  cout << "_threadClientMain: Thread client started!\n";

  rs->_clientThreadStarted();
  
  printf("_threadClientMain: RemoteServer: got connection from %s port %d\n",
	 inet_ntoa(sClientAddr.sin_addr), ntohs(sClientAddr.sin_port));

  bool bActiveConnection    = true;
  int  counterAliveMessages = 0;
  
  const int bufferLength = 8096;
  char buffer[bufferLength];

  while ( rs->isRunning() && bActiveConnection ) {
    string sRequest;
    string sId;

    // TODO: Extend pull request and answer with command and param that can be compile and execution
    //       For different kind of compilers. And also console access ;) for access ;).

    if ( rs->pullRequest(sId, sRequest) ) {
      cout << "_threadClientMain: RemoteServer: Got request and sending it to the remote client that is connected!\n";

      int n = send(iClientFd, sRequest.c_str(), sRequest.size(), 0);

  	  cout << "_threadClientMain: SEND n = '" << n << "'" << endl;	  

      bzero(buffer, bufferLength);

      // TODO: Reading large data when buffer is to small needs to be done
      // TODO: Request should have an ID so it can be identified to which workspace it should
      //       be sent.
      n = read(iClientFd, buffer, bufferLength-1);

	  cout << "_threadClientMain: READ n = '" << n << "'" << endl;
	  
      if ( n <= 0 ) {
	    rs->error("_threadClientMain: ERROR reading from socket");
	    bActiveConnection = false;
		string sMessage = "{ \"command\": \"compiler-result\", \"status\": false, \"result\": \"Internal compiler error occurred, please try again\"}";
		rs->pushAnswers(sId, sMessage);

      } else {
	    cout << "_threadClientMain: RemoteServer: Got answer from remote client on request!\n";
	    printf("_threadClientMain: Answer:\n %s\n---------------\n", buffer);

	    string sAnswer = buffer;

	    rs->pushAnswers(sId, sAnswer);

	    // TODO: Check the result and maybe push the request again on the stack
	    //       Return it to the RemoteServer
	    //       Now just sent it back to all workspaces for example!
      }

    } else { // No request found. Send each x seconds a-live requests
	  if ( counterAliveMessages > 100000 ) {
		cout << "_threadClientMain: Send alive message!" << endl;
		sRequest = "alive-message\n";
		if ( send(iClientFd, sRequest.c_str(), sRequest.size(), 0) <= 0 ) {
		  rs->error("_threadClientMain: ERROR reading from socket");
		  bActiveConnection = false;
		  
		} else {
		  bzero(buffer, bufferLength);
          if ( read(iClientFd, buffer, bufferLength-1) <= 0 ) {
		    rs->error("_threadClientMain: ERROR reading from socket");
		    bActiveConnection = false;  

 		  } else {
			cout << "_threadClientMain: Got alive reply '" << buffer << "'" << endl;
		  }
		}
	    counterAliveMessages = 0;
		sRequest = "";

	  } else {
	    counterAliveMessages++;
	  }
	}

    usleep(100);
  }

  close(iClientFd);

  rs->_clientThreadStopped();
  
  cout << "Thread client stopped!\n";
}

// TODO: check if threads have been ended and clean them up. No this stack can grow big!
void _threadServerMain ( RemoteServer* rs, bool * bClientsConnected ) {
  cout << "RemoteServer: Started and accepting clients.\n";

  vector<thread> threadClients;

  while ( rs->isRunning() ) {
    struct sockaddr_in sClientAddr;
    socklen_t slClientLen = sizeof(sClientAddr);

    int iClientFd = accept(rs->getSockFd(), (struct sockaddr *) &sClientAddr, &slClientLen);

    if ( iClientFd < 0) {
      rs->error("RemoteServer: Error occurred during accepting the client.");

    } else {
      threadClients.push_back( thread( _threadClientMain, rs, sClientAddr, iClientFd ) );
    }

	// Check the threads if they have been ended, werkt nog niet
/*
	cout << "Check if the threads are ended!" << endl;
	for (auto it = threadClients.begin(); it != threadClients.end(); ) {
      if ( !(*it).joinable() ) {
		  cout << "_threadServerMain: Erasing thread!" << endl;
		  (*it).join();
		  it = threadClients.erase(it);

      } else {
        ++it;
      }
    }
*/
	
    //*bClientsConnected = ( threadClients.size() > 0 );
    *bClientsConnected = ( rs->getTotalConnectedClients() > 0 );

    usleep(100);
  }

  cout << "RemoteServer: Stopping and closing all clients." << endl;

  for ( unsigned int i=0; i < threadClients.size(); ++i ) {
    threadClients.at(i).join();
  }

  cout << "Thread stopped!\n";
}

RemoteServer::RemoteServer (int iPort): m_iPort(iPort) {
  this->m_bRunning = false;
  this->m_bClientsConnected = false;
  this->m_iTotalClientsConnected = 0;
}

RemoteServer::~RemoteServer () {

}

void RemoteServer::error(const char *msg) {
  perror(msg);
  //exit(1); // TODO: Please change this to a correct error handling!
}

bool RemoteServer::start () {
  if ( this->m_bRunning ) {
    return true;
  }

  this->m_iSockFd = socket(AF_INET, SOCK_STREAM, 0);

  if (this->m_iSockFd < 0) {
    this->error("RemoteServer: ERROR opening socket");
    return false;
  }
  
  bzero( (char *) &this->m_sServerAddr, sizeof(this->m_sServerAddr) );

  this->m_sServerAddr.sin_family = AF_INET;  
  this->m_sServerAddr.sin_addr.s_addr = INADDR_ANY;  
  this->m_sServerAddr.sin_port = htons(this->m_iPort);

  cout << "Establish a server listining on port " << this->m_iPort << endl;
  if ( bind(this->m_iSockFd, (struct sockaddr *) &this->m_sServerAddr, sizeof(this->m_sServerAddr)) < 0 ) {
    error("RemoteServer: ERROR on binding");
    return false;
  }

  // Here, we set the maximum size for the backlog queue to 5.
  listen(this->m_iSockFd, 5);

  this->m_bRunning = true;

  // Create main server loop to check incoming connections!
  this->m_threadServerMain = thread( _threadServerMain, this, &this->m_bClientsConnected );

  return true;
}

bool RemoteServer::stop () {
  if ( !this->m_bRunning ) {
    return true;
  }

  this->m_bRunning = false;

  this->m_threadServerMain.join();

  close(this->m_iSockFd);
  
  return true;
}

bool RemoteServer::pushRequest (string & sId, string & sRequest) {
  this->m_mqRequests.lock();

  if ( sId == "" || sRequest == "" ) {
    cout << "RemoteServer: pushRequest cannot have an empty sId or sRequest." << endl;
    this->m_mqRequests.unlock();
    return false;
  }  

  if ( this->getTotalConnectedClients() < 1 ) { 
    cout << "RemoteServer: No remote clients are available to serve request, so denying your request ... sorry!";
    this->m_mqRequests.unlock();
    return false;    
  }

  if ( this->m_qRequests.size() > 10 ) {
    cout << "RemoteServer: Cannot accept your request due to too many requests in the queue (" << m_qRequests.size() << ")!" << endl;
    this->m_mqRequests.unlock();
    return false;
  }

  RemoteServerRequest RMRequest;
  RMRequest.id = sId;
  RMRequest.request = sRequest;

  this->m_qRequests.push(RMRequest);

  cout << "RemoteServer: Accepted a new request with ID " << sId << " (queue: " << m_qRequests.size() << ")." << endl;

  this->m_mqRequests.unlock();
  
  return true;
}

bool RemoteServer::pullRequest ( string & sId, string & sRequest ) {
  this->m_mqRequests.lock();

  if ( this->m_qRequests.empty() ) {
    this->m_mqRequests.unlock();
    return false;
  }

  RemoteServerRequest RMRequest = this->m_qRequests.front();
  this->m_qRequests.pop();
  this->m_mqRequests.unlock();

  sId = RMRequest.id;
  sRequest = RMRequest.request;

  return true;
}

bool RemoteServer::pushAnswers ( string & sId, string & sAnswer ) {
  RemoteServerAnswer RMAnswer;
  RMAnswer.id = sId;
  RMAnswer.answer = sAnswer;

  this->m_mqAnswers.lock();
  this->m_qAnswers.push(RMAnswer);

  cout << "RemoteServer: Accepted a new answer (queue: " << m_qAnswers.size() << ")." << endl;

  this->m_mqAnswers.unlock();
  
  return true;
}

bool RemoteServer::pullAnswers ( string & sId, string & sAnswer ) {
  this->m_mqAnswers.lock();

  if ( this->m_qAnswers.empty() ) {
    this->m_mqAnswers.unlock();
    return false;
  }

  RemoteServerAnswer RMAnswer = this->m_qAnswers.front();
  this->m_qAnswers.pop();
  this->m_mqAnswers.unlock();

  if ( RMAnswer.id == "" ) {
    cout << "RemoteServer::pullAnswers: RMAnswer.id cannot be empty!" << endl;
    this->m_mqAnswers.unlock();
	return false;
  }
  
  sId = RMAnswer.id;
  sAnswer = RMAnswer.answer;

  return true;
}
