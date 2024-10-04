# API Documentation

This document outlines the various API endpoints available in the application.

## Authentication

### `/auth/*`

Handles authentication routes using AuthJS.

- **Supported routes**:
  - `/auth/signin`
  - `/auth/signout`
  - `/auth/session`

## Code Operations

### `/transpile`

Transpiles (builds) the provided React code.

- **Method**: POST or GET
- **Parameters**:
  - `code` (string): React code to be transpiled
- **Response**: Transpiled React code

**Example**:

```javascript
const code = `
function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicks: {count}
    </button>
  );
}
`

fetch('/transpile', {
  method: 'POST',
  body: code,
})
  .then((response) => response.text())
  .then((transpiledCode) => console.log(transpiledCode))
  .catch((error) => console.error('Error:', error))
```

### `/generate-stream`

Generates code using Claude AI in a streaming fashion.

- **Method**: POST
- **Parameters**:
  - `prompt` (string): Prompt for code generation
- **Response**: Stream of generated code

**Example**:

```javascript
const prompt = 'Create a React component for a todo list'

fetch('/generate-stream', {
  method: 'POST',
  body: prompt,
})
  .then((response) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    function readStream() {
      return reader.read().then(({ done, value }) => {
        if (done) return
        console.log(decoder.decode(value))
        return readStream()
      })
    }

    return readStream()
  })
  .catch((error) => console.error('Error:', error))
```

### `/write`

Writes content to a file in the volume.

- **Method**: POST
- **Parameters**:
  - `filename` (string): Name of the file to write
  - `content` (string): Content to write to the file
- **Response**: 200 OK if successful

**Example**:

```javascript
const fileData = {
  filename: 'HelloWorld.tsx',
  content: `
    export default function HelloWorld() {
      return <h1>Hello, World!</h1>;
    }
  `,
}

fetch('/write', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(fileData),
})
  .then((response) => {
    if (response.ok) console.log('File written successfully')
    else console.error('Failed to write file')
  })
  .catch((error) => console.error('Error:', error))
```

### `/app/*`

Serves and compiles React components from the /app directory.

- **Method**: GET
- **Parameters**:
  - `*` (string): Path to the file in the /app directory
- **Response**: Compiled React component

**Example**:

```javascript
fetch('/app/Counter.tsx')
  .then((response) => response.text())
  .then((compiledComponent) => {
    // Use the compiled component
    console.log(compiledComponent)
  })
  .catch((error) => console.error('Error:', error))
```

### `/edit/*`

Provides an editor interface for editing files.

- **Method**: GET
- **Parameters**:
  - `*` (string): Path to the file to edit
- **Response**: Editor interface with the file content

**Example**:

```javascript
fetch('/edit/UserProfile.tsx')
  .then((response) => response.text())
  .then((editorInterface) => {
    // Render the editor interface
    document.getElementById('editor').innerHTML = editorInterface
  })
  .catch((error) => console.error('Error:', error))
```

### `/esm/*`

Serves files as ES modules.

- **Method**: GET
- **Parameters**:
  - `*` (string): Path to the file
- **Response**: File contents as an ES module

**Example**:

```javascript
import UserProfile from '/esm/UserProfile.tsx'

// Use the imported component
ReactDOM.render(<UserProfile />, document.getElementById('root'))
```

## Database Operations

### `/db/run`

Executes a SQL command on the specified database.

- **Method**: POST
- **Parameters**:
  - `filename` (string): Name of the database file
  - `content` (string): SQL command to execute
- **Response**: 200 OK if successful

**Example**:

```javascript
const dbOperation = {
  filename: 'users.sqlite',
  content: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    )
  `,
}

fetch('/db/run', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(dbOperation),
})
  .then((response) => {
    if (response.ok) console.log('Table created successfully')
    else console.error('Failed to create table')
  })
  .catch((error) => console.error('Error:', error))
```

### `/db/query`

Executes a SQL query on the specified database.

- **Method**: POST
- **Parameters**:
  - `filename` (string): Name of the database file
  - `query` (string): SQL query to execute
  - `params` (object): Query parameters
- **Response**: Query results as JSON

**Example**:

```javascript
const queryData = {
  filename: 'users.sqlite',
  query: 'SELECT * FROM users WHERE id = :id',
  params: { id: 1 },
}

fetch('/db/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(queryData),
})
  .then((response) => response.json())
  .then((data) => console.log('User data:', data))
  .catch((error) => console.error('Error:', error))
```

## Miscellaneous

### `/anthropic`

Sends a request to the Anthropic API.

- **Method**: POST
- **Parameters**: Anthropic API request body
- **Response**: Anthropic API response

**Example**:

```javascript
const anthropicRequest = {
  prompt: 'Explain the concept of recursion in programming.',
  max_tokens_to_sample: 300,
}

fetch('/anthropic', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(anthropicRequest),
})
  .then((response) => response.json())
  .then((data) => console.log('Anthropic response:', data))
  .catch((error) => console.error('Error:', error))
```

### `/ls`

Lists files in the volume.

- **Method**: GET
- **Response**: JSON array of file names

**Example**:

```javascript
fetch('/ls')
  .then((response) => response.json())
  .then((files) => console.log('Files in volume:', files))
  .catch((error) => console.error('Error:', error))
```

### `/delete/*`

Deletes a file or folder from the volume.

- **Method**: GET
- **Parameters**:
  - `*` (string): Path to the file or folder to delete
- **Response**: JSON object with `success` boolean

**Example**:

```javascript
fetch('/delete/old-project')
  .then((response) => response.json())
  .then((result) => {
    if (result.success) console.log('Successfully deleted old-project')
    else console.error('Failed to delete old-project')
  })
  .catch((error) => console.error('Error:', error))
```

### `/realtime`

Establishes a WebSocket connection for real-time communication.

- **Method**: WebSocket
- **Response**: WebSocket connection

**Example**:

```javascript
const socket = new WebSocket('ws://localhost:3000/realtime')

socket.onopen = () => {
  console.log('WebSocket connection established')
  socket.send(JSON.stringify({ type: 'hello', message: 'Connected to client' }))
}

socket.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Received message:', data)
}

socket.onclose = () => {
  console.log('WebSocket connection closed')
}
```

### `/screenshot`

Generates a screenshot of a specified URL.

- **Method**: GET
- **Parameters**:
  - `url` (string): URL to screenshot
- **Response**: PNG image of the screenshot

**Example**:

```javascript
const url = 'https://example.com'
fetch(`/screenshot?url=${encodeURIComponent(url)}`)
  .then((response) => response.blob())
  .then((blob) => {
    const img = document.createElement('img')
    img.src = URL.createObjectURL(blob)
    document.body.appendChild(img)
  })
  .catch((error) => console.error('Error:', error))
```
