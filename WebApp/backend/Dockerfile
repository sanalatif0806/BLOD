FROM node:22

WORKDIR /app

# Copy package.json files first
COPY src/package*.json ./src/

WORKDIR /app/src
RUN npm install

# Copy backend source code
COPY src/ /app/src

# Copy the data folder (needed for llm.js)
COPY data/ /app/data

EXPOSE 5005

CMD ["node", "server.js"]
