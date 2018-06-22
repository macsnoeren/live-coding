#!/bin/sh

./websocket.js > /dev/null &

sleep 2

./rc-live-coding.pl worker1 > /dev/null &


