#include "WebSocketMessage/Workspace.h"

using namespace std;

WebSocketMessageWorkspace::WebSocketMessageWorkspace ( shared_ptr<WebSocketServer::Connection> pConnection, string sRawMessage ): WebSocketMessage(pConnection, sRawMessage) {
  settimeofday(&this->m_tvTimestamp, NULL);

  cout << "WebSocketMessageWorkspace: '" << sRawMessage << "'" << endl;

}

WebSocketMessageWorkspace::~WebSocketMessageWorkspace() {

}  

void WebSocketMessageWorkspace::newMessage() {
  this->sendClientMessage( "YESSS NIEUW BERICHT!!\n" );
}
