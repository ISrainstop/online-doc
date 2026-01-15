# 使用 Node.js 18 作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 1. 安装依赖
COPY package.json package-lock.json ./
RUN npm install

# 2. 复制 Prisma配置并生成 Client (必须在构建前做)
COPY prisma ./prisma
RUN npx prisma generate

# 3. 复制源代码
COPY . .

# 4. 编译 TypeScript
RUN npm run build

# 5. 暴露端口 (后端监听端口)
EXPOSE 5000

# 6. 启动命令 (确保 package.json 里有 start 脚本指向 dist/index.js，或者直接写 node)
CMD ["node", "dist/index.js"]