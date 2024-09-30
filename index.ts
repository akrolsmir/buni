import {
  dbOnVolume,
  listVolume,
  readFromVolume,
  writeToVolume,
  deleteFromVolume,
} from './src/volumes'
import { generateCodeStream, sudoAnthropic } from './src/claude'
import { Auth, type AuthConfig } from '@auth/core'
import { getToken } from '@auth/core/jwt'
import Google from '@auth/core/providers/google'
import { unlinkSync, existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

// Build the complete HTML for a given snippet of React code
// Generally runs in 2-20ms
export async function compileReact(
  componentCode: string,
  props: Record<string, any> = {}
) {
  // Generate a unique hash for this pair of componentCode and props,
  // to avoid race conditions between different requests
  const hash = Bun.hash(componentCode + JSON.stringify(props))

  // Write out App.tsx and main.tsx to temp files in /dist
  await Bun.write(`./dist/App.${hash}.tsx`, componentCode)

  const main = `
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from '../dist/App.${hash}.tsx';

  const props = ${JSON.stringify(props)};

  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <App {...props} />
    </React.StrictMode>
  );
  `
  await Bun.write(`./dist/main.${hash}.tsx`, main)

  // Build from the temp files
  const built = await Bun.build({
    entrypoints: [`./dist/main.${hash}.tsx`],
    // Don't bundle stuff we importmap from esm.sh
    external: ['react', 'react-dom', '@uiw/react-textarea-code-editor'],
  })
  // Delete the temp files
  unlinkSync(`./dist/App.${hash}.tsx`)
  unlinkSync(`./dist/main.${hash}.tsx`)

  if (!built.success) {
    console.error(built.logs)
    throw new Error('Failed to build: ' + built.logs)
  }
  const bundled = await built.outputs[0].text()
  const sanitized = bundled.replace(/<\/script>/g, '<\\/script>')

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
        <script type="module">${sanitized}</script>
      </body>
    </html>
  `
  // For debugging: write the HTML to a file with a timestamp
  // Bun.write(`./dist/test-${Date.now()}.html`, html)

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}

const authConfig: AuthConfig = {
  providers: [
    Google({
      // TODO: Separate auth variables for dev vs prod
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  // debug: true,
  // callbacks: {
  //   // Adding the access token means that you can make future API calls
  //   // to eg Google as the user. Lasts 3600s = 1h
  //   async jwt({ token, account, user }) {
  //     // TODO: Register user in our DB?
  //     if (account) {
  //       token.accessToken = account.access_token
  //     }
  //     return token
  //   },
  //   async session({ session, token }) {
  //     session.user.accessToken = token.accessToken
  //     return session
  //   },
  // },
}

async function getSession(req: Request) {
  return await getToken({ req, secret: process.env.AUTH_SECRET })
}

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname.slice(1)

    // Handle authentication
    if (path.startsWith('auth/')) {
      return await Auth(req, authConfig)
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

    if (path === 'screenshot') {
      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) {
        return new Response('Missing URL parameter', { status: 400 })
      }

      try {
        let executablePath
        if (process.env.NODE_ENV === 'production') {
          executablePath = '/usr/local/bin/chrome-headless-shell'
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
})

console.log('========== Running on http://localhost:3000 ==========')
