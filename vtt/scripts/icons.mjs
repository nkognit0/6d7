// Copies the icons exported from Figma (assets/icon.*) into src/ui/icons/svg. One-color sets
// (icon.16, icon.28) get currentColor instead of black, so the layout sets their color;
// colored and player sets are copied as they are. Run: npm run icons
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const assets = here('../../assets')
const out = here('../src/ui/icons/svg')
const MONO = new Set(['icon.16', 'icon.28'])

// Colored icons carry their drop shadows inside the SVG, so the file is bigger than the icon.
// All of them use one shadow effect: Figma's export bounds are the drawing plus 8 px left and
// right, 10 px above and 6 px below (checked on the icon frames of the D&D VTT file). The drawing
// is centered in its icon box (16 or 42 px); x, y place that box inside the file.
const PAD = { x: 8, top: 10, bottom: 6 }
function geometry(svg, nominal) {
  const w = Number(svg.match(/<svg[^>]*\swidth="([\d.]+)"/)[1])
  const h = Number(svg.match(/<svg[^>]*\sheight="([\d.]+)"/)[1])
  const drawingW = w - 2 * PAD.x
  const drawingH = h - PAD.top - PAD.bottom
  return { w, h, x: PAD.x - (nominal - drawingW) / 2, y: PAD.top - (nominal - drawingH) / 2 }
}

if (existsSync(out)) rmSync(out, { recursive: true })
const manifest = {}
let count = 0
for (const set of readdirSync(assets).filter((d) => d.startsWith('icon.'))) {
  mkdirSync(`${out}/${set}`, { recursive: true })
  for (const file of readdirSync(`${assets}/${set}`).filter((f) => f.endsWith('.svg'))) {
    // "icon.16.arrows.download.svg" -> "arrows.download.svg"
    const name = file.replace(/^icon\.\d+\./, '')
    if (MONO.has(set)) {
      const svg = readFileSync(`${assets}/${set}/${file}`, 'utf8').replace(/(fill|stroke)="black"/g, '$1="currentColor"')
      writeFileSync(`${out}/${set}/${name}`, svg)
    } else {
      cpSync(`${assets}/${set}/${file}`, `${out}/${set}/${name}`)
      const nominal = Number(set.match(/^icon\.(\d+)/)[1])
      manifest[`${set}/${name}`] = geometry(readFileSync(`${assets}/${set}/${file}`, 'utf8'), nominal)
    }
    count++
  }
}
writeFileSync(`${out}/geometry.json`, JSON.stringify(manifest, null, 1) + '\n')
console.log(`icons: ${count} files -> src/ui/icons/svg`)
