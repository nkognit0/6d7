// Export and import of `.6d7` archives in the browser: the files come from the media store and
// the tile store of this browser.
import { getMedia, putMedia } from '../../game/media/media'
import { newId } from '../../map/core/geometry'
import { importMapImage } from '../../map/image/pyramid'
import { ARCHIVE_EXT, ArchiveError, packArchive, packGame, unpackArchive, unpackGame, type ArchiveFiles } from '../archive'
import { exploredKey, GAME_KEY, gameMapKey } from '../game'
import type { CampaignSession } from '../session'
import { mapKey, seatKey, type CampaignDocs, type Change } from '../types'
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

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** «Экспортировать»: the browser saves the archive into the downloads. */
export async function downloadArchive(docs: CampaignDocs): Promise<void> {
  download(await archiveBlob(docs), archiveName(docs.campaign.name))
}

/** «Экспортировать состояние игры»: the game and the seats as a file of its own. */
export async function downloadGame(docs: CampaignDocs, suffix: string): Promise<void> {
  const blob = new Blob([await packGame(docs, files)], { type: 'application/zip' })
  download(blob, archiveName(`${docs.campaign.name} — ${suffix}`))
}

// what replaces the game of `now` with another game (none — the game goes)
function gameChanges(now: CampaignDocs, next: Pick<CampaignDocs, 'game' | 'gameMaps' | 'explored'>): Change[] {
  const changes: Change[] = []
  for (const id of Object.keys(now.gameMaps ?? {})) if (!next.gameMaps?.[id]) changes.push({ doc: gameMapKey(id), drop: true })
  for (const id of Object.keys(now.explored ?? {})) if (!next.explored?.[id]) changes.push({ doc: exploredKey(id), drop: true })
  for (const [id, gm] of Object.entries(next.gameMaps ?? {})) changes.push({ doc: gameMapKey(id), set: gm })
  for (const [id, ex] of Object.entries(next.explored ?? {})) changes.push({ doc: exploredKey(id), set: ex })
  if (next.game) changes.push({ doc: GAME_KEY, set: next.game })
  else if (now.game) changes.push({ doc: GAME_KEY, drop: true })
  return changes
}

/**
 * «Импортировать состояние игры»: the game and the seats of the archive replace those of the open
 * campaign. Only a state of this campaign is taken (its maps are known by their ids).
 */
export async function importGameInto(session: CampaignSession, file: Blob): Promise<void> {
  const state = await unpackGame(new Uint8Array(await file.arrayBuffer()), files)
  if (state.campaign !== session.id) throw new ArchiveError('otherCampaign')
  const now = session.docs()
  const changes = gameChanges(now, state)
  for (const id of Object.keys(now.seats)) if (!state.seats[id]) changes.push({ doc: seatKey(id), drop: true })
  for (const [id, seat] of Object.entries(state.seats)) changes.push({ doc: seatKey(id), set: seat })
  session.apply(changes, { record: false })
  await session.save()
}

/**
 * «Импорт» of the editor: the open campaign becomes the campaign of the archive — one step of the
 * history, so «Отменить» brings the old one back. Players get new codes.
 */
export async function importInto(session: CampaignSession, file: Blob): Promise<void> {
  const docs = await unpackArchive(new Uint8Array(await file.arrayBuffer()), files)
  const now = session.docs()
  const changes: Change[] = [{ doc: 'campaign', set: { ...docs.campaign, id: session.id } }]
  for (const id of Object.keys(now.maps)) if (!docs.maps[id]) changes.push({ doc: mapKey(id), drop: true })
  for (const [id, scene] of Object.entries(docs.maps)) changes.push({ doc: mapKey(id), set: scene })
  for (const id of Object.keys(now.seats)) if (!docs.seats[id]) changes.push({ doc: seatKey(id), drop: true })
  for (const [id, seat] of Object.entries(docs.seats)) changes.push({ doc: seatKey(id), set: seat })
  changes.push(...gameChanges(now, docs))
  // the old codes go first: the players tab asks for codes as soon as the players change
  await repo.resetCodes(session.id)
  session.apply(changes)
}

/** «Импорт» of the home screen: an archive becomes a new campaign; its id. */
export async function importArchive(file: Blob): Promise<string> {
  const docs = await unpackArchive(new Uint8Array(await file.arrayBuffer()), files)
  const id = newId()
  await repo.write({ ...docs, campaign: { ...docs.campaign, id } })
  return id
}
