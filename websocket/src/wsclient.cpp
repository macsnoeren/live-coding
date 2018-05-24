#include <iostream>
#include <unistd.h> // sleep, usleep, deamon
#include <sys/time.h>
#include <string>
#include <cstring>
#include <signal.h>

#include "config.h"
#include "RemoteServer.h"

using namespace std;

bool gbStop = false;

void mySignalHandler (int s){
  if ( s == 2 ) {
    gbStop = true;
  }
}

int main() {

  // Signal handler, to gracefully unbind the server.
  struct sigaction sigIntHandler;

  sigIntHandler.sa_handler = mySignalHandler;
  sigemptyset(&sigIntHandler.sa_mask);
  sigIntHandler.sa_flags = 0;

  sigaction(SIGINT, &sigIntHandler, NULL);

  // Create the RemoteServer class to start the remote server service
  RemoteServer server(20000);

  server.start();

  while (!gbStop) {
    cout << "Main loop!" << endl;
    sleep(5);

    cout << "Push request!\n";
    string sRequest = "Hoi, ik ben Maurice\n";
    server.pushRequest(sRequest);
  }

  cout << "Stopped!" << endl;

  server.stop();

  return 0;
}
