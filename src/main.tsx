import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StreamingApp } from '@/components/streaming/streaming-app'
import '@/types'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <StreamingApp />
  </StrictMode>,
)
