import { useState, useEffect } from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'
// Can also directly import esm.sh; make sure to exclude react
// Import files from codegen/* as %/*
// TODO: Consider making relative imports work with ./
import {
  initDB,
  loadVersion,
  writeMessage,
  deleteApp,
  type Message,
  type DbUser,
  writeFile,
  backupCode,
} from '%/buni/db'
import FileBrowser from '%/browser/app'
import { extractBlock, modifyCode, rewriteCode } from '%/buni/codegen'
import Versions from '%/buni/versions'
import { useRealtime } from '%/buni/use-realtime'
import { useUser } from '%/buni/use-auth'

const DEFAULT_CODE = `const App = () => { return <h1>Hello World</h1> }; export default App;`

export default function Editor(props: { initialCode?: string }) {
  const [code, setCode] = useState(props.initialCode ?? DEFAULT_CODE)
  const [transpiled, setTranspiled] = useState('')
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [files, setFiles] = useState([])
  const user = useUser()
  const userId = user?.id ?? 'anon'
  // if ?admin is set in the URL params, then set isAdmin to true
  const isAdmin = window.location.search.includes('admin')

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

    await writeMessage(appName, userId, modify)
    const response = await modifyCode(code, modify)
    await writeMessage(appName, 'claude', response)
    setModify('')
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
  async function exportNextjs() {
    if (code.includes("from '%/buni")) {
      alert(
        "Warning: this export won't work out of the box, since it uses special code for the database or auth. " +
          'Email Austin (akrolsmir@gmail.com) if you need help with this.'
      )
    }

    const response = await fetch('/export-nextjs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        projectName: appName,
      }),
    })

    if (!response.ok) {
      alert('Failed to export project')
      return
    }

    // Create a download link for the zip file
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `${appName}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  }
  async function newVersion() {
    const filename = url.split('/edit/')[1]
    const version = await backupCode(filename, code)
    await writeMessage(appName, userId, 'Saved new version ' + version)
  }
  async function saveCode(code: string) {
    const filename = url.split('/edit/')[1]
    await writeFile(filename, code)
  }
  async function handleDelete() {
    if (window.confirm(`Are you sure you want to delete ${appName}?`)) {
      await deleteApp(appName)
      const response = await fetch(`/delete/${appName}`, { method: 'GET' })
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
    await writeMessage(appName, userId, 'Applied code diff!')
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
              onClick={async () => {
                await newVersion()
                await saveCode(code)
              }}
            >
              Save
            </button>
            {isAdmin && (
              <>
                <button
                  className="text-red-500 text-sm hover:text-red-700"
                  onClick={handleDelete}
                >
                  Delete
                </button>
                <button
                  className="text-red-500 text-sm hover:text-red-700"
                  onClick={db}
                >
                  Init DB
                </button>
              </>
            )}
            <Versions
              filename={filename}
              onSelect={async (version) => {
                const newCode = await loadVersion(filename, version)
                setCode(newCode)
                await saveCode(newCode)
                alert('Loaded version ' + version)
                // TODO: reload versions
              }}
            />
            <button
              className="text-blue-500 text-sm hover:text-blue-700"
              onClick={exportNextjs}
            >
              Export to .zip
            </button>
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
            placeholder={
              `What would you like to change` +
              (user?.id ? `, ${user.name}?` : '?')
            }
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
  const [users, setUsers] = useRealtime<DbUser>({
    dbPath: '/buni/db.sqlite',
    table: 'Users',
  })
  // Map of user_id to User
  const usersMap = new Map<string, DbUser>()
  for (const user of users) {
    usersMap.set(user.user_id, user)
  }

  const [expandedDiffs, setExpandedDiffs] = useState<{
    [key: string]: boolean
  }>({})
  const [expandedMessages, setExpandedMessages] = useState<{
    [key: string]: boolean
  }>({})

  function removeBlock(text: string, tag: string) {
    const start = text.indexOf(`<${tag}>`)
    if (start === -1) return text
    const end = text.lastIndexOf(`</${tag}>`)
    if (end !== -1) {
      return text.slice(0, start) + text.slice(end + `</${tag}>`.length)
    }
    return text.slice(0, start)
  }

  function SingleMessage(message: Message) {
    const expanded = expandedMessages[message.message_id] || false
    const diffExpanded = expandedDiffs[message.message_id] || false
    const setExpanded = (value: boolean) =>
      setExpandedMessages((prev) => ({ ...prev, [message.message_id]: value }))
    const setDiffExpanded = (value: boolean) =>
      setExpandedDiffs((prev) => ({ ...prev, [message.message_id]: value }))

    const diffless = removeBlock(message.content, 'code_diff')
    return (
      <div key={message.message_id} className="mb-2 p-1">
        <div className="flex">
          <div className="flex items-center gap-2 group mb-0.5">
            <span className="text-gray-700 font-semibold">
              {usersMap.get(message.author_id)?.username ?? 'anon'}
            </span>
            <span className="hidden group-hover:inline text-xs font-light text-gray-400 whitespace-nowrap bg-none">
              {new Date(message.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="text-gray-700 whitespace-pre-wrap ml-3">
          {diffless.length > 280 && !expanded ? (
            <>
              <p>
                {diffless.slice(0, 280)}
                <span
                  className="hover:cursor-pointer text-blue-500 hover:underline"
                  onClick={() => setExpanded(true)}
                >
                  ...more
                </span>
              </p>
            </>
          ) : (
            <p>{diffless}</p>
          )}
        </div>
        {message.content.includes('<code_diff>') && (
          <div className="flex flex-row gap-2">
            <button
              className="px-2 py-1 bg-gray-200 text-sm"
              onClick={() => setDiffExpanded(!diffExpanded)}
            >
              {diffExpanded ? 'Hide' : 'Show'} Diff
            </button>
            <button
              className="px-2 py-1 bg-blue-100 text-sm"
              onClick={() => onApplyDiff(message.content)}
            >
              Apply
            </button>
          </div>
        )}

        {diffExpanded && (
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
    )
  }

  return (
    <div className="flex flex-col-reverse h-full overflow-y-auto">
      {[...messages].reverse().map((message) => (
        <SingleMessage key={message.message_id} {...message} />
      ))}
    </div>
  )
}
