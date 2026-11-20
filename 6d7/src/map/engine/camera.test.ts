import { describe, expect, it } from 'vitest'
import { Camera, FIT_GAP, MAX_PICTURE_SCALE } from './camera'

const bounds = (w: number, h: number, touch = false) => ({ view: { w, h }, image: { width: 3000, height: 2000 }, cell: 100, dpr: 2, touch })

describe('zoom limits (QnA, 14.11.2026)', () => {
  it('zooms in up to 200% of the picture pixels, whatever the screen density', () => {
    expect(new Camera().limits(bounds(1000, 800)).max).toBe(MAX_PICTURE_SCALE)
  })

  it('zooms out until the picture fits with a 48 px gap on every side', () => {
    const { min } = new Camera().limits(bounds(1000, 800))
    // the width is the tighter side here
    expect(min).toBeCloseTo((1000 - 2 * FIT_GAP) / 3000)
    expect(3000 * min + 2 * FIT_GAP).toBeCloseTo(1000)
    expect(2000 * min + 2 * FIT_GAP).toBeLessThanOrEqual(800)
  })

  it('fits by the height when it is the tighter side', () => {
    const { min } = new Camera().limits(bounds(2000, 500))
    expect(min).toBeCloseTo((500 - 2 * FIT_GAP) / 2000)
  })

  it('centers the fitted picture with the gap around it', () => {
    const c = new Camera()
    c.fit(bounds(1000, 800))
    expect(c.x).toBeCloseTo(FIT_GAP)
  })

  it('lets a phone zoom further: at least a 64 px cell', () => {
    expect(new Camera().limits({ ...bounds(400, 800, true), cell: 20 }).max).toBeCloseTo(64 / 20)
  })
})
