// Essentially do this:
// const root = ReactDOM.createRoot(document.getElementById('root'));
// root.render(React.createElement(${rootComponent}));

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../dist/App'

// Try importing props as a named export from App; if not found, pass in an empty object
const props = (await import('../dist/App')).props ?? {}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App {...props} />
  </React.StrictMode>
)
