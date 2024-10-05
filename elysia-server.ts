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

const app = new Elysia()
  // Auth routes
  .group('/auth', (app) => {
    const handleAuthRequest = ({ request }) => {
      let newReq = request
      if (request.headers.get('x-forwarded-proto') === 'https') {
        newReq = new Request(request.url.replace(/^http:/, 'https:'), request)
      }
      return Auth(newReq, AUTH_CONFIG)
    }
    return app
      .get('/signin', handleAuthRequest)
      .get('/signout', handleAuthRequest)
      .get('/session', handleAuthRequest)
  })

  // Transpile route
  .post('/transpile', ({ body }) => compileReact(body), {
    body: t.String(),
  })

  // Generate stream route
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

  // Write route
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

  // App route
  .get('/app/*', async ({ params, set }) => {
    try {
      const filename = params['*']
      const source = await readFromVolume(filename)
      return compileReact(source)
    } catch (error) {
      set.status = 404
      return 'File not found'
    }
  })

  // Edit route
  .get('/edit/*', async ({ params, set }) => {
    try {
      const filename = params['*']
      const source = await readFromVolume(filename)
      const editor = await readFromVolume('buni/editor.tsx')
      return compileReact(editor, { initialCode: source })
    } catch (error) {
      console.log('cannot edit', error)
      set.status = 404
      return 'File not found'
    }
  })

  // ESM route
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

  // DB routes
  .post(
    '/db/run',
    async ({ body }) => {
      const db = dbOnVolume(body.filename)
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

  // Anthropic route
  .post(
    '/anthropic',
    async ({ body }) => {
      return await sudoAnthropic(body)
    },
    {
      type: 'json',
      body: t.Any(),
    }
  )

  // List volumes route
  .get('/ls', () => listVolume())

  // Delete route
  .delete('/delete/:appName', async ({ params }) => {
    await deleteFromVolume(params.appName)
    return { success: true }
  })

  // Screenshot route
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
        return `Failed to generate screenshot: ${error.message}`
      }
    },
    {
      query: t.Object({
        url: t.String(),
      }),
    }
  )

  // Homepage route
  .get('/', async () =>
    compileReact(await Bun.file('./app/artifact.tsx').text())
  )

  // WebSocket handler
  .ws('/realtime', websocketHandlers)

  // Error handler
  .onError(({ error, set }) => {
    console.error('Server error:', error)
    set.status = 500
    set.headers['Content-Type'] = 'text/html'
    return `<pre>${error}\n${error.stack}</pre>`
  })

app.listen(4000)

console.log('========== Running on http://localhost:4000 ==========')
