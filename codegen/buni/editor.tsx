import React, { useState, useEffect } from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'
// Can also directly import esm.sh; make sure to exclude react
import * as DropdownMenu from 'https://esm.sh/@radix-ui/react-dropdown-menu@2.1.1?external=react,react-dom'
// Import files from codegen/* as %/*
// TODO: Consider making relative imports work with ./
import {
  backupAndSaveCode,
  clearMessages,
  initDB,
  listMessages,
  listVersions,
  loadVersion,
  writeMessage,
} from '%/buni/db'
// WARNING: this is a dynamic, un-git'd import
import FileBrowser from '%/browser/app'
import { extractBlock, modifyCode, rewriteCode } from '%/buni/codegen'
import Versions from '%/buni/versions'

const DEFAULT_CODE = `const App = () => { return <h1>Hello World</h1> }; export default App;`

export default function Editor(props: { initialCode?: string }) {
  const [code, setCode] = React.useState(props.initialCode ?? DEFAULT_CODE)
  const [transpiled, setTranspiled] = React.useState('')
  const [showFileBrowser, setShowFileBrowser] = React.useState(false)
  const [files, setFiles] = useState([])

  useEffect(() => {
    fetch('/ls')
      .then((response) => response.json())
      .then((data) => setFiles(data))
      .catch((error) => console.error('Error fetching files:', error))
  }, [])

  // Use the /transpile service to transpile this.
  // TODO: ideally, this code could directly link the transpilation code rather than doing another server<>client round trip
  React.useEffect(() => {
    // Base64 encode the code
    const encodedCode = encodeURIComponent(code)
    fetch('/transpile', {
      method: 'POST',
      body: encodedCode,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
      .then((res) => res.text())
      .then((text) => setTranspiled(text))
  }, [code])

  const [modify, setModify] = React.useState('')
  const [modifying, setModifying] = React.useState(false)
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
  async function db() {
    await initDB()
  }

  const [showCode, setShowCode] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  // TODO: Eventually stream messages from server instead of polling
  React.useEffect(() => {
    const fetchMessages = () => {
      listMessages(appName).then(setMessages)
    }
    // Fetch messages now, and then every 2 seconds
    fetchMessages()
    const intervalId = setInterval(fetchMessages, 2000)
    return () => clearInterval(intervalId)
  }, [appName])

  async function applyDiff(content: string) {
    setModifying(true)
    const diff = extractBlock(content, 'code_diff')
    const rewritten = await rewriteCode(code, diff)
    setCode(rewritten)
    await writeMessage(appName, 'austin', 'Applied code diff!')
    setModifying(false)
  }

  return (
    <div className="flex flex-row gap-2">
      <div className="w-1/2">
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
        {showCode ? (
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
            }}
          />
        ) : (
          <iframe srcDoc={transpiled} className="w-full h-screen" />
        )}
      </div>
      <div className="w-1/2 overflow-auto h-screen">
        <div className="h-full">
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
          {showFileBrowser && <FileBrowser files={files} />}
          <div className="flex mr-2 my-2">
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
          {/* Messages */}
          {messages.map((message) => (
            <div key={message.message_id} className="mb-2 p-1">
              <div className="flex items-baseline mb-1">
                <strong className="text-lg">{message.author_id}</strong>
                <span className="text-xs text-gray-400 ml-2">
                  {new Date(message.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700">
                {message.content.length > 280
                  ? `${message.content.slice(0, 280)}...`
                  : message.content}
              </p>
              {/* If message contains the string <code_diff>, then render a button to apply the diff */}
              {message.content.includes('<code_diff>') && (
                <button
                  className="px-4 py-1 bg-blue-500 text-white"
                  onClick={() => applyDiff(message.content)}
                >
                  Apply Diff
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
