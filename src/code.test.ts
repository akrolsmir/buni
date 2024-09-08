import { expect, test, describe } from 'bun:test'
import { applyDiff } from './code'

// Test applyDiff
const diff1 = `
 import React from 'react';
 
-function MyComponent() {
+function MyComponent(props) {
   return (
     <div>
+      <p>Hi</p>
       ...
-      <h1>Hello, World!</h1>
+      <h1>Hello, {props.name}!</h1>
     </div>
   );
 }
`

const output1 = `
import React from 'react';

function MyComponent(props) {
  return (
    <div>
      <p>Hi</p>
      <h2>Untouched</h2>
      <h1>Hello, {props.name}!</h1>
    </div>
  );
}
`

const shortDiff = `
 import React from 'react';
 
-function MyComponent() {
`

const code1 = `
import React from 'react';

function MyComponent() {
  return (
    <div>
      <h2>Untouched</h2>
      <h1>Hello, World!</h1>
    </div>
  );
}
`

test('apply all diff', () => {
  const result = applyDiff(code1, diff1)
  expect(result).toBe(output1)
})

test('apply short diff', () => {
  const result = applyDiff(code1, shortDiff)
  expect(result).toBe(`
import React from 'react';

  return (
    <div>
      <h2>Untouched</h2>
      <h1>Hello, World!</h1>
    </div>
  );
}
`)
})
