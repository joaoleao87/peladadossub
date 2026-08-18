import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { AppTheme } from './theme'
import './styles.css'
import './adjustments.css'

createRoot(document.getElementById('root')!).render(<StrictMode><AppTheme><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></AppTheme></StrictMode>)

if ('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))
