// A minimal demo of a fake Slack clone with auth, db, and realtime
import React, { useEffect, useState } from 'react'

// '%/buni/' provides some helpers for auth, querying db, and realtime
import { useUser, AuthButton } from '%/buni/use-auth'
import { query, useRealtime, run } from '%/buni/use-realtime'

// Can also import libraries from esm.sh. Here we import lucide-react for icons
import { CircleUser } from 'https://esm.sh/lucide-react'

// Set up a new database for this app
const DB_PATH = '/slacc/min.sqlite'
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS Messages (
    message_id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

type Message = {
  message_id: string
  author_id: string
  content: string
  created_at: string
}

type DbUser = {
  user_id: string
  name: string
  avatar_url: string
}

async function writeMessage(author_id: string, content: string) {
  const randomId = crypto.randomUUID()
  await query({
    filename: DB_PATH,
    query: `INSERT INTO Messages (message_id, author_id, content) VALUES ($message_id, $author_id, $content)`,
    params: { $message_id: randomId, $author_id: author_id, $content: content },
  })
}

export default function Component() {
  const user = useUser()
  const [users, setUsers] = useRealtime<DbUser>({
    // This special table contains all users
    dbPath: '/buni/db.sqlite',
    table: 'Users',
  })
  const usersMap = new Map(users.map((user) => [user.user_id, user]))

  const [newMessage, setNewMessage] = useState('')
  const [messages, setMessages] = useRealtime<Message>({
    dbPath: DB_PATH,
    table: 'Messages',
  })
  // Initialize the database
  useEffect(() => {
    // Multi-query commands need to use `run` instead of `query`
    run({ filename: DB_PATH, content: INIT_SQL })
  }, [])

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      await writeMessage(user?.id ?? 'anon', newMessage)
      setNewMessage('')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-purple-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">sl/acc</h1>
        <div className="flex items-center">
          {user && (
            <>
              <img
                src={user.image}
                alt={user.name}
                className="w-8 h-8 rounded-full mr-2"
              />
              <div className="flex flex-col">
                <span>{user.name}</span>
                <span className="text-sm text-purple-200">
                  @{user.username}
                </span>
              </div>
            </>
          )}
          <AuthButton user={user} />
        </div>
      </header>

      {/* Message area */}
      <div className="flex-grow overflow-y-auto p-4 flex flex-col-reverse bg-white">
        <div className="space-y-reverse flex flex-col-reverse">
          {messages
            ?.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )
            .map((msg) => {
              const user = usersMap.get(msg.author_id)
              return (
                <div key={msg.message_id} className="p-1 px-2">
                  <div className="flex">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-8 h-8 rounded-full mr-2"
                      />
                    ) : (
                      <CircleUser className="w-8 h-8 mr-2" />
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {user?.name ?? 'anon'}
                        </span>
                        <span className="text-xs text-gray-300">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="my-1">{msg.content}</p>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Message input */}
      <div className="flex-none p-4">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage()
              }
            }}
            className="flex-grow border rounded-l p-2"
            placeholder="Message #general"
          />
          <button
            onClick={handleSendMessage}
            className="bg-purple-600 text-white px-4 rounded-r"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
