#ifndef WEBSOCKET_PROTOCOL_H
#define WEBSOCKET_PROTOCOL_H

#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>

#include "server_ws.hpp"

#include "config.h"

using WebSocketServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

/*! \brief     This abstract class implements a specific protocol for the 
 *             websocket server.
 *  \details   
 *  \author    Maurice Snoeren
 *  \version   0.1
 *  \date      29-03-2018
 *  \bug       No known bugs
 *  \copyright 2018 (c) JMNL Innovation
 */
class WebSocketProtocol {
  
 protected:

  WebSocketServer & m_wsServer;

  std::string m_sEndpointName;

  SimpleWeb::SocketServerBase<boost::asio::basic_stream_socket<boost::asio::ip::tcp> >::Endpoint * m_wsEndpoint;
    
 public: 
  
  /*! Constructor function. Note that this class will be used as base class. It is not intented to instantiate this class on its own. */
  explicit WebSocketProtocol (WebSocketServer &server, std::string sEndpointName);
  
  /*! Destructor. A virtual function, because it will be probably overloaded by other classes. */
  virtual ~WebSocketProtocol();

  virtual std::string getEndpointName () { return m_sEndpointName; }

  virtual void onOpen    (std::shared_ptr<WebSocketServer::Connection> connection);
  virtual void onClose   (std::shared_ptr<WebSocketServer::Connection> connection, int status);
  virtual void onError   (std::shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec);
  virtual void onMessage (std::shared_ptr<WebSocketServer::Connection> connection, std::shared_ptr<WebSocketServer::Message> message);


};

#endif
