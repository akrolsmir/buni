import { useState, useEffect } from 'react'

export function useRealtime<T>(props: {
  dbPath: string
  table: string
  query?: string
}): [T[], (data: T[]) => void] {
  const [data, setData] = useState<T[]>([])
  const { dbPath, table, query } = props

  // In an iframe, use ancestorOrigins to get the parent's origin
  useEffect(() => {
    const origin = window.location.host
      ? window.location.origin
      : window.location.ancestorOrigins[0]
    const host = origin.replace(/^https?:\/\//, '')
    const wsProto = origin.startsWith('https') ? 'wss' : 'ws'
    const ws = new WebSocket(`${wsProto}://${host}/realtime`)

    ws.onopen = () => {
      ws.send(JSON.stringify({ dbPath, table, query }))
    }

    ws.onmessage = (event) => {
      const wsMessage = JSON.parse(event.data)
      if (wsMessage.type === 'initial' || wsMessage.type === 'update') {
        setData(wsMessage.data)
      }
    }

    return () => ws.close()
  }, [dbPath, table, query])

  return [data, setData]
}
