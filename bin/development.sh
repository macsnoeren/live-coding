#!/bin/sh

./websocket.js 4000 > /dev/null &

sleep 2

./rc-live-coding.pl worker1 > /dev/null &


