import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const here = (p: string) => resolve(__dirname, p)

// The rules of D&D — the logic, the database, the sheet's type and the item and spell icons —
// come from the dnd-rules package (a git submodule next to this folder).
const RULES = here('../dnd-rules')
const alias = {
  '@rules': resolve(RULES, 'src'),
  '@rules-data': resolve(RULES, 'data'),
  'dnd-sheet': resolve(RULES, 'src/sheet/index.ts')
}

const TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }

// the item and spell icons of the package on the dev server (the build gets them from scripts/deploy.mjs)
const ICONS = ['/icons/items/', '/icons/spells/']

function rulesIcons(): Plugin {
  return {
    name: 'rules-icons',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0])
        if (!ICONS.some((p) => path.startsWith(p))) return next()
        const file = resolve(RULES, '.' + path)
        if (!file.startsWith(RULES) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'max-age=3600')
        createReadStream(file).pipe(res)
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), rulesIcons()],
  base: './',
  resolve: { alias },
  server: { port: 5176, strictPort: true, fs: { allow: [here('.'), RULES] } },
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  // the rules database is a file of its own: it changes seldom, so the browser keeps it while the code changes
  build: {
    // the colored icons stay files (the code would carry them all as data URLs)
    assetsInlineLimit: (file) => (/[\\/]ui[\\/]icons[\\/]svg[\\/]/.test(file) ? false : undefined),
    rollupOptions: {
      output: { manualChunks: (id) => (/[\\/]dnd-rules[\\/]data[\\/]/.test(id) ? 'rules-data' : undefined) }
    }
  },
  // the package's tests run here too: it has no dependencies of its own
  test: { include: ['src/**/*.test.ts', '../dnd-rules/src/**/*.test.ts'] }
})
