import { useState, useEffect } from 'react'

export type User = {
  id: string
  name: string
  username: string
  image: string
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('/auth/session')
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user)
      })
      .catch((error) => {
        console.error('Error fetching session:', error)
      })
  }, [])

  return user
}

export function AuthButton(props: { user: User | null; callbackUrl?: string }) {
  const { user, callbackUrl } = props
  const handleAuth = () => {
    let url = user ? '/auth/signout' : '/auth/signin'
    if (callbackUrl) {
      url += `?callbackUrl=${callbackUrl}`
    } else {
      url += '?callbackUrl=' + window.location.href
    }
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
