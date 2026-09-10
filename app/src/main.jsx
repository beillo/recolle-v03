import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Admin from './components/Admin.jsx'

// Two pages, no router. A router would be a dependency and a bundle for one
// branch. If a third page ever appears, that is the moment to add one.
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>{isAdmin ? <Admin /> : <App />}</StrictMode>,
)
