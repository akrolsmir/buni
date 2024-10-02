import React, { useState, useEffect } from 'react'

function useSession() {
  const [user, setUser] = useState(null)
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

const AuthButton = ({ user }) => {
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
  const [messages, setMessages] = useState({
    general: [],
    lounge: [],
    links: [],
  })
  const [newMessage, setNewMessage] = useState('')

  const channels = ['general', 'lounge', 'links']

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages((prev) => ({
        ...prev,
        [activeChannel]: [
          ...prev[activeChannel],
          { text: newMessage, timestamp: new Date().toLocaleTimeString() },
        ],
      }))
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
          {messages[activeChannel].map((msg, index) => (
            <div key={index} className="bg-white p-2 rounded shadow">
              <p>{msg.text}</p>
              <span className="text-xs text-gray-500">{msg.timestamp}</span>
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
