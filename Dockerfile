FROM apify/actor-node-puppeteer-chrome
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm install 
