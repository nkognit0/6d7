import { EditorScreen } from '../editor/EditorScreen'
import { PlayerGame } from '../game/player/PlayerGame'
import { HomeScreen } from '../home/HomeScreen'
import { useStrings } from '../i18n'
import { MapPrototype } from '../preview/map/MapPrototype'
import { PreviewPage } from '../preview/PreviewPage'
import { SheetDemo } from '../preview/sheet/SheetDemo'
import { routeHash, useRoute } from './route'
import styles from './App.module.css'

// a screen of a later step: what will be here and the pages that already work
function Stub({ text }: { text: string }) {
  const s = useStrings().stub
  return (
    <main className={styles.stub}>
      <p>{text}</p>
      <nav className={styles.links}>
        <a href={routeHash({ page: 'home' })}>{s.home}</a>
        <a href={routeHash({ page: 'preview' })}>{s.preview}</a>
        <a href={routeHash({ page: 'map' })}>{s.map}</a>
        <a href={routeHash({ page: 'sheet' })}>{s.sheet}</a>
      </nav>
    </main>
  )
}

/** The app: one page, the screen is chosen by the address. */
export function App() {
  const route = useRoute()
  const s = useStrings().stub
  switch (route.page) {
    case 'home':
      return <HomeScreen />
    case 'editor':
      return <EditorScreen key={route.campaign} campaignId={route.campaign} tab={route.tab} map={route.map} />
    case 'play':
      return <Stub text={s.play} />
    case 'join':
      return <PlayerGame key={route.code} code={route.code} />
    case 'preview':
      return <PreviewPage section={route.section} />
    case 'map':
      return <MapPrototype />
    case 'sheet':
      return <SheetDemo />
  }
}
