import React, { useState, useEffect } from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'
// Can also directly import esm.sh; make sure to exclude react
// Import files from codegen/* as %/*
// TODO: Consider making relative imports work with ./
import {
  backupAndSaveCode,
  initDB,
  listMessages,
  loadVersion,
  writeMessage,
  deleteApp,
  type Message,
} from '%/buni/db'
import FileBrowser from '%/browser/app'
import { extractBlock, modifyCode, rewriteCode } from '%/buni/codegen'
import Versions from '%/buni/versions'
import { useRealtime } from '%/buni/use-realtime'

const DEFAULT_CODE = `const App = () => { return <h1>Hello World</h1> }; export default App;`

export default function Editor(props: { initialCode?: string }) {
  const [code, setCode] = useState(props.initialCode ?? DEFAULT_CODE)
  const [transpiled, setTranspiled] = useState('')
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [files, setFiles] = useState([])

  useEffect(() => {
    fetch('/ls')
      .then((response) => response.json())
      .then((data) => setFiles(data))
      .catch((error) => console.error('Error fetching files:', error))
  }, [])

  // Use the /transpile service to transpile this.
  // TODO: ideally, this code could directly link the transpilation code rather than doing another server<>client round trip
  useEffect(() => {
    fetch('/transpile', {
      method: 'POST',
      body: code,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
      .then((res) => res.text())
      .then((text) => setTranspiled(text))
  }, [code])

  const [modify, setModify] = useState('')
  const [modifying, setModifying] = useState(false)
  const handleModify = async () => {
    setModifying(true)

    await writeMessage(appName, 'austin', modify)
    const response = await modifyCode(code, modify)
    await writeMessage(appName, 'claude', response)
    setModifying(false)
  }

  const url = window.location.href as string
  // URL is like http://localhost:3000/edit/my-app-name/app.tsx
  // TODO: Robustify, also unhardcode
  const appName = url.split('/edit/')[1]?.split('/')[0] ?? 'buni'
  const filename = url.split('/edit/')[1]
  function openPreview() {
    window.open(url.replace('/edit/', '/app/'), '_blank')
  }
  function copyExport() {
    const esmURL = url.replace('/edit/', '/esm/')
    const importText = `import Component from "${esmURL}"`
    navigator.clipboard.writeText(importText)
    alert(`Copied to clipboard:\n\n${importText}`)
  }
  async function saveCode() {
    const filename = url.split('/edit/')[1]
    await backupAndSaveCode(filename, code)
    alert('Saved')
  }
  async function handleDelete() {
    if (window.confirm(`Are you sure you want to delete ${appName}?`)) {
      await deleteApp(appName)
      const response = await fetch(`/delete/${appName}`, { method: 'POST' })
      if (response.ok) {
        alert('App deleted successfully')
        window.location.href = '/' // Redirect to home page
      } else {
        alert('Failed to delete app')
      }
    }
  }
  async function db() {
    await initDB()
  }

  const [showCode, setShowCode] = useState(false)

  async function applyDiff(content: string) {
    setModifying(true)
    const diff = extractBlock(content, 'code_diff')
    const rewritten = await rewriteCode(code, diff)
    setCode(rewritten)
    await writeMessage(appName, 'austin', 'Applied code diff!')
    setModifying(false)
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="w-full md:w-1/2 flex flex-col h-full">
        <div className="flex items-center m-1 justify-end">
          <input
            type="checkbox"
            id="showCodeToggle"
            className="mr-2"
            checked={showCode}
            onChange={() => setShowCode(!showCode)}
          />
          <label htmlFor="showCodeToggle" className="text-sm">
            Show Code
          </label>
        </div>
        <div className="flex-grow relative">
          {showCode ? (
            <div className="absolute inset-0 overflow-auto">
              <CodeEditor
                value={code}
                language="js"
                placeholder="Please enter TSX code."
                onChange={(event) => setCode(event.target.value)}
                padding={15}
                style={{
                  backgroundColor: '#f5f5f5',
                  fontFamily:
                    'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                  minHeight: '100%',
                }}
              />
            </div>
          ) : (
            <iframe srcDoc={transpiled} className="w-full h-full" />
          )}
        </div>
      </div>
      <div className="w-full md:w-1/2 flex flex-col h-full p-2">
        <div className="sticky top-0 bg-white z-10">
          {/* Horizontal toolbar with links to different sections */}
          <div className="flex flex-row gap-6 m-1 mb-4">
            <button
              className="text-blue-500 text-sm hover:text-blue-700"
              onClick={() => setShowFileBrowser(!showFileBrowser)}
            >
              Files
            </button>
            <button
              className="text-blue-500 text-sm hover:text-blue-700"
              onClick={openPreview}
            >
              Preview
            </button>
            <button
              className="text-blue-500 text-sm hover:text-blue-700"
              onClick={copyExport}
            >
              Export
            </button>
            <button
              className="text-blue-500 text-sm hover:text-blue-700"
              onClick={saveCode}
            >
              Save
            </button>
            {/* <button
              className="text-red-500 text-sm hover:text-red-700"
              onClick={handleDelete}
            >
              Delete
            </button> */}
            {/* <button
              className="text-blue-500 text-sm hover:text-blue-700"
              onClick={db}
            >
              Init DB
            </button> */}
            <Versions
              filename={filename}
              onSelect={async (version) => {
                const newCode = await loadVersion(filename, version)
                setCode(newCode)
                alert('Loaded version ' + version)
                // TODO: reload versions
              }}
            />
          </div>
        </div>
        <div className="flex-grow overflow-auto">
          {showFileBrowser && <FileBrowser files={files} />}
          <Messages appName={appName} onApplyDiff={applyDiff} />
        </div>
        <div className="flex m-2">
          <input
            type="text"
            className="flex-grow px-2 py-1 border rounded-l"
            placeholder="What would you like to change?"
            value={modify}
            onChange={(e) => setModify(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleModify()
              }
            }}
          />
          <button
            className="px-4 py-1 bg-blue-500 text-white rounded-r disabled:opacity-50"
            onClick={handleModify}
            disabled={modifying}
          >
            {modifying ? 'Modifying...' : 'Modify with AI'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Messages(props: {
  appName: string
  onApplyDiff: (content: string) => void
}) {
  const { appName, onApplyDiff } = props
  const [messages, setMessages] = useRealtime<Message>({
    dbPath: '/buni/db.sqlite',
    table: 'Messages',
    query: `SELECT * FROM Messages WHERE app_id = (SELECT app_id FROM Apps WHERE app_name = '${appName}')`,
  })
  const [expandedDiffs, setExpandedDiffs] = useState<{
    [key: string]: boolean
  }>({})

  function removeBlock(text: string, tag: string) {
    const start = text.indexOf(`<${tag}>`)
    const end = text.lastIndexOf(`</${tag}>`) + `</${tag}>`.length
    if (start !== -1 && end !== -1) {
      return text.slice(0, start) + text.slice(end)
    }
    return text
  }

  return (
    <div className="flex flex-col-reverse h-full overflow-y-auto">
      {[...messages].reverse().map((message) => (
        <div key={message.message_id} className="mb-2 p-1">
          <div className="flex items-baseline mb-1">
            <strong className="text-lg">{message.author_id}</strong>
            <span className="text-xs text-gray-400 ml-2">
              {new Date(message.created_at).toLocaleString()}
            </span>
          </div>
          <div className="text-gray-700">
            <p>{removeBlock(message.content, 'code_diff')}</p>
          </div>
          {message.content.includes('<code_diff>') && (
            <div className="flex flex-row gap-2">
              <button
                className="px-2 py-1 bg-gray-200 text-sm"
                onClick={() =>
                  setExpandedDiffs((prev) => ({
                    ...prev,
                    [message.message_id]: !prev[message.message_id],
                  }))
                }
              >
                {expandedDiffs[message.message_id] ? 'Hide' : 'Show'} Diff
              </button>
              <button
                className="px-2 py-1 bg-blue-100 text-sm"
                onClick={() => onApplyDiff(message.content)}
              >
                Apply
              </button>
            </div>
          )}

          {expandedDiffs[message.message_id] && (
            <CodeEditor
              value={extractBlock(message.content, 'code_diff')}
              language="diff"
              readOnly
              padding={10}
              style={{
                backgroundColor: '#f5f5f5',
                fontFamily:
                  'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
