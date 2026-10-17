import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, join, resolve } from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.png': 'image/png', '.gpx': 'application/gpx+xml',
}

/** Petit serveur statique (CLI d'export, tests) pour apps/web/dist. */
export function serveStatic(dir: string, port = 0): Promise<{ url: string; server: Server }> {
  const root = resolve(dir)
  const server = createServer((req, res) => {
    const p = resolve(join(root, decodeURIComponent((req.url ?? '/').split('?')[0])))
    const file = p.startsWith(root) && existsSync(p) && statSync(p).isFile() ? p : null
    if (!file) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, server })))
}
