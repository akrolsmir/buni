import { useEffect, useState } from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'
import { createApp, listApps } from '../codegen/buni/db'

// TODO: Actually bootstrap this?
const DEFAULT_CODE = `// Enter a prompt to get started!
`

// Centered single input which takes in a prompt like "a todo list"
// On submit, generates an artifact using Claude Sonnet
export default function Artifact() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(DEFAULT_CODE)

  async function generateArtifactStream() {
    setGenerating(true)
    await createApp({
      creator_id: 'austin',
      app_name: appName(prompt),
      description: prompt,
    })

    // Streaming API, so continually update the state with the new text
    const res = await fetch('/generate-stream', {
      method: 'POST',
      body: prompt,
    })

    const decoder = new TextDecoder()
    if (!res.body) return
    setGenerated('')
    let content = ''
    for await (const chunk of res.body) {
      content += decoder.decode(chunk)
      setGenerated(content)
    }

    // Write the generated code to a file
    const filename = appName(prompt) + '/app.tsx'
    await fetch('/write', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content: content,
      }),
    })

    window.location.href = `/edit/${filename}`
    setGenerating(false)
  }

  const [apps, setApps] = useState<App[]>([])
  useEffect(() => {
    listApps().then(setApps)
  }, [])

  return (
    <div className="flex flex-row gap-2">
      <div className="w-1/2 overflow-auto h-screen">
        <div className="h-full">
          <div className="flex flex-col items-center justify-center min-h-screen h-full w-full bg-gray-100">
            <div className="w-full max-w-md p-6 rounded-lg shadow-md">
              <input
                type="text"
                onKeyDown={(e) => e.key === 'Enter' && generateArtifactStream()}
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-4 py-2 mb-4 text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a prompt..."
              />
              <button
                onClick={generateArtifactStream}
                className="w-full px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                disabled={generating}
              >
                {generating ? <Spinner /> : 'Generate app'}
              </button>
            </div>
            <div className="flex flex-col gap-1 w-full max-w-md p-6">
              {apps
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((app) => (
                  <div
                    key={app.app_id}
                    className="overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    <a
                      className="hover:underline text-sm text-gray-500"
                      href={`/edit/${app.app_name}/app`}
                      title={app.description}
                    >
                      {app.description}
                    </a>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-1/2 overflow-auto h-screen">
        <CodeEditor
          value={generated}
          language="tsx"
          placeholder="Please enter TSX code."
          onChange={(event) => setGenerated(event.target.value)}
          padding={15}
          style={{
            backgroundColor: '#f5f5f5',
            fontFamily:
              'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
          }}
        />
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function appName(request: string) {
  return request
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80)
}
