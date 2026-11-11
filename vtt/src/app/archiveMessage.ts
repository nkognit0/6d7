import { ArchiveError } from '../campaign'
import type { Catalog } from '../i18n'

/** What a failed import or export says: the archive's problem or the refused storage. */
export function archiveMessage(e: unknown, s: Catalog): string {
  if (!(e instanceof ArchiveError)) return s.campaign.storageFailed
  const c = s.campaign
  switch (e.code) {
    case 'version': return c.archiveVersion
    case 'damaged': return c.archiveDamaged
    case 'game': return c.archiveIsGame
    case 'notGame': return c.archiveNotGame
    case 'otherCampaign': return c.archiveOtherCampaign
    default: return c.archiveFormat
  }
}
