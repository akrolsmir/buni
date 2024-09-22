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
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 2000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  }
  const msg = await fetch('/anthropic', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await msg.json()
  const text = (json.content[0] as { text: string }).text
  return text
}

// Extract a block of text from between <tag> and </tag>
function extractBlock(text: string, tag: string) {
  const start = text.indexOf(`<${tag}>`) + `<${tag}>`.length
  const end = text.indexOf(`</${tag}>`)
  return start !== -1 && end !== -1 ? text.slice(start, end) : ''
}
