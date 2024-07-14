import { Database } from 'bun:sqlite'

const db = new Database('routes.sqlite')
initializeDatabase()

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname.slice(1)
    const redirect = getRedirect(path)

    if (redirect) {
      const redirectUrl =
        redirect.url.startsWith('http://') ||
        redirect.url.startsWith('https://')
          ? redirect.url
          : `https://${redirect.url}`
      return Response.redirect(redirectUrl, 302)
    }

    const routes = getAllRoutes()
    const routesList = routes
      .map(
        (route) =>
          `<li><a href="/${route.path}">${route.path}</a> -> ${route.url}</li>`
      )
      .join('')

    const form = `
      <h1>URL Shortener</h1>
      No shortcut yet for ${url.pathname.slice(1)}<br /><br />
      <form method="POST">
        <input name="path" placeholder="Short path" required value="${path}">
        <input name="url" placeholder="Full URL" required>
        <button type="submit">Create Shortcut</button>
      </form>
      <h2>Existing Routes</h2>
      <ul>
        ${routesList}
      </ul>
    `

    if (req.method === 'POST') {
      const formData = await req.formData()
      const path = formData.get('path') as string
      const url = formData.get('url') as string

      if (path && url) {
        createShortcut(path, url)
        return new Response(
          `Shortcut created: ${path} -> ${url}<br><a href="/">Return to home</a>`,
          {
            status: 201,
            headers: { 'Content-Type': 'text/html' },
          }
        )
      }
    }

    return new Response(form, {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  },
})

console.log('URL shortener running on http://localhost:3000')

function initializeDatabase() {
  db.run(
    'CREATE TABLE IF NOT EXISTS routes (path TEXT PRIMARY KEY, url TEXT NOT NULL)'
  )
}

function getRedirect(path: string) {
  return db.query('SELECT url FROM routes WHERE path = ?').get(path) as {
    url: string
  } | null
}

function getAllRoutes() {
  return db.query('SELECT path, url FROM routes').all() as {
    path: string
    url: string
  }[]
}

function createShortcut(path: string, url: string) {
  db.run('INSERT OR REPLACE INTO routes (path, url) VALUES (?, ?)', [path, url])
}
