import { watch } from 'fs'
import { dbOnVolume, vpath } from './volumes'

export interface ClientData {
  dbPath: string
  table: string
}

// TODO: Uncomfortable that this sits in memory -- eg won't work across server restarts
const clients = new Map<WebSocket, ClientData>()
const dbWatchers = new Map<string, fs.FSWatcher>()

function setupDatabaseWatcher(dbPath: string, table: string) {
  if (!dbWatchers.has(dbPath)) {
    const watcher = watch(vpath(dbPath), () => {
      const db = dbOnVolume(dbPath)
      const rows = db.query(`SELECT * FROM ${table}`).all()

      for (const [ws, clientData] of clients.entries()) {
        if (clientData.dbPath === dbPath && clientData.table === table) {
          ws.send(JSON.stringify({ type: 'update', data: rows }))
        }
      }
    })
    dbWatchers.set(dbPath, watcher)
  }
}

function sendInitialData(ws: WebSocket, dbPath: string, table: string) {
  const db = dbOnVolume(dbPath)
  const rows = db.query(`SELECT * FROM ${table}`).all()
  ws.send(JSON.stringify({ type: 'initial', data: rows }))
}

export const websocketHandlers = {
  open(ws: WebSocket) {
    ws.send(JSON.stringify({ type: 'connected' }))
  },
  message(ws: WebSocket, message: string | Buffer) {
    const { dbPath, table } = JSON.parse(message.toString())
    clients.set(ws, { dbPath, table })
    setupDatabaseWatcher(dbPath, table)
    sendInitialData(ws, dbPath, table)
  },
  close(ws: WebSocket) {
    clients.delete(ws)
  },
}
