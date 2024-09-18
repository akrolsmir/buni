import { Database } from 'bun:sqlite'
import { listVolume, readFromVolume, writeToVolume } from './src/volumes'
import { generateCode, generateCodeStream, modifyCode } from './src/claude'

const db = new Database('routes.sqlite')
initializeDatabase()

// Build the complete HTML for a given snippet of React code
export async function compileReact(
  componentCode: string,
  props: Record<string, any> = {}
) {
  // console.log('compileReact', componentCode.slice(0, 400))
  // Output component code to /dist/App.tsx, where main.tsx imports it
  Bun.write('./dist/App.tsx', componentCode)

  // If props are provided, then in App.tsx, export them as a named export
  if (Object.keys(props).length > 0) {
    Bun.write(
      './dist/App.tsx',
      `${componentCode}\nexport const props = ${JSON.stringify(props)}`
    )
  }

  const built = await Bun.build({
    entrypoints: ['./app/main.tsx'],
    outdir: './dist',
    // Don't bundle stuff we importmap from esm.sh
    external: ['react', 'react-dom', '@uiw/react-textarea-code-editor'],
  })
  if (!built.success) {
    console.error(built.logs)
    throw new Error('Failed to build: ' + built.logs)
  }
  const bundled = await built.outputs[0].text()

  // TODO: generate importmap and css dynamically?
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script type="importmap">
          {
            "imports": {
              "react": "https://esm.sh/react@18.3.1",
              "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
              "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
              "react-dom": "https://esm.sh/react-dom@18.3.1",
              "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
              "@uiw/react-textarea-code-editor": "https://esm.sh/@uiw/react-textarea-code-editor@3.0.2?external=react,react-dom"
            }
          }
        </script>
        <link rel="stylesheet" href="https://esm.sh/@uiw/react-textarea-code-editor/dist.css" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module">${bundled.replace(
          /<\/script>/g,
          '<\\/script>'
        )}</script>
      </body>
    </html>
  `

  // For debugging: write the HTML to a file with a timestamp
  // Bun.write(`./dist/test-${Date.now()}.html`, html)

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname.slice(1)

    // At /transpile?code=..., transpile the code and return it
    if (path === 'transpile') {
      // Accepts POST and GET
      const code =
        req.method === 'POST' ? await req.text() : url.searchParams.get('code')
      return compileReact(decodeURIComponent(code ?? ''))
    }

    if (path === 'generate') {
      const prompt = await req.text()
      const filename = await generateCode(prompt)
      return new Response(
        JSON.stringify({ url: `/edit/${filename.replace(/\.tsx$/, '')}` }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Streaming version of generate
    if (path === 'generate-stream') {
      const prompt = await req.text()
      const stream = await generateCodeStream(prompt)

      return new Response(
        // @ts-ignore - bun supports generators in Response, but TS doesn't know
        (async function* () {
          for await (const event of stream) {
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                yield event.delta.text
              }
            }
          }
        })(),
        {
          headers: { 'Content-Type': 'text/plain' },
        }
      )
    }

    if (path === 'write') {
      const { filename, content } = (await req.json()) as {
        filename: string
        content: string
      }
      await writeToVolume(filename, content)
      return new Response(null, { status: 200 })
    }

    if (path === 'modify') {
      const { code, modify } = (await req.json()) as {
        code: string
        modify: string
      }
      const modifiedCode = await modifyCode(code, modify)
      return new Response(modifiedCode, {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    if (path === 'ls') {
      return new Response(JSON.stringify(listVolume()), {
        headers: { 'Content-Type': 'application/json' },
      })
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

    // Use app/editor.tsx to edit the code in the /codegen directory
    if (path.startsWith('edit/')) {
      const filename = path.slice(5) + '.tsx'
      let source
      try {
        source = await readFromVolume(filename)
      } catch (error) {
        // If the file is not found, return a 404 response
        return new Response('File not found', { status: 404 })
      }

      const editor = await Bun.file('./app/editor.tsx').text()
      return compileReact(editor, { initialCode: source })
    }

    // Use app/artifact as the homepage for now:
    return compileReact(await Bun.file('./app/artifact.tsx').text())

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
