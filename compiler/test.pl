#!/usr/bin/perl

use strict;
use warnings;

use IPC::Open3;

use Data::Dumper;

print "Started\n";
my $pid = open3(\*IN, \*OUT, \*ERR, './echo.pl');

sleep 5;

print "Start code!\n";

print IN "HELLO GOOGLE, THIS IS JUST A TEST, SORRY TO BOTHER!\n";

while ( my $line = <ERR> ) {
  chomp($line);
  print "LINE: '$line'\n";
}

close IN;
close OUT;
close ERR;

