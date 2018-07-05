#!/usr/bin/perl

use strict;
use warnings;

print "START!\n";

while (1) {

  print "Waiting for input:\n";

  my $line = <STDIN>;

  chomp($line);

  print "THIS IS SENT BY YOU: '$line'\n";
}

print "STOP!\n";

