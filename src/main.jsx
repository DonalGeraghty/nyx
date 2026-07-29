// NyxAI — named for Nyx, the Greek goddess of night.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { PWAProvider } from './context/PWAContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PWAProvider>
      <App />
    </PWAProvider>
  </React.StrictMode>,
) 
