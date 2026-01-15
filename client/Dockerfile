# --- 阶段 1: 构建 ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# 设置构建时的环境变量
# 在 Docker 内部网络中，浏览器依然是访问宿主机(localhost)的 Nginx
# 所以这里 URL 留空，或者设为相对路径，让 Nginx 代理处理
ENV VITE_API_URL=/api
ENV VITE_WS_URL=ws://localhost/y-websocket

RUN npm run build

# --- 阶段 2: 运行 ---
FROM nginx:alpine

# 复制构建好的静态文件到 Nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制我们刚才写的 nginx 配置覆盖默认配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]