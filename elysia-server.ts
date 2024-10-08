import { Elysia, t } from 'elysia'
import {
  dbOnVolume,
  listVolume,
  readFromVolume,
  writeToVolume,
  deleteFromVolume,
} from './src/volumes'
import { generateCodeStream, sudoAnthropic } from './src/claude'
import { Auth } from '@auth/core'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { websocketHandlers, type ClientData } from './src/realtime'
import { compileReact } from 'src/render'
import { AUTH_CONFIG } from 'src/auth'
import { swagger } from '@elysiajs/swagger'

const app = new Elysia()
  .use(swagger())
  // Error handler; must be defined before the routes it will catch
  .onError(({ error, set, request }) => {
    console.error(`Server error on path ${request.url}:`, error)
    set.status = 500
    set.headers['Content-Type'] = 'text/html'
    return `<pre>Error on path: ${request.url}\n\n${JSON.stringify(
      error,
      null,
      2
    )}\n${error.stack}</pre>`
  })
  // Handle authentication
  .group('/auth', (app) => {
    const handleAuthRequest = ({ request }: { request: Request }) => {
      let newReq = request
      if (request.headers.get('x-forwarded-proto') === 'https') {
        newReq = new Request(request.url.replace(/^http:/, 'https:'), request)
      }
      return Auth(newReq, AUTH_CONFIG)
    }
    // Handle all /auth/* GET and POST requests with handleAuthRequest
    // Unfortunately loses types for the /auth endpoints...
    return app.all('/*', handleAuthRequest)
  })

  // At /transpile, transpile the code and return it
  .post('/transpile', ({ body }) => compileReact(body), {
    body: t.String(),
  })

  // Generate streaming response for app creation
  // TODO: support streaming responses for other Anthropic calls
  .post(
    '/generate-stream',
    async ({ body, set }) => {
      const stream = await generateCodeStream(body)
      set.headers['Content-Type'] = 'text/plain'
      return async function* () {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            yield event.delta.text
          }
        }
      }
    },
    {
      body: t.String(),
    }
  )

  // Write this file to disk
  .post(
    '/write',
    async ({ body }) => {
      await writeToVolume(body.filename, body.content)
      return { success: true }
    },
    {
      type: 'json',
      body: t.Object({
        filename: t.String(),
        content: t.String(),
      }),
    }
  )

  // Route to the corresponding file in the /app directory
  .get('/app/*', async ({ params, set }) => {
    const filename = params['*']
    const source = await readFromVolume(filename)
    return compileReact(source)
  })

  // Use app/editor.tsx to edit the code in the /codegen directory
  .get('/edit/*', async ({ params, set }) => {
    const filename = params['*']
    let source
    try {
      source = await readFromVolume(filename)
    } catch (error) {
      console.log('Error reading file:', filename, error)
      source = `export default function Component() { return <div>File not found: ${filename}</div> }`
    }
    const editor = await readFromVolume('buni/editor.tsx')
    return compileReact(editor, { initialCode: source })
  })

  // Serve /codegen/blah.tsx files as ES modules, so you can:
  // `import Component from "http://localhost:3000/esm/filename.tsx"`
  .get('/esm/*', async ({ params, set }) => {
    const filename = params['*']
    const contents = await readFromVolume(filename)
    let js = contents
    const extension = filename.split('.').pop()
    if (extension === 'tsx' || extension === 'ts') {
      const transpiler = new Bun.Transpiler({
        loader: extension,
        tsconfig: { compilerOptions: { jsx: 'react-jsxdev' } },
      })
      js = transpiler.transformSync(contents)
      js = `import { jsxDEV } from 'react/jsx-dev-runtime';\n${js}`
    }
    set.headers['Content-Type'] = 'application/javascript'
    return js
  })

  // Route DB operations through server for now
  // Though, maybe we can just use /db/query for all of them?'
  // Run seems to support multi-query, and also we permit creating new dbs here.
  .post(
    '/db/run',
    async ({ body }) => {
      const db = dbOnVolume(body.filename, { create: true })
      db.run(body.content)
      return { success: true }
    },
    {
      type: 'json',
      body: t.Object({
        filename: t.String(),
        content: t.String(),
      }),
    }
  )

  .post(
    '/db/query',
    async ({ body }) => {
      const db = dbOnVolume(body.filename)
      return db.query(body.query).all(body.params ?? {})
    },
    {
      type: 'json',
      body: t.Object({
        filename: t.String(),
        query: t.String(),
        params: t.Optional(t.Record(t.String(), t.Any())),
      }),
    }
  )

  // Proxy requests to Anthropic using our API key
  .post(
    '/anthropic',
    async ({ body }) => {
      return await sudoAnthropic(body as any)
    },
    {
      type: 'json',
      body: t.Any(),
    }
  )

  // List volumes route
  .get('/ls', () => listVolume())

  // Delete route
  .get('/delete/:appName', async ({ params }) => {
    console.log('Deleting', params.appName)
    await deleteFromVolume(params.appName)
    return { success: true }
  })

  // Take a screenshot? Not currently working except locally
  .get(
    '/screenshot',
    async ({ query, set }) => {
      if (!query.url) {
        set.status = 400
        return 'Missing URL parameter'
      }

      try {
        let executablePath =
          process.env.NODE_ENV === 'production'
            ? '/usr/local/chrome-headless-shell'
            : [
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
              ].find(existsSync)

        if (!executablePath) {
          throw new Error(
            'Could not find Chrome installation. Please install Chrome.'
          )
        }

        const browser = await puppeteer.launch({
          executablePath,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const page = await browser.newPage()
        await page.goto(query.url)
        const screenshot = await page.screenshot({ type: 'png' })
        await browser.close()

        set.headers['Content-Type'] = 'image/png'
        return screenshot
      } catch (error) {
        console.error('Screenshot error:', error)
        set.status = 500
        return `Failed to generate screenshot: ${error}`
      }
    },
    {
      query: t.Object({
        url: t.String(),
      }),
    }
  )

  // Homepage should redirect to /app/artifact/app.tsx on this server
  .get('/', async () => {
    const artifact = await readFromVolume('artifact/app.tsx')
    return compileReact(artifact)
  })

  .get('/favicon.ico', () => {
    // Return the lucide-react "split" icon, which looks like a "Y"
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-split"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>`
    return new Response(svgIcon, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'cache-control': 'public, max-age=86400', // Cached for 1 day
      },
    })
  })

  // Listen for realtime updates to SQLite dbs
  .ws('/realtime', websocketHandlers as any)

const PORT = 3000
app.listen(PORT)

console.log(`========== Running on http://localhost:${PORT} ==========`)
