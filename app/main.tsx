// Essentially do this:
// const root = ReactDOM.createRoot(document.getElementById('root'));
// root.render(React.createElement(${rootComponent}));

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../dist/App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
