#ifndef REMOTE_SERVER_H
#define REMOTE_SERVER_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h> 
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h> 

#include <iostream>
#include <thread>
#include <vector>
#include <queue>
#include <string>
#include <mutex>

#include "config.h"

struct RemoteServerRequest {
  std::string id;
  std::string request;
};

struct RemoteServerAnswer {
  std::string id;
  std::string answer;
};

/*! \brief     Remote server class. Remote clients are able to connect with this server.
 *             The webservices requests compilation and running applications. This is
 *             executed by the remote servers.
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      24-05-2018
 *  \bug       No known bugs
 *  \copyright 2018
 */
class RemoteServer {
  
 protected:

  int m_iSockFd;
  int m_iPort;
  bool m_bRunning;
  bool m_bClientsConnected;
  
  struct sockaddr_in m_sServerAddr;

  std::thread m_threadServerMain;

  std::queue<RemoteServerRequest> m_qRequests;
  std::mutex m_mqRequests;

  // TODO: Not yet used, but is required. Also create a structure with a message ID etc.
  std::queue<RemoteServerAnswer> m_qAnswers;
  std::mutex m_mqAnswers;

 public: 

  void error (const char *msg);
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit RemoteServer (int iPort);
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~RemoteServer();

  bool start ();

  bool stop ();

  bool isRunning () { return m_bRunning; }
  
  int getSockFd () { return m_iSockFd; }

  bool pushRequest ( std::string & sId, std::string & sRequest );

  bool pullRequest ( std::string & sId, std::string & sRequest );

  bool pushAnswers ( std::string & sId, std::string & sAnswer );

  bool pullAnswers ( std::string & sId, std::string & sAnswer );

  bool isAnswerAvailable () { return this->m_qAnswers.size() > 0; }

  bool checkClientsConnected () { return this->m_bClientsConnected; }

};

#endif
