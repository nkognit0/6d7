import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui'
import { App } from './app/App'
import { getMedia } from './game/media/media'
import type { MediaRef } from './game/seat/seat'
import { resolveCatalog, resolveImages } from './map'
import { npcToken } from './npc/catalog'

// portraits on tokens are files of the media store; NPCs of the catalog are drawn by the id of their token
resolveImages('media:', (ref) => getMedia(ref as MediaRef))
resolveCatalog((id) => npcToken(id)?.url)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
