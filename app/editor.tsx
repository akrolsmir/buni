import React from 'react'
import CodeEditor from '@uiw/react-textarea-code-editor'

const TO_RENDER = `
import { useState } from 'react'
export default function Componentz() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <h1 className="text-3xl text-blue-400">
        Hello World
      </h1>
      <button onClick={() => setCount(count + 1)}>
        counting {count}
      </button>
    </div>
  )
}
`

// Simple two pane editor for tsx, with the left pane being the output and the right pane being the code
export default function Editor(props: { initialCode?: string }) {
  const [code, setCode] = React.useState(props.initialCode ?? TO_RENDER)
  const [transpiled, setTranspiled] = React.useState('')

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
  const handleModify = () => {
    setModifying(true)
    fetch('/modify', {
      method: 'POST',
      body: JSON.stringify({ code, modify }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.text())
      .then((text) => setCode(text))
      .finally(() => setModifying(false))
  }
  return (
    <div className="flex flex-row gap-2">
      <div className="w-1/2">
        <iframe srcDoc={transpiled} className="w-full h-screen" />
      </div>
      <div className="w-1/2 overflow-auto h-screen">
        <div className="h-full">
          <div className="flex my-4">
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
              {modifying ? 'Modifying...' : 'Modify'}
            </button>
          </div>
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
        </div>
      </div>
    </div>
  )
}
