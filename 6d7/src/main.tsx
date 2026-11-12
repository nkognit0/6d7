import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui'
import { App } from './app/App'
import { getMedia } from './game/media/media'
import type { MediaRef } from './game/seat/seat'
import { resolveImages } from './map'

// portraits on tokens are files of the media store
resolveImages('media:', (ref) => getMedia(ref as MediaRef))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
