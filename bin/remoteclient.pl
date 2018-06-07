#!/usr/bin/perl

#annotations
#editor.getSession().setAnnotations([{ row: 3, column: 10, text: "Error Message", // Or the Json reply from the parser type: "warning" // also warning and information }]);

use strict;
use warnings;

print "Remote client is started!\n";

use IO::Socket::INET;
use JSON;

# auto-flush on socket
$| = 1;

# create a connecting socket
my $socket = new IO::Socket::INET (
    PeerHost => '127.0.0.1',
    PeerPort => '20000',
    Proto => 'tcp',
);
die "cannot connect to the server $!\n" unless $socket;
print "connected to the server\n";

# receive a response of up to 1024 characters from server
while (1) {
  my $response = "";
  $socket->recv($response, 1024*1024);
  print "Got code:\n$response\n--------------\n";

  if ( open(FILE, ">code.c") ) {
    print FILE $response;
    close(FILE);

    my $result = `gcc code.c 2>&1`;

    #$result =~ s/\n/<br\/>\n/g;

    $result = encode_json(
			  { command => "compiler-result",
			    status  => ($result ? 0 : 1),
			    result  => ($result ? $result : "Geen fouten gevonden!!!! (TODO: Runnen applicatie / Unit testen doen??)\n"),
			  }
			 );

    my $size = $socket->send($result);

    print "Result:\n$result\n---------------\n";

  } else {
    print "ERROR: Could not open the file ($!)\n";
  }
}

# notify server that request has been sent
shutdown($socket, 1);

$socket->close();
