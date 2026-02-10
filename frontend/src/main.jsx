import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Web3Provider } from './contexts/Web3Context'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>,
)
