FROM apify/actor-node-puppeteer-chrome

# Run as root to install packages and fix permissions
USER root

# Copy project files
COPY . /usr/src/app
WORKDIR /usr/src/app

# Install dependencies
RUN npm install

# Create storage directory and set permissions
RUN mkdir -p /usr/src/app/storage-fixed \
    && chown -R node:node /usr/src/app/storage-fixed

# Switch to non-root user for running the actor
USER node
