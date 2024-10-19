import Cerebras from '@cerebras/cerebras_cloud_sdk'

const client = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
})

export async function sudoCerebras(
  body: Cerebras.Chat.Completions.CompletionCreateParamsNonStreaming
) {
  return client.chat.completions.create(body)
}

async function test() {
  const response = await sudoCerebras({
    model: 'llama3.1-8b',
    messages: [{ role: 'user', content: 'Why is fast inference important?' }],
  })
  const text = response.choices[0].message.content
  console.log(text)
  console.log('usage', response.usage)
  console.log('time_info', response.time_info)
}

if (import.meta.main) {
  test()
}
