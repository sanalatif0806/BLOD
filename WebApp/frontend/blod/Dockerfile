FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG REACT_APP_API_URL=http://localhost:5005
ARG REACT_APP_DASHBOARD_BACKEND=http://localhost:5001
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_DASHBOARD_BACKEND=$REACT_APP_DASHBOARD_BACKEND

RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
