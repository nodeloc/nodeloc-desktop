import { nativeImage, type NativeImage } from 'electron'

let cached: NativeImage | null = null

/**
 * The taskbar overlay: a small red dot, drawn in code so no asset is needed.
 * Anti-aliased by coverage at the circle's edge.
 */
export function unreadBadge(): NativeImage {
  if (cached) return cached
  const size = 16
  const radius = 7
  const center = (size - 1) / 2
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center)
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - distance))
      const offset = (y * size + x) * 4
      // BGRA, premultiplied by coverage.
      pixels[offset] = Math.round(0x4d * alpha)
      pixels[offset + 1] = Math.round(0x48 * alpha)
      pixels[offset + 2] = Math.round(0xe5 * alpha)
      pixels[offset + 3] = Math.round(255 * alpha)
    }
  }
  cached = nativeImage.createFromBitmap(pixels, { width: size, height: size })
  return cached
}
