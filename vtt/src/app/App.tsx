import { useEffect, useState } from 'react'
import { repo } from '../campaign'
import { EditorScreen } from '../editor/EditorScreen'
import { HomeScreen } from '../home/HomeScreen'
import { useStrings } from '../i18n'
import { MapPrototype } from '../preview/map/MapPrototype'
import { PreviewPage } from '../preview/PreviewPage'
import { SheetDemo } from '../preview/sheet/SheetDemo'
import { routeHash, useRoute } from './route'
import styles from './App.module.css'

// a screen of a later step: what will be here and the pages that already work
function Stub({ text, note }: { text: string; note?: string | null }) {
  const s = useStrings().stub
  return (
    <main className={styles.stub}>
      <p>{text}</p>
      {note && <p>{note}</p>}
      <nav className={styles.links}>
        <a href={routeHash({ page: 'home' })}>{s.home}</a>
        <a href={routeHash({ page: 'preview' })}>{s.preview}</a>
        <a href={routeHash({ page: 'map' })}>{s.map}</a>
        <a href={routeHash({ page: 'sheet' })}>{s.sheet}</a>
      </nav>
    </main>
  )
}

// the player's game is step 7; until then the stub says where the code leads
function JoinStub({ code }: { code: string }) {
  const s = useStrings().stub
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    repo.findCode(code).then(async (t) => {
      const docs = t && (await repo.load(t.campaign))?.docs
      const player = docs?.campaign.players.find((p) => p.id === t?.player)
      if (live) setNote(docs && player ? s.joinSeat(player.name, docs.campaign.name) : s.joinUnknown)
    })
    return () => {
      live = false
    }
  }, [code, s])
  return <Stub text={s.join} note={note} />
}

/** The app: one page, the screen is chosen by the address. */
export function App() {
  const route = useRoute()
  const s = useStrings().stub
  switch (route.page) {
    case 'home':
      return <HomeScreen />
    case 'editor':
      return <EditorScreen key={route.campaign} campaignId={route.campaign} tab={route.tab} />
    case 'play':
      return <Stub text={s.play} />
    case 'join':
      return <JoinStub code={route.code} />
    case 'preview':
      return <PreviewPage section={route.section} />
    case 'map':
      return <MapPrototype />
    case 'sheet':
      return <SheetDemo />
  }
}
