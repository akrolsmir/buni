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
  const prompt = MODIFY_PROMPT.replace('{{EXISTING_CODE}}', code).replace(
    '{{USER_PROMPT}}',
    request
  )
  const body = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  }
  const response = await fetch('/anthropic', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  // Detect the response type; if json, return text; otherwise, return the whole response
  if (response.headers.get('content-type')?.startsWith('application/json')) {
    const json = await response.json()
    const text = (json.content[0] as { text: string }).text
    // If the Anthropic response was too long, instead return an error message
    if (json.stop_reason === 'max_tokens') {
      return (
        'Error: the response was too long.\n\nIt started with: ' +
        text.slice(0, 1000)
      )
    }
    return text
  } else {
    // Most often when Anthropic is overloaded
    return await response.text()
  }
}

// Extract a block of text from between <tag> and </tag>
export function extractBlock(text: string, tag: string) {
  const start = text.indexOf(`<${tag}>`) + `<${tag}>`.length
  if (start === -1) return ''
  const end = text.lastIndexOf(`</${tag}>`)
  // If no closing tag, return start til the end of text
  return end !== -1 ? text.slice(start, end) : text.slice(start)
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

// Returns the rewritten code given a diff
// TODO: Handle case if diff is already applied or not valid
export async function rewriteCode(code: string, diff: string) {
  const prompt = REWRITE_PROMPT.replace('{{ORIGINAL_CODE}}', code).replace(
    '{{CODE_DIFF}}',
    diff
  )
  const body = {
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  }
  const response = await fetch('/anthropic', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await response.json()
  const text = (json.content[0] as { text: string }).text
  return extractBlock(text, 'result')
}
