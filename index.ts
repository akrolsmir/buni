import { Database } from 'bun:sqlite'
import { buniPlugin } from './buni-loader'
import { Glob } from 'bun'
import { writeToVolume, readFromVolume, listVolume } from './volumes'

const db = new Database('routes.sqlite')
initializeDatabase()

// Build the complete HTML for a given snippet of React code
export async function compileReact(componentCode: string) {
  // Output component code to /dist/App.tsx, where main.tsx imports it
  Bun.write('./dist/App.tsx', componentCode)
  const built = await Bun.build({
    entrypoints: ['./app/main.tsx'],
    outdir: './dist',
  })
  const bundled = await built.outputs[0].text()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module">${bundled}</script>
      </body>
    </html>
  `

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname.slice(1)

    // Copy over code from /app/counter.tsx to /app/components/counter.tsx
    const counterText = await Bun.file('./app/counter.tsx').text()
    // append current time in HH:MM:SS to the filename in 24h format
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    await writeToVolume(`counter-${timestamp}.tsx`, counterText)
    // List all files in /app/components via Bun's glob
    const files = await listVolume()
    console.log('Files found', files)

    // At /transpile?code=..., transpile the code and return it
    if (path === 'transpile') {
      // Accepts POST and GET
      const code =
        req.method === 'POST' ? await req.text() : url.searchParams.get('code')
      return compileReact(decodeURIComponent(code ?? ''))
    }

    // Route to the corresponding file in the /app directory
    if (path.startsWith('app/')) {
      const router = new Bun.FileSystemRouter({
        style: 'nextjs',
        dir: './',
      })
      const match = router.match(url.pathname)
      const path = match?.filePath ?? ''

      const source = await Bun.file(path).text()
      return compileReact(source)
    }

    const reactCounterTsx = `
    import { useState } from 'react'
    export default function Counter() {
      const [count, setCount] = useState(0)
      return (
        <div>
          <p>Count: {count}</p>
          <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
      )
    }
    `

    if (path === 'counter') {
      return compileReact(reactCounterTsx)
    }

    // URL shortener logic:
    const redirect = getRedirect(path)

    // Redirect if the shortcut already exists
    if (redirect) {
      const redirectUrl =
        redirect.startsWith('http://') || redirect.startsWith('https://')
          ? redirect
          : `https://${redirect}`
      return Response.redirect(redirectUrl, 302)
    }

    // If going to /db, send the routes.sqlite file
    if (path === 'db') {
      return new Response(Bun.file('routes.sqlite'), {
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    }

    // Otherwise, if it's a form submission, add the new shortcut
    if (req.method === 'POST') {
      const formData = await req.formData()
      const path = formData.get('path') as string
      const url = formData.get('url') as string

      if (path && url) {
        createShortcut(path, url)
      }
    }

    // Then render the homepage form
    const routes = getAllRoutes()
    const routesList = routes
      .map(
        (route) =>
          `<li><a href="/${route.path}">${route.path}</a> -> ${route.url}</li>`
      )
      .join('')

    const form = `
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
    />
    <body class="container">
      <h1>URL Shortener</h1>
      No shortcut yet for ${url.pathname.slice(1)}<br /><br />
      <form method="POST">
        <fieldset class="grid">
          <input name="path" placeholder="Short path" required value="${path}">
          <input name="url" placeholder="Full URL" required>
          <button type="submit">Create Shortcut</button>
        </fieldset>
      </form>
      <h2>Existing Routes</h2>
      <ul>
        ${routesList}
      </ul>
      <h2>Files in /app/codegen</h2>
      <ul>
        ${files.map((file) => `<li>${file}</li>`).join('')}
      </ul>
    </body>
    `

    return new Response(form, {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  },
})

console.log(
  '========== URL shortener running on http://localhost:3000 ==========='
)

function initializeDatabase() {
  db.run(
    'CREATE TABLE IF NOT EXISTS routes (path TEXT PRIMARY KEY, url TEXT NOT NULL)'
  )
}

type Route = {
  path: string
  url: string
}

function getRedirect(path: string) {
  const result = db.query('SELECT url FROM routes WHERE path = ?').get(path)
  return (result as { url: string } | null)?.url ?? ''
}

function getAllRoutes() {
  return db.query('SELECT path, url FROM routes').all() as Route[]
}

function createShortcut(path: string, url: string) {
  db.run('INSERT OR REPLACE INTO routes (path, url) VALUES (?, ?)', [path, url])
}
