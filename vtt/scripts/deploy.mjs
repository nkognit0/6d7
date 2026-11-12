// Publishes the app on GitHub Pages (https://nkognit0.github.io/6d7/): builds it here (the rules
// logic and the pictures live in ../app and ../dnd-db, which are not in the repository), adds the
// item and spell icons and the NPC tokens the dev server takes from app/public, and force-pushes
// the result to the gh-pages branch of the repository's origin as one commit.
//   npm run deploy            build and publish
//   npm run deploy -- --dry   build only (dist/ is the site; `npx vite preview` shows it)
import { execFileSync } from 'node:child_process'
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const vtt = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(vtt, '..')
const dist = resolve(vtt, 'dist')
const dry = process.argv.includes('--dry')
const AUTHOR = ['-c', 'user.name=nkognit0', '-c', 'user.email=85009858+nkognit0@users.noreply.github.com']

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
const read = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim()

run('npm', ['run', 'build'], vtt)

// the pictures the code points to by relative paths: icons/items, icons/spells, tokens
for (const p of ['icons/items', 'icons/spells', 'tokens']) cpSync(resolve(root, 'app/public', p), resolve(dist, p), { recursive: true })
// without Jekyll: it would hide files that start with «_» (icons/items/_item.svg)
writeFileSync(resolve(dist, '.nojekyll'), '')

if (dry) process.exit(0)

const origin = read('git', ['remote', 'get-url', 'origin'], root)
const source = read('git', ['rev-parse', '--short', 'HEAD'], root)
const dirty = read('git', ['status', '--porcelain'], root) ? ' + незакоммиченные правки' : ''
rmSync(resolve(dist, '.git'), { recursive: true, force: true })
run('git', ['init', '-q', '-b', 'gh-pages'], dist)
run('git', ['add', '-A'], dist)
run('git', [...AUTHOR, 'commit', '-q', '-m', `Сайт из ${source}${dirty}`], dist)
run('git', ['push', '-f', origin, 'gh-pages'], dist)
rmSync(resolve(dist, '.git'), { recursive: true, force: true })
console.log('Опубликовано: https://nkognit0.github.io/6d7/ (Pages обновляется за минуту-две)')
