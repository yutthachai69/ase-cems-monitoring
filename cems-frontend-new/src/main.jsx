import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'antd/dist/reset.css';
import './index.css';

import { HashRouter } from 'react-router-dom'; // ✅ Router ชั้นเดียว

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <App />
  </HashRouter>
);
