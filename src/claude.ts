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
4. Avoid importing external libraries. If absolutely necessary, import from esm.sh eg "import confetti from 'https://esm.sh/canvas-confetti'"
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
  const code = (msg.content[0] as { text: string }).text

  // Save code to the file, and return the filename
  const filename = requestToFilename(request)
  await writeToVolume(filename, code)
  return filename
}

// Directly access the Anthropic API
export async function sudoAnthropic(
  body: Anthropic.Messages.MessageCreateParamsNonStreaming
) {
  return await anthropic.messages.create(body)
}

// Streaming version of generate; instead of writing to a file, stream the code
export function generateCodeStream(request: string) {
  const stream = anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    // model: 'claude-3-haiku-20240307', // Faster, but worse
    max_tokens: 4096,
    temperature: 0,
    stream: true,
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
  return stream
}

// TODO: Diffs can be buggy (eg wrong indentation); consider just having
// Claude rewrite the whole file (or GPT-4o, which is twice as fast)
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
4. Preserve the original indentation of the code within <code_diff>.
5. Do not write anything after the <code_diff>.

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
  const diff = extractBlock(text, 'code_diff')
  console.log('MODIFY CODE took', Date.now() - start, 'ms', 'text was', text)
  return await rewriteCode(code, diff)
}

// Extract a block of text from between <tag> and </tag>
function extractBlock(text: string, tag: string) {
  const start = text.indexOf(`<${tag}>`) + `<${tag}>`.length
  const end = text.indexOf(`</${tag}>`)
  return start !== -1 && end !== -1 ? text.slice(start, end) : ''
}

const REWRITE_PROMPT = `
You are tasked with applying a code diff to an original code file. Here's the original code file:

<original_code>
{{ORIGINAL_CODE}}
</original_code>

And here's the code diff to apply:

<code_diff>
{{CODE_DIFF}}
</code_diff>

Your task is to apply this diff to the original code and output the resulting file. Here's how to interpret the diff:
- Lines starting with '+' are additions
- Lines starting with '-' are deletions
- Lines starting with a space are context lines (unchanged)

To apply the diff:
1. Go through the diff line by line
2. For lines starting with '+', add them to the output
3. For lines starting with '-', remove the corresponding line from the original code
4. For lines starting with a space, keep the corresponding line from the original code unchanged

After applying all changes, output the resulting code file. Make sure to preserve the original formatting, including indentation and blank lines, except where the diff specifies changes.

Provide your output within <result> tags. The output should be the entire resulting code file after applying the diff, not just the changed lines.
`

export async function rewriteCode(code: string, diff: string) {
  const prompt = REWRITE_PROMPT.replace('{{ORIGINAL_CODE}}', code).replace(
    '{{CODE_DIFF}}',
    diff
  )
  const msg = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
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
  return extractBlock(text, 'result')
}
