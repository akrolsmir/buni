import { useEffect, useState } from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'
import { createApp, listApps, unvoteApp, upvoteApp } from '%/buni/db'
import { useUser, AuthButton, type User } from '%/buni/use-auth'
import { Split, Heart } from 'https://esm.sh/lucide-react'
import { extractBlock } from '%/buni/codegen'
import { useRealtime } from '%/buni/use-realtime'

// TODO: Actually bootstrap this?
const DEFAULT_CODE = `// Enter a prompt to get started!
`

type Upvote = {
  app_id: string
  user_id: string
  created_at: string
}

// Centered single input which takes in a prompt like "a todo list"
// On submit, generates an artifact using Claude Sonnet
export default function Artifact() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(DEFAULT_CODE)
  const user = useUser()
  const [upvotes] = useRealtime<Upvote>({
    dbPath: '/buni/db.sqlite',
    table: 'Upvotes',
  })

  // Create a map of app IDs to total upvotes
  const upvotesMap = upvotes.reduce((acc, upvote) => {
    acc[upvote.app_id] = (acc[upvote.app_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  async function generateArtifactStream() {
    setGenerating(true)

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

    // TODO: Probably some assumptions around appName are broken
    const slug = extractBlock(content, 'output_slug')
    const title = extractBlock(content, 'output_title')
    const result = extractBlock(content, 'output_code')

    await createApp({
      creator_id: user?.id ?? 'anon',
      app_name: slug,
      description: prompt,
    })

    // Write the generated code to a file
    const filename = `${slug}/app.tsx`
    await fetch('/write', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content: result,
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
    <div className="flex flex-col md:flex-row h-screen">
      <div className="h-2/3 md:w-1/2 overflow-auto md:h-screen bg-gray-100">
        <div className="h-full">
          <header className="bg-blue-500 text-white p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">
              <div className="flex items-center">
                <Split className="w-6 h-6 mr-2" />
                <span>
                  yield{' '}
                  <span className="text-xs bg-white text-blue-500 rounded-full px-1.5 py-0.5 ml-1">
                    alpha
                  </span>
                </span>
              </div>
            </h1>
            <div className="flex items-center">
              {user && (
                <>
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-8 h-8 rounded-full mr-2"
                  />
                  <div className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-sm text-blue-200">
                      @{user.username}
                    </span>
                  </div>
                </>
              )}
              <AuthButton user={user} className="bg-blue-600" />
            </div>
          </header>
          <div className="flex flex-col items-center h-full w-full">
            <div className="w-full max-w-md p-6 mt-4">
              <div className="w-full max-w-md p-6 rounded-lg shadow-md">
                <input
                  type="text"
                  onKeyDown={(e) =>
                    e.key === 'Enter' && generateArtifactStream()
                  }
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
            </div>
            <div className="w-full max-w-md p-6">
              <div className="flex flex-col gap-1 w-full max-w-md">
                <p className="text-xs text-gray-400 mt-2 text-center italic">
                  During alpha, these apps may be deleted at any time!
                </p>
                {apps
                  .sort((a, b) => {
                    const aUpvotes = upvotesMap[a.app_id] || 0
                    const bUpvotes = upvotesMap[b.app_id] || 0
                    if (aUpvotes !== bUpvotes) {
                      return bUpvotes - aUpvotes // Sort by upvotes descending
                    }
                    // If upvotes are equal, sort by date
                    return (
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                    )
                  })
                  .map((app) => (
                    <div
                      key={app.app_id}
                      className="flex items-center overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      <div
                        className="flex items-center mr-2 cursor-pointer hover:bg-gray-100 rounded p-1"
                        onClick={() => {
                          const hasUpvoted = upvotes.some(
                            (u) =>
                              u.app_id === app.app_id &&
                              u.user_id === (user?.id ?? 'anon')
                          )
                          if (hasUpvoted) {
                            unvoteApp(app.app_id, user?.id ?? 'anon')
                          } else {
                            upvoteApp(app.app_id, user?.id ?? 'anon')
                          }
                        }}
                      >
                        <Heart
                          className={`w-4 h-4 mr-1 ${
                            upvotes.some(
                              (u) =>
                                u.app_id === app.app_id &&
                                u.user_id === (user?.id ?? 'anon')
                            )
                              ? 'text-red-500'
                              : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs text-gray-400">
                          {upvotesMap[app.app_id] || 0}
                        </span>
                      </div>
                      <a
                        className="hover:underline text-sm text-gray-500 flex-grow"
                        href={`/edit/${app.app_name}/app.tsx`}
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
      </div>

      <div className="h-1/3 md:w-1/2 md:h-screen flex flex-col">
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
            flexGrow: 1,
            overflow: 'auto',
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
