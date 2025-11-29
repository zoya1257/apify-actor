FROM apify/actor-node-puppeteer-chrome

USER root
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN npm install
RUN mkdir -p /usr/src/app/storage-fixed && chown -R node:node /usr/src/app/storage-fixed

USER node

CMD ["node", "src/main.js"]
