import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const REACT_GEN_PROMPT = `
You are tasked with generating a single React component based on a user's request in <request>. Your goal is to create a functional, well-structured component that meets the user's requirements.

Follow these guidelines when creating the component:
1. Start the component with "export default function Component() {".
2. Use TypeScript (TSX) syntax.
3. Utilize Tailwind CSS for styling.
4. React and library calls such as useState may be imported eg \`import { useState } from 'react'\` or \`import React from 'react'\`
5. Avoid importing external libraries. If absolutely necessary, import them from esm.sh eg \`import confetti from 'https://esm.sh/canvas-confetti'\`
6. Add comments to explain complex logic or important parts of the component.

Carefully analyze the user's request and break it down into implementable features. If the request is vague or lacks specific details, make reasonable assumptions and document them in comments within the code.

Your output should include:
- A single, complete React component in <result> tags
- A simple, memorable slug for the app (lowercase letters & dashes only) in <slug> tags
- A suggested title for the app in <title> tags

Here is an advanced example, including auth, db, and realtime helpers you can use from '%/buni/':
<example>
  <example_request>A mobile clone of Slack </example_request>
  <assistant_response>
  Here's a simple mobile Slack clone with auth, db, and realtime.
  <slug>mobile-slack</slug>
  <title>Mobile Slack Clone</title>
  <result>
  {{EXAMPLE_COMPONENT}}
  </result>
  </assistant_response>
</example>

Now, here is the user's request:
<request>
{{REQUEST}}
</request>

Based on this request, generate the React component as described above. Remember to include "export default function Component() {" and use TSX syntax with Tailwind CSS for styling.
`

// Directly access the Anthropic API
export async function sudoAnthropic(
  body: Anthropic.Messages.MessageCreateParamsNonStreaming
) {
  return await anthropic.messages.create(body)
}

// Streaming version of generate; instead of writing to a file, stream the code
export async function generateCodeStream(request: string) {
  const example = await Bun.file('codegen/slacc/min-slacc.tsx').text()
  const stream = anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
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
            text: REACT_GEN_PROMPT.replace('{{REQUEST}}', request).replace(
              '{{EXAMPLE_COMPONENT}}',
              example
            ),
          },
        ],
      },
    ],
  })
  return stream
}
