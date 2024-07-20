import { Database } from 'bun:sqlite'

const db = new Database('routes.sqlite')
initializeDatabase()

export function renderReactComponent(componentCode: string): string {
  const transpiler = new Bun.Transpiler({
    loader: 'tsx',
    target: 'browser',
    tsconfig: {
      compilerOptions: {
        // This uses createElement instead of jsxDEV
        jsx: 'react',
      },
    },
  })
  const transpiledCode = transpiler.transformSync(componentCode)
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module">
          const createElement = React.createElement
          ${transpiledCode}
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(Component));
        </script>
      </body>
    </html>
  `

  return html
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname.slice(1)
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

    const reactCounterTsx = `
    function Component() {
      const [count, setCount] = React.useState(0);
      return (
        <div>
          <h1>React Counter</h1>
          <p>Count: {count}</p>
          <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
      )
    }
    `

    if (path === 'counter') {
      const html = renderReactComponent(reactCounterTsx)
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
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
    </body>
    `

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

type Route = {
  path: string
  url: string
}

function getRedirect(path: string) {
  const result = db.query('SELECT url FROM routes WHERE path = ?').get(path)
  return (result as { url: string } | null)?.url
}

function getAllRoutes() {
  return db.query('SELECT path, url FROM routes').all() as Route[]
}

function createShortcut(path: string, url: string) {
  db.run('INSERT OR REPLACE INTO routes (path, url) VALUES (?, ?)', [path, url])
}
