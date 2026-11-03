/** Picture formats a map can be uploaded in; the browser decodes all of them itself. */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif'

/** `accept` of the file input. */
export const MAP_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif'

/** The longest side the editor takes (larger pictures do not fit the GPU of a PC). */
export const MAX_IMAGE_SIDE = 16384

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

/** Format by the first bytes of the file, not by its name. */
export function sniffFormat(b: Uint8Array): ImageFormat | null {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(b, 8, 12))) return 'avif'
  return null
}
