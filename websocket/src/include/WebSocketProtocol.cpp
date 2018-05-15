#include "WebSocketProtocol.h"

using namespace std;

void _onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message, void* user_space) {
    WebSocketProtocol *p = (WebSocketProtocol*) user_space;
    p->onMessage(connection, message);
}

void _onOpen (shared_ptr<WebSocketServer::Connection> connection, void *user_space) {
  WebSocketProtocol *p = (WebSocketProtocol*) user_space;
  p->onOpen(connection);
}

void _onClose (shared_ptr<WebSocketServer::Connection> connection, int status, const string &, void* user_space) {
  WebSocketProtocol *p = (WebSocketProtocol*) user_space;
  p->onClose(connection, status);
}

void _onError (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec, void* user_space) {
  WebSocketProtocol *p = (WebSocketProtocol*) user_space;
  p->onError(connection, ec);
}

WebSocketProtocol::WebSocketProtocol (WebSocketServer &server, string sEndpointName): m_wsServer(server) {
  cout << "WebSocketProtocol: Creating endpoint '" << sEndpointName << endl;  

  this->m_sEndpointName = sEndpointName;
  sEndpointName         = "^/" + sEndpointName + "/?$";
  auto &endpoint        = server.endpoint[sEndpointName.c_str()];

  endpoint.setUserSpace((void*) this);

  endpoint.on_message = _onMessage;
  endpoint.on_open    = _onOpen;
  endpoint.on_close   = _onClose;
  endpoint.on_error   = _onError;

  this->m_wsEndpoint = &endpoint;
}

WebSocketProtocol::~WebSocketProtocol() {

}  

void WebSocketProtocol::onOpen (shared_ptr<WebSocketServer::Connection> connection) {
  cout << "Server: Opened connection " << connection.get() << endl;
}

void WebSocketProtocol::onClose   (shared_ptr<WebSocketServer::Connection> connection, int status) {
  cout << "Server: Closed connection " << connection.get() << " with status code " << status << endl;
}

void WebSocketProtocol::onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec) {
  cout << "Server: Error in connection " << connection.get() << ". "
       << "Error: " << ec << ", error message: " << ec.message() << endl;
}

void WebSocketProtocol::onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message) {
  auto message_str = message->string();
  
  cout << "Server: Message received: \"" << message_str << "\" from " << connection.get() << endl;
  
  cout << "Server: Sending message \"" << message_str << "\" to " << connection.get() << endl;
  
  auto send_stream = make_shared<WebSocketServer::SendStream>();
  *send_stream << message_str;
  // connection->send is an asynchronous function
  connection->send(send_stream, [](const SimpleWeb::error_code &ec) {
		     if(ec) {
		       cout << "Server: Error sending message. " <<
			 // See http://www.boost.org/doc/libs/1_55_0/doc/html/boost_asio/reference.html, Error Codes for error code meanings
			 "Error: " << ec << ", error message: " << ec.message() << endl;
		     }
		   });
}
