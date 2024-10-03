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

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname.slice(1)

    // Handle authentication
    if (path.startsWith('auth/')) {
      console.log('Auth request headers:', req.headers)
      console.log('Auth request cookies:', req.headers.get('cookie'))

      // in prod, I'm seeing missingCSRF....
      // https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/lib/actions/callback/oauth/csrf-token.ts#L26 is where csrfToken gets validated
      // csrfToken may have been included as part of this post request; log it:

      let newReq = req
      if (req.headers.get('x-forwarded-proto') === 'https') {
        // If fly rewrote the URL to http, rewrite it to https for AuthJS
        newReq = new Request(req.url.replace(/^http:/, 'https:'), req)

        console.log('newReq headers:', newReq.headers)
        console.log('newReq cookies:', newReq.headers.get('cookie'))

        try {
          const clonedReq = req.clone()
          console.log('clonedReq', await clonedReq.formData())
          console.log('req', await req.formData())
          console.log('req.url', req.url)
        } catch (error) {
          // console.error('Error logging form data:', error)
        }
      }

      // Supported routes for client apps to call:
      // /auth/signin
      // /auth/signout
      // /auth/session
      return await Auth(newReq, AUTH_CONFIG)
    }

    // To get user info:
    // const session = await getSession(req)

    // At /transpile?code=..., transpile the code and return it
    // Note: badly named as we're just building here
    if (path === 'transpile') {
      // Accepts POST and GET
      const code =
        req.method === 'POST' ? await req.text() : url.searchParams.get('code')
      return compileReact(decodeURIComponent(code ?? ''))
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

    // Route to the corresponding file in the /app directory
    if (path.startsWith('app/')) {
      const filename = path.slice('app/'.length)
      let source
      try {
        source = await readFromVolume(filename)
      } catch (error) {
        // If the file is not found, return a 404 response
        return new Response('File not found', { status: 404 })
      }
      return compileReact(source)
    }

    // Use app/editor.tsx to edit the code in the /codegen directory
    if (path.startsWith('edit/')) {
      const filename = path.slice(5)
      let source
      try {
        source = await readFromVolume(filename)
      } catch (error) {
        // If the file is not found, return a 404 response
        return new Response('File not found', { status: 404 })
      }

      const editor = await readFromVolume('buni/editor.tsx')
      return compileReact(editor, { initialCode: source })
    }

    // Serve /codegen/blah.tsx files as ES modules, so you can:
    // `import Component from "http://localhost:3000/esm/filename.tsx"`
    // TODO: currently expects an extension, but could guess at .ts/tsx/js/jsx
    if (path.startsWith('esm/')) {
      const filename = path.slice(4)
      const contents = await readFromVolume(filename)

      let js = contents
      // Detect file extension: if .ts(x), transpile to js via Bun
      const extension = path.split('.').pop()
      if (extension === 'tsx' || extension === 'ts') {
        const transpiler = new Bun.Transpiler({
          loader: extension,
          tsconfig: {
            compilerOptions: {
              jsx: 'react-jsxdev',
            },
          },
        })
        js = transpiler.transformSync(contents)
        // Hack: append jsxDev import from esm.sh
        js = `import { jsxDEV } from 'react/jsx-dev-runtime';\n${js}`
      }
      console.log('transpiled', filename, 'to', js)
      return new Response(js, {
        headers: { 'Content-Type': 'application/javascript' },
      })
    }

    if (path === 'favicon.ico') {
      return new Response(null, { status: 404 })
    }

    // Route DB operations through server for now
    if (path.startsWith('db/')) {
      if (path === 'db/run') {
        const { filename, content } = (await req.json()) as {
          filename: string
          content: string
        }
        const db = dbOnVolume(filename)
        db.run(content)
      }
      if (path === 'db/query') {
        const { filename, query, params } = (await req.json()) as {
          filename: string
          query: string
          params: Record<string, any>
        }
        const db = dbOnVolume(filename)
        const result = db.query(query).all(params)
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (path === 'anthropic') {
      const body = await req.json()
      const msg = await sudoAnthropic(body as any)
      return new Response(JSON.stringify(msg), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (path === 'ls') {
      return new Response(JSON.stringify(listVolume()), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (path.startsWith('delete/')) {
      const appName = path.slice('delete/'.length)
      // Delete the corresponding folder
      await deleteFromVolume(appName)
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // New realtime WebSocket handler
    if (path === 'realtime') {
      const success = server.upgrade(req, {
        data: {} as ClientData,
      })
      if (success) {
        // Upgrade successful
        return new Response(null, { status: 200 })
      }
      // Upgrade failed
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    if (path === 'screenshot') {
      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) {
        return new Response('Missing URL parameter', { status: 400 })
      }

      try {
        let executablePath
        if (process.env.NODE_ENV === 'production') {
          executablePath = '/usr/local/chrome-headless-shell'
        } else {
          // For local development, try to find Chrome in common locations
          // TODO: pretty hacky. Consider using puppeteer for local dev?
          const possiblePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
          ]
          executablePath = possiblePaths.find((path) => existsSync(path))
          if (!executablePath) {
            throw new Error(
              'Could not find Chrome installation. Please install Chrome.'
            )
          }
        }

        console.log('Launching browser with executablePath:', executablePath)
        const browser = await puppeteer.launch({
          executablePath,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const page = await browser.newPage()
        await page.goto(targetUrl)
        const screenshot = await page.screenshot({ type: 'png' })
        await browser.close()

        return new Response(screenshot, {
          headers: { 'Content-Type': 'image/png' },
        })
      } catch (error) {
        console.error('Screenshot error:', error)
        return new Response('Failed to generate screenshot: ' + error.message, {
          status: 500,
        })
      }
    }

    // Use app/artifact as the homepage for now:
    return compileReact(await Bun.file('./app/artifact.tsx').text())
  },
  websocket: websocketHandlers,
})

console.log('========== Running on http://localhost:3000 ==========')
