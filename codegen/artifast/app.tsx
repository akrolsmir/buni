import { useEffect, useState } from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'
import { createApp, listApps } from '%/buni/db'
import { useUser, AuthButton, type User } from '%/buni/use-auth'
import { Split } from 'https://esm.sh/lucide-react'
import { extractBlock } from '%/buni/codegen'

const DEFAULT_CODE = `export default function Component() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p>Hey there! Pick a prompt, or enter your own</p>
        <p className="text-6xl">👈</p>
      </div>
    </div>
  )
}
`

const REACT_GEN_PROMPT = `
You are tasked with generating a single React component based on a user's request in <request>. Your goal is to create a functional, well-structured component that meets the user's requirements.

Follow these guidelines when creating the component:
1. Start the component with "export default function Component() {".
2. Use TypeScript (TSX) syntax; only add types where helpful.
3. Use Tailwind CSS for styling.
4. Avoid importing external libraries. If absolutely necessary, import from esm.sh eg "import confetti from 'https://esm.sh/canvas-confetti'"
5. Include appropriate props and state management if required.
6. Add comments to explain complex logic or important parts of the component.

Carefully analyze the user's request and break it down into implementable features. If the request is vague or lacks specific details, make reasonable assumptions and document them in comments within the code.

Your output should be a single, complete React component. React and library calls such as useState may be imported eg "import { useState } from 'react'" or "import React from 'react'".

IMPORTANT: Wrap your code in <result></result> tags, not backticks.

Now, here is the user's request:
<request>
{{REQUEST}}
</request>

Based on this request, generate the React component as described above. Remember to include "export default function Component() {", use TSX syntax with Tailwind CSS for styling, and wrap your code in <result></result> tags.
`

// Centered single input which takes in a prompt like "a todo list"
// On submit, generates an artifact using Claude Sonnet
export default function Artifact() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(DEFAULT_CODE)
  const [compiled, setCompiled] = useState('')
  const user = useUser()

  useEffect(() => {
    fetch('/transpile', {
      method: 'POST',
      body: generated,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
      .then((res) => res.text())
      .then((text) => setCompiled(text))
  }, [generated])

  async function generateArtifactCerebras(customPrompt?: string) {
    setGenerating(true)
    // await createApp({
    //   creator_id: user?.id ?? 'anon',
    //   app_name: appName(prompt),
    //   description: prompt,
    // })

    // Use the /cerebras API to generate the code
    const reactPrompt = REACT_GEN_PROMPT.replace(
      '{{REQUEST}}',
      customPrompt ?? prompt
    )
    const res = await fetch('/cerebras', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: reactPrompt }],
      }),
    })
    const json = await res.json()
    const content = json.choices[0].message.content
    // console.log('generated content', content)
    const code = extractBlock(content, 'result')
    setGenerated(code)

    // Write the generated code to a file
    // const filename = appName(prompt) + '/app.tsx'
    // await fetch('/write', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     filename,
    //     content: code,
    //   }),
    // })

    // window.location.href = `/edit/${filename}`
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
                  artifast{' '}
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
                    e.key === 'Enter' && generateArtifactCerebras()
                  }
                  autoFocus
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full px-4 py-2 mb-4 text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a prompt..."
                />
                <button
                  onClick={() => generateArtifactCerebras()}
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
                  Artifast regenerates these apps on the fly with Cerebras.
                </p>
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
                        className="hover:cursor-pointer hover:underline text-sm text-gray-500"
                        // href={`/edit/${app.app_name}/app.tsx`}
                        title={app.description}
                        onClick={async () => {
                          setPrompt(app.description)
                          await generateArtifactCerebras(app.description)
                        }}
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

      <div className="h-1/3 md:w-1/2 flex flex-col md:h-screen">
        <div className="h-1/2 overflow-auto">
          <CodeEditor
            value={generated}
            language="tsx"
            placeholder="Please enter TSX code."
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setGenerated(event.target.value)
            }
            padding={15}
            style={{
              backgroundColor: '#f5f5f5',
              fontFamily:
                'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
              height: '100%',
              overflow: 'auto',
            }}
          />
        </div>
        <div className="h-1/2 overflow-auto border-t border-gray-300">
          <iframe srcDoc={compiled} title="Preview" className="w-full h-full" />
        </div>
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
