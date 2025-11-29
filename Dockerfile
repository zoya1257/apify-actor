FROM apify/actor-node-puppeteer-chrome
USER root
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm install 
USER node
