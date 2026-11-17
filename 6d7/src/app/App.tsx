import { lazy, Suspense } from 'react'
import { HomeScreen } from '../home/HomeScreen'
import { useRoute } from './route'

// Every screen but the first one comes with its own part of the build, when it is opened: a
// player who opens a code does not load the editor, and the home screen loads neither the map
// nor the rules.
const EditorScreen = lazy(() => import('../editor/EditorScreen').then((m) => ({ default: m.EditorScreen })))
const MasterGame = lazy(() => import('../game/master/MasterGame').then((m) => ({ default: m.MasterGame })))
const PlayerGame = lazy(() => import('../game/player/PlayerGame').then((m) => ({ default: m.PlayerGame })))

// pages for development: on the dev server only, the site has none of their code
const DEV = import.meta.env.DEV
const PreviewPage = DEV ? lazy(() => import('../preview/PreviewPage').then((m) => ({ default: m.PreviewPage }))) : null
const MapPrototype = DEV ? lazy(() => import('../preview/map/MapPrototype').then((m) => ({ default: m.MapPrototype }))) : null
const SheetDemo = DEV ? lazy(() => import('../preview/sheet/SheetDemo').then((m) => ({ default: m.SheetDemo }))) : null

/** The app: one page, the screen is chosen by the address. */
export function App() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

function Screen() {
  const route = useRoute()
  switch (route.page) {
    case 'home':
      return <HomeScreen />
    case 'editor':
      return <EditorScreen key={route.campaign} campaignId={route.campaign} tab={route.tab} map={route.map} />
    case 'play':
      return <MasterGame key={route.campaign} campaignId={route.campaign} />
    case 'join':
      return <PlayerGame key={route.code + (route.stub ? '/stub' : '')} code={route.code} stub={route.stub} />
    case 'preview':
      return PreviewPage ? <PreviewPage section={route.section} /> : <HomeScreen />
    case 'map':
      return MapPrototype ? <MapPrototype /> : <HomeScreen />
    case 'sheet':
      return SheetDemo ? <SheetDemo /> : <HomeScreen />
  }
}
