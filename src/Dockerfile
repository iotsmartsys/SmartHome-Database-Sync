FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production && npm cache clean --force

COPY app/ ./app/

CMD ["node", "app/app.js"]