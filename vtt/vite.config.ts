import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const here = (p: string) => resolve(__dirname, p)

// The rules logic and its pictures live in the old app (app/src, app/public) and the rules
// database in dnd-db/data; the VTT uses them in place until they move to a shared package.
// 'dnd-sheet' is a shim: the sheet's type and labels without its components and styles.
const alias = {
  '@app': here('../app/src'),
  '@data': here('../dnd-db/data'),
  'dnd-sheet': here('src/game/dndSheet.ts')
}

const TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }

// item and spell icons from app/public on the dev server
function appIcons(): Plugin {
  const root = here('../app/public')
  return {
    name: 'app-icons',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0])
        if (!path.startsWith('/icons/items/') && !path.startsWith('/icons/spells/')) return next()
        const file = resolve(root, '.' + path)
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'max-age=3600')
        createReadStream(file).pipe(res)
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), appIcons()],
  base: './',
  resolve: { alias },
  server: { port: 5176, strictPort: true, fs: { allow: [here('..')] } },
  css: { modules: { localsConvention: 'camelCaseOnly' } }
})
