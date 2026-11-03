import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './ui'
import { MapPrototype } from './preview/map/MapPrototype'
import { PreviewPage } from './preview/PreviewPage'
import { SheetDemo } from './preview/sheet/SheetDemo'

// Until the screens exist, the app opens the component preview page; #map opens the map prototype,
// #sheet the demo of the sheets and inventories.
function Root() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash === '#map' ? <MapPrototype /> : hash === '#sheet' ? <SheetDemo /> : <PreviewPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
