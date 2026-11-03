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
      return <Stub text={s.home} />
    case 'editor':
      return <Stub text={s.editor} />
    case 'play':
      return <Stub text={s.play} />
    case 'join':
      return <Stub text={s.join} />
    case 'preview':
      return <PreviewPage section={route.section} />
    case 'map':
      return <MapPrototype />
    case 'sheet':
      return <SheetDemo />
  }
}
