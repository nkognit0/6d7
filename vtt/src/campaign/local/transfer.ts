// Export and import of `.6d7` archives in the browser: the files come from the media store and
// the tile store of this browser.
import { getMedia, putMedia } from '../../game/media/media'
import { newId } from '../../map/core/geometry'
import { importMapImage } from '../../map/image/pyramid'
import { ARCHIVE_EXT, packArchive, unpackArchive, type ArchiveFiles } from '../archive'
import type { CampaignDocs } from '../types'
import { repo } from './LocalRepo'

const files: ArchiveFiles = {
  getMedia: (ref) => getMedia(ref as `media:${string}`),
  putMedia,
  listTiles: (imageId) => repo.tiles.list(imageId),
  putTiles: (imageId, tiles) => repo.tiles.add(imageId, tiles),
  recut: async (original, imageId) => {
    await importMapImage(original, repo.tiles, undefined, imageId)
  }
}

/** The archive of a campaign as a file. */
export async function archiveBlob(docs: CampaignDocs): Promise<Blob> {
  return new Blob([await packArchive(docs, files)], { type: 'application/zip' })
}

/** A file name from the campaign name: without characters file systems refuse. */
export function archiveName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim()
  return (safe || 'campaign') + ARCHIVE_EXT
}

/** «Экспортировать»: the browser saves the archive into the downloads. */
export async function downloadArchive(docs: CampaignDocs): Promise<void> {
  const url = URL.createObjectURL(await archiveBlob(docs))
  const a = document.createElement('a')
  a.href = url
  a.download = archiveName(docs.campaign.name)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * «Импорт»: an archive becomes a new campaign (home screen) or replaces the campaign `into`
 * (editor; close its session first). Players get new codes. Returns the campaign id.
 */
export async function importArchive(file: Blob, into?: string): Promise<string> {
  const docs = await unpackArchive(new Uint8Array(await file.arrayBuffer()), files)
  const id = into ?? newId()
  await repo.write({ ...docs, campaign: { ...docs.campaign, id } })
  return id
}
