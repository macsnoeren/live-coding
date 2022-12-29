# docker image build --progress=plain . -t live-coding --no-cache
# docker run -p 3001:3001 -it live-coding
# docker run -p 3001:3001 -it live-coding /bin/bash

FROM node:18

WORKDIR /home/node/app

COPY package*.json ./

RUN apt-get update && apt-get -y upgrade && apt-get -y install default-jre default-jdk
RUN npm install && npm update

COPY *.js ./
COPY *.json ./

RUN mkdir clientenvironments

CMD [ "npm", "start" ]
