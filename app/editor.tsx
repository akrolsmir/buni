import { Editor as MonacoEditor } from '@monaco-editor/react'
import React from 'react'

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

  return (
    <div className="flex flex-row p-8">
      <div className="w-1/2">
        Output
        <iframe srcDoc={transpiled} className="w-full h-screen" />
      </div>
      <div className="w-1/2">
        Code
        {/* TODO: Fix red underlines in JSX */}
        <MonacoEditor
          height="100vh"
          defaultLanguage="typescript"
          defaultValue={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
          }}
        />
      </div>
    </div>
  )
}
