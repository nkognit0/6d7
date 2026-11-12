import { EditorScreen } from '../editor/EditorScreen'
import { MasterGame } from '../game/master/MasterGame'
import { PlayerGame } from '../game/player/PlayerGame'
import { HomeScreen } from '../home/HomeScreen'
import { MapPrototype } from '../preview/map/MapPrototype'
import { PreviewPage } from '../preview/PreviewPage'
import { SheetDemo } from '../preview/sheet/SheetDemo'
import { useRoute } from './route'

/** The app: one page, the screen is chosen by the address. */
export function App() {
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
      return <PreviewPage section={route.section} />
    case 'map':
      return <MapPrototype />
    case 'sheet':
      return <SheetDemo />
  }
}
