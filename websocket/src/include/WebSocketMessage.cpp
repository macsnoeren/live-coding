#include "WebSocketMessage.h"

using namespace std;

// Testing
string __exec (const char* cmd) {
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

WebSocketMessage::WebSocketMessage ( shared_ptr<WebSocketServer::Connection> pConnection, string sRawMessage ): m_pConnection(pConnection), m_sRawMessage(sRawMessage) {
  settimeofday(&this->m_tvTimestamp, NULL);

  cout << "WebSocketMessage: '" << sRawMessage << "'" << endl;

  this->newMessage();
}

WebSocketMessage::~WebSocketMessage() {

}

void WebSocketMessage::newMessage() {
  cout << "WebSocketMessage\n";
  this->sendClientMessage( __exec( this->getRawMessage().c_str() ) );
}

void WebSocketMessage::sendClientMessage (string sMessage) {
  cout << "sendClientMessage: '" << sMessage << "'" << endl;

  auto send_stream = make_shared<WebSocketServer::SendStream>();
  *send_stream << sMessage.c_str();

  cout << "Server: Message received: \"" << sMessage << "\" from " << this->m_pConnection.get() << endl;
  
  cout << "Server: Sending message \"" << sMessage << "\" to " << this->m_pConnection.get() << endl;

  // connection->send is an asynchronous function
  this->m_pConnection->send(send_stream, [](const SimpleWeb::error_code &ec) {
			      if(ec) {
				cout << "Server: Error sending message. " <<
				  // See http://www.boost.org/doc/libs/1_55_0/doc/html/boost_asio/reference.html, Error Codes for error code meanings
				  "Error: " << ec << ", error message: " << ec.message() << endl;
			      }
			    });
}  
