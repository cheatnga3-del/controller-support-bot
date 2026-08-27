FROM node:20-alpine

WORKDIR /app

COPY verify/package.json ./
RUN npm install --production

COPY verify/ ./

CMD ["node", "index.js"]
