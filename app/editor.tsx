const TO_RENDER = `
function Componentz() {
  return <h1 className="text-3xl text-blue-400">Hello World</h1>
}
`
// TODO: make the above work instead so we can properly prompt Claude to generate components
// const TO_RENDER = `<h1 className="text-3xl text-blue-400">Hello World</h1>`

// Simple two pane editor for tsx, with the left pane being the output and the right pane being the code
export function Componentz() {
  const [code, setCode] = React.useState(TO_RENDER)
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
        <textarea
          className="w-full h-screen border border-gray-300 rounded-md p-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
    </div>
  )
}
