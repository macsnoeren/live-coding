#include "WebSocketMessage/Workspace.h"

using namespace std;

unsigned int WebSocketMessageWorkspace::_nextId = 0; // Declaration of static value.


WebSocketMessageWorkspace::WebSocketMessageWorkspace ( shared_ptr<WebSocketServer::Connection> pConnection, string sRawMessage ): WebSocketMessage(pConnection, sRawMessage), uintId(WebSocketMessageWorkspace::_nextId++) {
  settimeofday(&this->m_tvTimestamp, NULL);

  this->m_bTeacher = false;

  cout << "WebSocketMessageWorkspace: '" << sRawMessage << "'" << endl;

}

WebSocketMessageWorkspace::~WebSocketMessageWorkspace() {

}  

void WebSocketMessageWorkspace::newMessage() {
  this->sendClientMessage( "YESSS NIEUW BERICHT!!\n" );
}
