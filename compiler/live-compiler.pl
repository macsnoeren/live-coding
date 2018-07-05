#!/usr/bin/perl

BEGIN { # Working directory is the application itself/temp
  use File::Basename;
  if ( !chdir( dirname($0) . "/temp" ) ) {
    die "Could not change to the application directory '" . dirname($0) . "/temp' ($!)\n";
  }
}

use strict;
use warnings;

use POSIX qw(setsid);
use utf8;

my $totalThreads = $ARGV[0] || "";

if ( !$totalThreads || $totalThreads !~ /^\d+$/ ) {
  print "Syntax: $0 <total_threads>\n";
  exit;
}

daemonize();

my $workingDir = "Worker";

for ( my $i=0; $i < $totalThreads-1; $i++ ) {
  
  my $pid = fork();

  if ( $pid ) { # main thread
    

  } else {
    $workingDir = "$workingDir-$i";
    $i = $totalThreads + 1;
  }
}

print "Thread $$: Started with $workingDir\n";
 
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
				   PeerHost => 'vmacman.jmnl.nl',
#				   PeerHost => 'localhost',
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
				   result  => "Malformed request received (102)",
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

sub daemonize {

  if ( !umask(0) ) {
    die "Could not umask(0)!\n";
  }    

  if ( !open(STDIN, "/dev/null") ) {
    die "Could not detach from STDIN!\n";
  }

  if ( !open(STDOUT, ">>../../log/live-compiler.out") ) {
    die "Could not connect to STDOUT ($!)!\n";
  }

  if ( !open(STDERR, ">>../../log/live-compiler.err") ) {
    die "Could not connect to STDERR!\n";
  }

  my $pid = fork;
  exit(0) if $pid; # Exit if $pid exist (parent)

  # As child
  setsid();
  return $$;
}

sub sandbox {
  my ( $command ) = @_;

  #my $c = "firejail --noprofile --caps.drop=all --cpu=0 $command";
  my $c = "firejail --noprofile --caps.drop=all --cpu=0 timeout 10 $command";
  print "sandboxing for 10 seconds ( $c )\n";

  my $output = `$c`;
  #print "---SANDBOX-START------------------\n";
  #print $output;
  #print "---SANDBOX_STOP------------------\n";

  $output =~ s/^.+$command *//g;
  $output =~ s/Parent.+bye\.\.\..*\n//g;
  $output =~ s/Parent.+\d{1,10}.*\n//g;

  print "Length of the output: " . length($output) . "\n";

  my $max = 1000;
  if ( length($output) > $max ) {
    $output = substr($output, 0, $max) . " \n...\n===TOO LONG===\n";
  }

  return $output;
}

sub getAnnotationsJava {
  my ( $compilerOutput ) = @_;

  my $first = 1;
  my $error = { row => -1,
		column => 0,
		text => "",
		type => "",
	      };
  my @as = ();

  foreach my $line (split("\n", $compilerOutput)) {
    chomp($line);

    if ( $line =~ /:(\d+): (.+):(.*)$/ ) { # Found statement JAVAC
      if ( !$first ) {
	push(@as, $error);
	$error = { row => ($1-1),
		   column => 0,
		   text => "$3",
		   type => "$2",
		 };
      }

      if ( $first ) {
	$error->{row} = ($1-1);
	$error->{text} = "$3";
	$error->{type} = "$2";
	$first = 0;
      }

    } else {
      $error->{text} .= "\n$line";
    }	
  }

  if ( $error->{row} != -1 ) {
    push(@as, $error);
  }

  print Dumper(\@as);

  return \@as;
}

sub getAnnotationsC {
  my ( $compilerOutput ) = @_;

  my $first = 1;
  my $error = { row => -1,
		column => 0,
		text => "",
		type => "",
	      };
  my @as = ();

  foreach my $line (split("\n", $compilerOutput)) {
    chomp($line);

    if ( $line =~ /:(\d+):(\d+): (.+):(.*)$/ ) { # Found statement JAVAC
      if ( !$first ) {
	push(@as, $error);
	$error = { row => ($1-1),
		   column => ($2-1),
		   text => "$4",
		   type => "$3",
		 };
      }

      if ( $first ) {
	$error->{row} = ($1-1);
	$error->{column} = ($2-1);
	$error->{text} = "$4";
	$error->{type} = "$3";
	$first = 0;
      }

    } else {
      $error->{text} .= "\n$line";
    }	
  }

  if ( $error->{row} != -1 ) {
    push(@as, $error);
  }

  print Dumper(\@as);

  return \@as;
}

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
      
      $version    = `java -version 2>&1`;
      $result     = `javac -Xlint:all $codeFile 2>&1`;
      utf8::decode($result);

      my $success = ($result ? 0 : 1);

      $result = { command => ($result ? "compile-error" : "compile-success"),
		  status  => $success,
		  annotations => getAnnotationsJava($result),
		  result  => ($result ? $result : "$version"),
		};
      
      # Sandboxing?? Or shutdown of the server?
      if ( $success && $command =~ /^execute/ ) {
	$result->{result} = "$version\n";
	#$result->{execution} = "OUTPUT OF YOUR CODE:\n " . `java $className`;
	#$result->{execution} = "OUTPUT OF YOUR CODE:\n For security reasons, execution is not yet enabled in this version";
	$result->{execution} = sandbox("java $className");
      }
      
      $result = encode_json($result);
      
      my $size = $socket->send($result);
      
      #print "Result:\n$result\n---------------\n";    
      
      #my $output = `rm -vf $codeFile $className.class`;

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
    my $result  = `g++ -Wall main.cpp -o main 2>&1`;
    utf8::decode($result);

    my $success = ($result ? 0 : 1);

    $result = { command => ($result ? "compile-error" : "compile-success"),
		status  => $success,
		annotations => getAnnotationsC($result),
		result  => ($result ? $result : "$version\n"),
	      };

    if ( $success && $command =~ /^execute/ ) {
      #$result->{execution} = "OUTPUT OF YOUR CODE:\n For security reasons, execution is not yet enabled in this version";
      #$result->{execution} = `./main 2>&1`;
      $result->{execution} = sandbox("./main");
    }

    $result = encode_json($result);

    my $size = $socket->send($result);
    
    #print "Result:\n$result\n---------------\n";    

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
    my $result  = `gcc -Wall main.c -o main 2>&1`;
    utf8::decode($result);

    my $success = ($result ? 0 : 1);

    $result = { command => ($result ? "compile-error" : "compile-success"),
		status  => $success,
		annotations => getAnnotationsC($result),
		result  => ($result ? $result : "$version\n"),
	      };

    if ( $success && $command =~ /^execute/ ) {
      #$result->{execution} = "OUTPUT OF YOUR CODE:\n For security reasons, execution is not yet enabled in this version";
      #$result->{execution} = `./main 2>&1`;
      $result->{execution} = sandbox("./main");
    }

    $result = encode_json($result);

    my $size = $socket->send($result);
    
    #print "Result:\n$result\n---------------\n";    

    my $output = `rm -vf main.cpp main`;

    return 1;

  } else {
    print "ERROR: Could not open the file ($!)\n";

    return 0;
  }
}
