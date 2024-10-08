import { useState, useEffect } from 'react'
import { useRealtime } from './use-realtime'
import type { DbUser } from './db'

// TODO: merge with DbUser type?
// Rename user_id to id, to avatar_url; add created_at
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

export function AuthButton(props: {
  user: User | null
  callbackUrl?: string
  className?: string
}) {
  const { user, callbackUrl, className } = props
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
      className={`px-4 py-2 rounded ml-4 ${
        className ? className : 'bg-gray-700 text-white'
      }`}
    >
      {user ? 'Sign out' : 'Sign in'}
    </button>
  )
}

export function useAllUsers() {
  const [users, setUsers] = useRealtime<DbUser>({
    // This special table contains all users
    dbPath: '/buni/db.sqlite',
    table: 'Users',
  })
  return users
}
