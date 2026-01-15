import React from 'react';
import { createRoot } from 'react-dom/client';
// 删除 BrowserRouter 等路由组件的引入
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';

import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);