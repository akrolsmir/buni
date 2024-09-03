import Anthropic from '@anthropic-ai/sdk'
import { writeToVolume } from './volumes'

const anthropic = new Anthropic()

export async function testClaude() {
  const msg = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1000,
    temperature: 0,
    system: 'Respond only with short poems.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Why is the ocean salty?',
          },
        ],
      },
    ],
  })
  console.log(msg)
  return msg
}

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

Based on this request, generate the React component as described above. Remember to start with "export default function Component() {" and use TSX syntax with Tailwind CSS for styling.
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