import React, { useState, useEffect } from 'react'
import { writeMessage } from '%/slacc/db'
import { listUsers } from '%/buni/db'
import { useRealtime } from '%/buni/use-realtime'

type User = {
  id: string
  name: string
  username: string
  image: string
}

type Message = {
  message_id: string
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
  const [messages, setMessages] = useRealtime<Message>({
    dbPath: '/slacc/db.sqlite',
    table: 'Messages',
  })
  // Map of user_id to User
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map())

  useEffect(() => {
    listUsers().then((users) => {
      const usersMap = new Map<string, User>()
      for (const user of users) {
        usersMap.set(user.user_id, {
          id: user.user_id,
          name: user.name,
          username: user.username,
          image: user.avatar_url,
        })
      }
      setUsersMap(usersMap)
    })
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
      <div className="flex-grow overflow-y-auto p-4 flex flex-col-reverse bg-white ">
        <div className="space-y-reverse flex flex-col-reverse ">
          {messages
            ?.filter((msg) => msg.channel === activeChannel)
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )
            .map((msg, index) => (
              <div key={msg.message_id} className="p-1 px-2">
                <div className="flex">
                  <img
                    src={usersMap.get(msg.author_id)?.image}
                    alt={usersMap.get(msg.author_id)?.name}
                    className="w-8 h-8 rounded-full mr-2"
                  />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {usersMap.get(msg.author_id)?.name ?? 'anon'}
                      </span>
                      <span className="text-xs text-gray-300">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="my-1">{msg.content}</p>
                  </div>
                </div>
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
