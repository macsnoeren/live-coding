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

  WebSocketMessageWorkspace m(connection, message_str);

  // Check if the message is valid, if not do not push it to the newclient message function.
  
  this->newClientMessage(m);
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
}

void WebSocketProtocolWorkspace::newClientMessage ( WebSocketMessageWorkspace & message ) {
  this->addMessage(message);
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
