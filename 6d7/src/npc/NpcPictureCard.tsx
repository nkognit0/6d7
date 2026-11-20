import type { ComponentProps } from 'react'
import { useMediaUrl } from '../game/media/media'
import type { MediaRef } from '../game/seat/seat'
import { NpcCard } from '../ui'

/**
 * An NPC card whose picture may be the master's own (`media:<hash>` of the media store), not only
 * a catalog token (QnA, 14.11.2026).
 */
export function NpcPictureCard({ image, ...rest }: ComponentProps<typeof NpcCard>) {
  const media = image.startsWith('media:') ? (image as MediaRef) : null
  const url = useMediaUrl(media)
  return <NpcCard image={media ? (url ?? '') : image} {...rest} />
}
