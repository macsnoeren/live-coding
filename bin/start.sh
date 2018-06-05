#!/bin/sh

./websocket&

sleep 2

./remoteclient.pl&

top

