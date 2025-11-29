FROM apify/actor-node-puppeteer-chrome:latest

USER root
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm install

USER node
