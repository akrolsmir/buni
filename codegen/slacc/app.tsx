import React, { useState, useEffect } from 'react'
import { writeMessage } from '%/slacc/db'

type User = {
  id: string
  name: string
  username: string
  image: string
}

type Message = {
  id: string
  channel: string
  author_id: string
  content: string
  created_at: string
}

function useSession() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/auth/session')
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching session:', error)
        setLoading(false)
      })
  }, [])

  return { user, loading }
}

const AuthButton = ({ user }: { user: User }) => {
  const handleAuth = () => {
    const url = user ? '/auth/signout' : '/auth/signin'
    window.open(url, '_blank', 'width=500,height=600')
  }

  return (
    <button
      onClick={handleAuth}
      className="bg-purple-700 text-white px-4 py-2 rounded ml-4"
    >
      {user ? 'Sign out' : 'Sign in'}
    </button>
  )
}

export default function Component() {
  const { user, loading } = useSession()
  const [activeChannel, setActiveChannel] = useState('general')
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    // const wsUrl = `ws://${window.location.host}/realtime` <= doesn't work in an iframe
    // TODO: Replace with current URL.
    const ws = new WebSocket(`ws://localhost:3000/realtime`)
    // TODO: Could clean up the client interface somewhat. Ideally:
    // const [messages, setMessages] = useRealtime('/slacc/db.sqlite', 'Messages')
    ws.onopen = () => {
      ws.send(JSON.stringify({ dbPath: '/slacc/db.sqlite', table: 'Messages' }))
    }
    ws.onmessage = (event) => {
      const wsMessage = JSON.parse(event.data)
      if (wsMessage.type === 'initial' || wsMessage.type === 'update') {
        setMessages(wsMessage.data)
      }
    }
    return () => ws.close()
  }, [])

  const [newMessage, setNewMessage] = useState('')

  const channels = ['general', 'lounge', 'links']

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      writeMessage(activeChannel, user?.id ?? 'anon', newMessage)
      setNewMessage('')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-purple-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">sl/acc</h1>
        {!loading && (
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
        )}
      </header>

      {/* Channel list */}
      <div className="flex-none bg-purple-800 text-purple-100 p-4">
        <h2 className="text-lg font-semibold mb-2">Channels</h2>
        <ul>
          {channels.map((channel) => (
            <li
              key={channel}
              className={`cursor-pointer p-2 rounded ${
                activeChannel === channel
                  ? 'bg-purple-700'
                  : 'hover:bg-purple-700'
              }`}
              onClick={() => setActiveChannel(channel)}
            >
              # {channel}
            </li>
          ))}
        </ul>
      </div>

      {/* Message area */}
      <div className="flex-grow overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-2">#{activeChannel}</h2>
        <div className="space-y-2">
          {messages
            ?.filter((msg) => msg.channel === activeChannel)
            .map((msg, index) => (
              <div key={msg.message_id} className="bg-white p-2 rounded shadow">
                <p>{msg.content}</p>
                <span className="text-xs text-gray-500">{msg.created_at}</span>
              </div>
            ))}
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
            placeholder={`Message #${activeChannel}`}
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
