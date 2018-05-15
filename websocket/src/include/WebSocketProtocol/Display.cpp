#include "WebSocketProtocol/Prog.h"

WebSocketProtocolProg::WebSocketProtocolProg (WebSocketServer &server, string sEndpointName): WebSocketProtocol(server, sEndpointName) {

}

WebSocketProtocolProg::~WebSocketProtocolProg() {

}  

void WebSocketProtocolProg::onOpen (shared_ptr<WebSocketServer::Connection> connection) {
  cout << "Server: Opened connection " << connection.get() << endl;
}

void WebSocketProtocolProg::onClose   (shared_ptr<WebSocketServer::Connection> connection, int status) {
  cout << "Server: Closed connection " << connection.get() << " with status code " << status << endl;
}

void WebSocketProtocolProg::onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec) {
  cout << "Server: Error in connection " << connection.get() << ". "
       << "Error: " << ec << ", error message: " << ec.message() << endl;
}

void WebSocketProtocolProg::onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message) {
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
