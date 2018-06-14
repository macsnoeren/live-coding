#!/usr/bin/perl

use strict;
use warnings;

my $workingDir = $ARGV[0] || "";

if ( !$workingDir || $workingDir !~ /^\w+$/ ) {
  print "Syntax: rc-live-coding.pl <work-dir>\n";
  exit;
}

if ( !-d $workingDir && !mkdir($workingDir) ) {
  die "ERROR: Could not create the '$workingDir' directory.\n";
}

if ( !chdir($workingDir) ) {
  die "ERROR: Could not change to the '$workingDir' directory.\n";
}

print "Remote client is started!\n";

use IO::Socket::INET;
use JSON;

use Data::Dumper;

# auto-flush on socket
$| = 1;

# create a connecting socket
my $socket = new IO::Socket::INET (
				   #PeerHost => 'vmacman.jmnl.nl',
				   PeerHost => 'localhost',
				   PeerPort => '20000',
				   Proto => 'tcp',
				   Blocking => 1,
);
die "cannot connect to the server $!\n" unless $socket;
print "connected to the server\n";

my $connected = 1;

while ($connected) {
  my $response = "";
  my $result = "";
  my $version = "";

  $socket->recv($response, 1024*1024);
  print "RAW: $response\n";

  if ( $response =~ /alive-message/ ) { # Process the alive messages
    print "SEND: alive-message:" . time() . "\n";
    $socket->send("alive-message:" . time());

  } else {
    my $json= undef;
    eval('$json = decode_json($response)');
    
    if ( $@ ) {
      print "Error occurred!\n";
      $socket->send(encode_json({
				 command => "compile-error",
				 status  => 0,
				 result  => "Internal error occurred (101)",
				}));
      
    } else { # Compile the code
      if ( !exists($json->{token})   || !exists($json->{compiler}) ||
	   !exists($json->{checker}) || !exists($json->{code})     ||
	   !exists($json->{command}) ) {
	$socket->send(encode_json({
				   command => "compile-error",
				   status  => 0,
				   result  => "Malformed request recieved (102)",
				  }));
      } else {
	compile($json->{command},
		$json->{compiler},
		$json->{checker},
		$json->{code});	
      }
    }
  }
}

# notify server that request has been sent
shutdown($socket, 1);

$socket->close();

exit;

sub compile { 
  my ( $command, $compiler, $checker, $code ) = @_;

  if ( $compiler eq "java" || $compiler eq "java-8" ) {
    compileJava8($command, $compiler, $checker, $code);

  } elsif ( $compiler eq "c" ) {
    compileC($command, $compiler, $checker, $code);

  } elsif ( $compiler eq "cpp" ) {
    compileCPP($command, $compiler, $checker, $code);

  } else {
    $socket->send( encode_json(
			       {
				command => "compile-status",
				status  => 0,
				message  => "Compiler language '$compiler' not found, cannot compile your code!",
			       }
			      )
		 );
  }
}


sub compileJava8 { 
  my ($command, $compiler, $checker, $code) = @_;
  print "Compiler: Java 8\n";
  print "Got code:\n-------------------\n$code\n--------------\n";
  
  my $result;
  my $version;
  my $className;
  my $codeFile;

  if ( $code =~ /public +class +(.+) +{/ ) {
    $className = $1;
    $codeFile = "$className.java";
    
    print "Detected public class name, renaming file to '$codeFile'\n";
    
    if ( open(FILE, ">$codeFile") ) {
      print FILE $code;
      close(FILE);
      
      $version = `java -version 2>&1`;
      $result  = `javac $codeFile 2>&1`;

      $result = { command => ($result ? "compile-error" : "compile-success"),
		  status  => ($result ? 0 : 1),
		  result  => ($result ? $result : "$version\nGeen fouten gevonden!\n"),
		};
      
      # Sandboxing?? Or shutdown of the server?
      if ( $command =~ /^execute/ ) {
	$result->{result} = "$version\n";
	#$result->{execution} = "OUTPUT OF YOUR CODE:\n " . `java $className`;
	$result->{execution} = "OUTPUT OF YOUR CODE:\n For security reasons, execution is not yet enabled in this version";
      }
      
      $result = encode_json($result);
      
      my $size = $socket->send($result);
      
      print "Result:\n$result\n---------------\n";    
      
      my $output = `rm -vf $codeFile $className.class`;

      return 1;
      
    } else { # no found!
      $result = "ERROR: Could not open the file ($!)\n";
    }
    

  } else {
    $result = "ERROR: Could not determine your application name, forgot public class?? (JAVA?)";
  }

  $socket->send( encode_json(
			     {
			      command => "compile-error",
			      status  => 0,
			      result  => $result,
			     }
			    )
	       );
  return 0;
}

sub compileCPP { 
  my ($command, $compiler, $checker, $code) = @_;
  print "Compiler: C++\n";
  print "Got code:\n-------------------\n$code\n--------------\n";
      
  if ( open(FILE, ">main.cpp") ) {
    print FILE $code;
    close(FILE);
    
    my $version = `g++ --version 2>&1`;
    my $result  = `g++ main.cpp -o main 2>&1`;
    
    $result = { command => ($result ? "compile-error" : "compile-success"),
		status  => ($result ? 0 : 1),
		result  => ($result ? $result : "$version\nGeen fouten gevonden!\n"),
	      };

    if ( $command =~ /^execute/ ) {
      $result->{execution} = "OUTPUT OF YOUR CODE:\n For security reasons, execution is not yet enabled in this version";
      #$result->{execution} = `./main 2>&1`;
    }

    $result = encode_json($result);

    my $size = $socket->send($result);
    
    print "Result:\n$result\n---------------\n";    

    my $output = `rm -vf main.cpp main`;

    return 1;

  } else {
    print "ERROR: Could not open the file ($!)\n";

    return 0;
  }
}

sub compileC { 
  my ($command, $compiler, $checker, $code) = @_;
  print "Compiler: C\n";
  print "Got code:\n-------------------\n$code\n--------------\n";
      
  if ( open(FILE, ">main.c") ) {
    print FILE $code;
    close(FILE);
    
    my $version = `gcc --version 2>&1`;
    my $result  = `gcc main.c -o main 2>&1`;
    
    $result = { command => ($result ? "compile-error" : "compile-success"),
		status  => ($result ? 0 : 1),
		result  => ($result ? $result : "$version\nGeen fouten gevonden!\n"),
	      };

    if ( $command =~ /^execute/ ) {
      $result->{execution} = "OUTPUT OF YOUR CODE:\n For security reasons, execution is not yet enabled in this version";
      #$result->{execution} = `./main 2>&1`;
    }

    $result = encode_json($result);

    my $size = $socket->send($result);
    
    print "Result:\n$result\n---------------\n";    

    my $output = `rm -vf main.cpp main`;

    return 1;

  } else {
    print "ERROR: Could not open the file ($!)\n";

    return 0;
  }
}
