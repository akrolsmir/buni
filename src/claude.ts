import Anthropic from '@anthropic-ai/sdk'
import { writeToVolume } from './volumes'
import { applyDiff } from './code'

const anthropic = new Anthropic()

const REACT_GEN_PROMPT = `
You are tasked with generating a single React component based on a user's request in <request>. Your goal is to create a functional, well-structured component that meets the user's requirements.

Follow these guidelines when creating the component:
1. Start the component with "export default function Component() {".
2. Use TypeScript (TSX) syntax.
3. Utilize Tailwind CSS for styling.
4. Ensure the component is self-contained and doesn't rely on external dependencies unless absolutely necessary.
5. Include appropriate props and state management if required.
6. Add comments to explain complex logic or important parts of the component.

Carefully analyze the user's request and break it down into implementable features. If the request is vague or lacks specific details, make reasonable assumptions and document them in comments within the code.

Your output should be a single, complete React component. React and library calls such as useState may be imported eg "import { useState } from 'react'" or "import React from 'react'". Do not include any explanation or additional text outside of the function.

Here is the user's request:
<request>
{{REQUEST}}
</request>

Based on this request, gnerate the React component as described above. Remember to start with "export default function Component() {" and use TSX syntax with Tailwind CSS for styling.
`

export function requestToFilename(request: string) {
  return (
    request
      .toLowerCase()
      .replace(/\s/g, '-')
      .replace(/[^a-z0-9-]/g, '') + '.tsx'
  )
}

// Prompt Claude to generate code for a React component, and save it to a file
export async function generateCode(request: string) {
  const msg = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 5000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: REACT_GEN_PROMPT.replace('{{REQUEST}}', request),
          },
        ],
      },
    ],
  })
  // console.log(msg)
  const code = (msg.content[0] as { text: string }).text

  // Save code to the file, and return the filename
  const filename = requestToFilename(request)
  await writeToVolume(filename, code)
  return filename
}

const MODIFY_PROMPT = `
Analyze the existing React code and user's prompt for modification. Create a code diff to implement the requested change.

<existing_code>
{{EXISTING_CODE}}
</existing_code>

<user_prompt>
{{USER_PROMPT}}
</user_prompt>

Consider which parts of the code need to be modified, added, or removed, and any potential side effects.

Provide your code diff inside <code_diff> tags using the following format:
- Lines to remove: prefixed with -
- Lines to add: prefixed with +
- Context lines: prefixed with space

Example:
<code_diff>
 import React from 'react';
 
-function MyComponent() {
+function MyComponent(props) {
   return (
     <div>
-      <h1>Hello, World!</h1>
+      <h1>Hello, {props.name}!</h1>
     </div>
   );
 }
</code_diff>

Rules:
1. Include only the necessary changes and context lines in your diff.
2. Be concise; avoid context lines where possible, truncating context in between edits with "...".
3. Do not include the line numbers to change.
4. Do not write anything after the <code_diff>.

If no changes are needed or the modification is not possible, explain why instead of providing a diff.

Consider React best practices and choose the most straightforward approach for ambiguous requests.`

export async function modifyCode(code: string, request: string) {
  const start = Date.now()
  const prompt = MODIFY_PROMPT.replace('{{EXISTING_CODE}}', code).replace(
    '{{USER_PROMPT}}',
    request
  )
  const msg = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 2000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  })
  const text = (msg.content[0] as { text: string }).text
  const diffStart = text.indexOf('<code_diff>\n') + '<code_diff>\n'.length
  const diffEnd = text.lastIndexOf('</code_diff>')
  const diff =
    diffStart !== -1 && diffEnd !== -1 ? text.slice(diffStart, diffEnd) : ''
  console.log('MODIFY CODE took', Date.now() - start, 'ms', 'text was', text)
  // console.log('diff', diff)
  return applyDiff(code, diff)
}
