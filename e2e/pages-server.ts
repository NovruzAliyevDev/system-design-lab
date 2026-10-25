// Serves the built site the way GitHub Pages does, for the `pages` e2e project: files under the
// project base path, and `404.html` (with status 404) for any path that is not a file.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

const [dir, base, port] = process.argv.slice(2)
if (!dir || !base || !port) throw new Error('Usage: pages-server <dir> <base path> <port>')
const root = resolve(dir)

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

/** Test hook: once bumped, `sw.js` changes by a comment, as if a new version had been deployed. */
const BUMP_PATH = `${base}__bump-service-worker`
let deploys = 0

/** The file a request path names, if it is inside the site. */
function fileFor(path: string): string | undefined {
  if (!path.startsWith(base)) return undefined
  let file = resolve(root, path.slice(base.length))
  if (file !== root && !file.startsWith(root + sep)) return undefined
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  return existsSync(file) ? file : undefined
}

createServer((request, response) => {
  let path: string
  try {
    path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    response.writeHead(400).end()
    return
  }
  if (path === BUMP_PATH) {
    deploys += 1
    response.writeHead(204).end()
    return
  }

  const file = fileFor(path)
  let body = readFileSync(file ?? join(root, '404.html'))
  if (file === join(root, 'sw.js') && deploys > 0) body = Buffer.concat([body, Buffer.from(`\n// deploy ${deploys}\n`)])

  response
    .writeHead(file ? 200 : 404, {
      'Content-Type': CONTENT_TYPES[file ? extname(file) : '.html'] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    .end(body)
}).listen(Number(port))
