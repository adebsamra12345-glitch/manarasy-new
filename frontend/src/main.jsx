import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { bootSession } from './services/sessionRefresh'

// تجديد الجلسة صامتاً (إن وُجدت) قبل أول رسم حتى لا تُرسل الطلبات الأولى بلا توكن
bootSession().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
