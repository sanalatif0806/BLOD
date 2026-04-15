FROM node:22-slim

WORKDIR /app

# Copy package files and install dependencies
COPY src/package*.json ./src/
WORKDIR /app/src
RUN npm install --production

# Copy backend source code
COPY src/ /app/src/

# Copy data folder (needed for llm.js prompts)
COPY data/ /app/data/

EXPOSE 5005

CMD ["node", "server.js"]
