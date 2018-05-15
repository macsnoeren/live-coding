#include "WebSocketProtocol/Workspace.h"

using namespace std;

WebSocketProtocolWorkspace::WebSocketProtocolWorkspace (WebSocketServer &server, string sEndpointName): WebSocketProtocol(server, sEndpointName) {
  
}

WebSocketProtocolWorkspace::~WebSocketProtocolWorkspace() {

}  

void WebSocketProtocolWorkspace::onOpen (shared_ptr<WebSocketServer::Connection> connection) {
  cout << "Server: Opened connection " << connection.get() << endl;
}

void WebSocketProtocolWorkspace::onClose   (shared_ptr<WebSocketServer::Connection> connection, int status) {
  cout << "Server: Closed connection " << connection.get() << " with status code " << status << endl;
}

void WebSocketProtocolWorkspace::onError   (shared_ptr<WebSocketServer::Connection> connection, const SimpleWeb::error_code &ec) {
  cout << "Server: Error in connection " << connection.get() << ". "
       << "Error: " << ec << ", error message: " << ec.message() << endl;
}

void WebSocketProtocolWorkspace::onMessage (shared_ptr<WebSocketServer::Connection> connection, shared_ptr<WebSocketServer::Message> message) {
  auto message_str = message->string();
  
  WebSocketProtocolWorkspaceMessage wsppm;
  wsppm.raw = message_str;
  settimeofday(&wsppm.timestamp, NULL);
  this->addMessage(wsppm);

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

WebSocketProtocolWorkspaceMessage WebSocketProtocolWorkspace::getLastMessage () {
  WebSocketProtocolWorkspaceMessage message;

  return message;
}

void WebSocketProtocolWorkspace::printMessages () {
  for (auto v : this->m_vMessages) {
    std::cout << "=> " << v.raw << "\n";
  }
}

void WebSocketProtocolWorkspace::newClientMessage ( WebSocketProtocolWorkspaceMessage & message ) {
  
}
