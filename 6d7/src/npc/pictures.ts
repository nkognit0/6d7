// The map draws catalog NPCs by the id of their token: the screens with a map (the editor, the
// games) import this module, the home screen does not load the catalog.
import { resolveCatalog } from '../map/engine/images'
import { npcToken } from './catalog'

resolveCatalog((id) => npcToken(id)?.url)
