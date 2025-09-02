import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'antd/dist/reset.css';
import './index.css';
import { HashRouter } from 'react-router-dom';
import { ConnectionProvider } from './context/ConnectionContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <ConnectionProvider>
          <App />
        </ConnectionProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
