import { watch } from 'fs'
import { dbOnVolume, vpath } from './volumes'

export interface ClientData {
  dbPath: string
  table: string
  // For a more specific query, specify a SQL query
  query?: string
}

// TODO: Uncomfortable that this sits in memory -- eg won't work across server restarts
const clients = new Map<WebSocket, ClientData>()
const dbWatchers = new Map<string, fs.FSWatcher>()

function setupDatabaseWatcher(clientData: ClientData) {
  const { dbPath } = clientData
  if (!dbWatchers.has(dbPath)) {
    const watcher = watch(vpath(dbPath), () => {
      for (const [ws, cd] of clients.entries()) {
        // Rerun the query for each client listening to this db
        // Note that tables and queries may be different
        if (cd.dbPath === dbPath) {
          const db = dbOnVolume(dbPath)
          const rows = cd.query
            ? db.query(cd.query).all()
            : db.query(`SELECT * FROM ${cd.table}`).all()

          ws.send(JSON.stringify({ type: 'update', data: rows }))
        }
      }
    })
    dbWatchers.set(dbPath, watcher)
  }
}

function sendInitialData(ws: WebSocket, clientData: ClientData) {
  const { dbPath, table, query } = clientData
  const db = dbOnVolume(dbPath)
  const rows = query
    ? db.query(query).all()
    : db.query(`SELECT * FROM ${table}`).all()
  ws.send(JSON.stringify({ type: 'initial', data: rows }))
}

export const websocketHandlers = {
  open(ws: WebSocket) {
    ws.send(JSON.stringify({ type: 'connected' }))
  },
  message(ws: WebSocket, message: string | Buffer) {
    const clientData = JSON.parse(message.toString()) as ClientData
    clients.set(ws, clientData)
    setupDatabaseWatcher(clientData)
    sendInitialData(ws, clientData)
  },
  close(ws: WebSocket) {
    clients.delete(ws)
  },
}
