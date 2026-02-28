FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN mkdir -p public/uploads public/result

EXPOSE 5001 8080 8081

CMD ["node", "app.js"]
