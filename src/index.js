import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // <<< Import BrowserRouter
import App from './App';
import { AuthProvider } from './context/AuthContext';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <BrowserRouter> {/* <<< Wrap your whole app */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
