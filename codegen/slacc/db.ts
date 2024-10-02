import { customAlphabet } from 'https://esm.sh/nanoid@5.0.7'
const randomId = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  8
)

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS Messages (
    message_id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

export async function initDB() {
  await fetch('/db/run', {
    method: 'POST',
    body: JSON.stringify({
      filename: '/slacc/db.sqlite',
      content: INIT_SQL,
    }),
  })
}

export async function query(query: string, params?: Record<string, any>) {
  const res = await fetch('/db/query', {
    method: 'POST',
    body: JSON.stringify({
      filename: '/slacc/db.sqlite',
      query,
      params,
    }),
  })
  return await res.json()
}

export async function writeMessage(
  channel: string,
  author_id: string,
  content: string
) {
  const message_id = randomId()
  await query(
    `INSERT INTO Messages (message_id, channel, author_id, content) 
    VALUES ($message_id, $channel, $author_id, $content)`,
    {
      $message_id: message_id,
      $channel: channel,
      $author_id: author_id,
      $content: content,
    }
  )
  return message_id
}

export type Message = {
  message_id: string
  channel: string
  author_id: string
  content: string
  created_at: string
}

export async function listMessages(channel: string) {
  const res = await query(
    `SELECT * FROM Messages WHERE channel = $channel ORDER BY created_at ASC`,
    { $channel: channel }
  )
  return res as Message[]
}

export async function clearMessages(channel: string) {
  await query(`DELETE FROM Messages WHERE channel = $channel`, {
    $channel: channel,
  })
}
