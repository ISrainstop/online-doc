import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // 🔥 新增：开发环境代理配置
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 后端地址
        changeOrigin: true,
        secure: false,
      },
      // 如果需要本地调试上传图片，也代理一下 uploads
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
});