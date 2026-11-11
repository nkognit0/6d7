import { describe, expect, it } from 'vitest'
import { EXPLORED_SIDE, ExploredMask } from './explored'

const square = (x0: number, y0: number, x1: number, y1: number) => [x0, y0, x1, y0, x1, y1, x0, y1]
const at = (m: ExploredMask, x: number, y: number) => m.data[Math.floor(y * (m.h / m.image.height)) * m.w + Math.floor(x * (m.w / m.image.width))]

describe('ExploredMask', () => {
  it('keeps the proportions of the picture', () => {
    const m = new ExploredMask({ width: 2000, height: 1000 })
    expect(m.w).toBe(EXPLORED_SIDE)
    expect(m.h).toBe(EXPLORED_SIDE / 2)
  })

  it('marks what players see and tells listeners once', () => {
    const m = new ExploredMask({ width: 1000, height: 1000 })
    let calls = 0
    m.subscribe(() => calls++)
    expect(m.reveal([square(100, 100, 300, 300)])).toBe(true)
    expect(at(m, 200, 200)).toBe(255)
    expect(at(m, 50, 50)).toBe(0)
    expect(at(m, 400, 200)).toBe(0)
    expect(m.reveal([square(150, 150, 250, 250)])).toBe(false)
    expect(calls).toBe(1)
  })

  it('fills a concave polygon by the even-odd rule', () => {
    const m = new ExploredMask({ width: 1000, height: 1000 })
    // a «U»: the notch between the arms stays closed
    m.reveal([[100, 100, 200, 100, 200, 400, 400, 400, 400, 100, 500, 100, 500, 500, 100, 500]])
    expect(at(m, 150, 300)).toBe(255)
    expect(at(m, 300, 200)).toBe(0)
    expect(at(m, 300, 450)).toBe(255)
  })

  it('new fog closes what it covers; erasing fog changes nothing', () => {
    const m = new ExploredMask({ width: 1000, height: 1000 })
    m.reveal([square(0, 0, 1000, 1000)])
    expect(m.hide({ mode: 'erase', radius: 50, points: [500, 500] })).toBe(false)
    expect(m.hide({ mode: 'paint', radius: 50, points: [200, 500, 800, 500] })).toBe(true)
    expect(at(m, 500, 500)).toBe(0)
    expect(at(m, 500, 600)).toBe(255)
    m.hide({ mode: 'cover' })
    expect(m.empty).toBe(true)
  })

  it('takes a saved mask of the same proportions and drops one of others', () => {
    const m = new ExploredMask({ width: 1000, height: 500 })
    m.reveal([square(0, 0, 500, 500)])
    const saved = m.save()
    expect(at(new ExploredMask({ width: 2000, height: 1000 }, saved), 400, 400)).toBe(255)
    expect(new ExploredMask({ width: 1000, height: 1000 }, saved).empty).toBe(true)
  })
})
