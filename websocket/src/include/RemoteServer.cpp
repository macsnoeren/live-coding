#include "RemoteServer.h"

using namespace std;

// TODO: check when connection is dead! repush the message on the stack!
void _threadClientMain ( RemoteServer* rs, struct sockaddr_in sClientAddr, int iClientFd ) {
  cout << "Thread client started!\n";

  printf("RemoteServer: got connection from %s port %d\n",
	 inet_ntoa(sClientAddr.sin_addr), ntohs(sClientAddr.sin_port));

  bool bActiveConnection = true;

  while ( rs->isRunning() && bActiveConnection ) {
    string sRequest;

    if ( rs->pullRequest(sRequest) ) {
      cout << "RemoteServer: Got request and sending it to the remote client that is connected!\n";

      send(iClientFd, sRequest.c_str(), sRequest.size(), 0);

      const int bufferLength = 8096;
      char buffer[bufferLength];

      bzero(buffer, bufferLength);

      // TODO: Reading large data when buffer is to small needs to be done
      // TODO: Request should have an ID so it can be identified to which workspace it should
      //       be sent.
      int n = read(iClientFd, buffer, bufferLength-1);

      if ( n < 0 ) {
	rs->error("ERROR reading from socket");
	bActiveConnection = false;

      } else {
	cout << "RemoteServer: Got answer from remote client on request!\n";
	printf("Answer:\n %s\n---------------\n", buffer);

	string sAnswer = buffer;

	rs->pushAnswers(sAnswer);

	// TODO: Check the result and maybe push the request again on the stack
	//       Return it to the RemoteServer
	//       Now just sent it back to all workspaces for example!
      }

    }

    usleep(100);
  }

  close(iClientFd);

  cout << "Thread client stopped!\n";
}

// TODO: check if threads have been ended and clean them up.
void _threadServerMain ( RemoteServer* rs, bool * bClientsConnected ) {
  cout << "RemoteServer: Started and accepting clients.\n";

  vector<thread> threadClients;

  while ( rs->isRunning() ) {
    struct sockaddr_in sClientAddr;
    socklen_t slClientLen = sizeof(sClientAddr);

    int iClientFd = accept(rs->getSockFd(), (struct sockaddr *) &sClientAddr, &slClientLen);

    if ( iClientFd < 0) {
      rs->error("RemoteServer: Error occured during accepting the client.");

    } else {
      threadClients.push_back( thread( _threadClientMain, rs, sClientAddr, iClientFd ) );
    }

    *bClientsConnected = ( threadClients.size() > 0 );

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

bool RemoteServer::pushRequest (string & sRequest) {
  if ( !this->m_bClientsConnected ) {
    cout << "RemoteServer: No remote clients are available to serve request, so denying your request ... sorry!";
    return false;    
  }

  if ( this->m_qRequests.size() > 10 ) {
    cout << "RemoteServer: Cannot accept your request due to too many requests in the queue (" << m_qRequests.size() << ")!" << endl;
    return false;
  }

  this->m_mqRequests.lock();
  this->m_qRequests.push(sRequest);
  this->m_mqRequests.unlock();

  cout << "RemoteServer: Accepted a new request (queue: " << m_qRequests.size() << ")." << endl;
  
  return true;
}

bool RemoteServer::pullRequest ( string & sRequest ) {
  if ( this->m_qRequests.empty() ) {
    return false;
  }

  this->m_mqRequests.lock();
  sRequest = this->m_qRequests.front();
  this->m_qRequests.pop();
  this->m_mqRequests.unlock();

  return true;
}

bool RemoteServer::pushAnswers (string & sRequest) {
  this->m_mqAnswers.lock();
  this->m_qAnswers.push(sRequest);
  this->m_mqAnswers.unlock();

  cout << "RemoteServer: Accepted a new answer (queue: " << m_qAnswers.size() << ")." << endl;
  
  return true;
}

bool RemoteServer::pullAnswers ( string & sRequest ) {
  if ( this->m_qAnswers.empty() ) {
    return false;
  }

  this->m_mqAnswers.lock();
  sRequest = this->m_qAnswers.front();
  this->m_qAnswers.pop();
  this->m_mqAnswers.unlock();

  return true;
}
