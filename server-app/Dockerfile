FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .
RUN npm run build || true

EXPOSE 5000
CMD ["node", "dist/index.js"]
