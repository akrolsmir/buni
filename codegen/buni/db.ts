import { customAlphabet } from 'https://esm.sh/nanoid@5.0.7'
const randomId = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  8
)

// TODO: Clean up by replacing eg "app_id" with "id"
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS Apps (
    app_id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Messages (
    message_id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES Apps(app_id)
);

CREATE TABLE IF NOT EXISTS Users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed users
-- INSERT OR IGNORE INTO Users (user_id, username) VALUES ('claude', 'Claude');
-- INSERT OR IGNORE INTO Users (user_id, username) VALUES ('austin', 'Austin');


CREATE TABLE IF NOT EXISTS Versions (
    filename TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (filename, version)
);
CREATE TABLE IF NOT EXISTS Upvotes (
    app_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (app_id, user_id)
);

`

export async function initDB() {
  await fetch('/db/run', {
    method: 'POST',
    body: JSON.stringify({
      filename: '/buni/db.sqlite',
      content: INIT_SQL,
    }),
  })
}

export async function query(query: string, params?: Record<string, any>) {
  const res = await fetch('/db/query', {
    method: 'POST',
    body: JSON.stringify({
      filename: '/buni/db.sqlite',
      query,
      params,
    }),
  })
  return await res.json()
}

export async function createApp(app: {
  creator_id: string
  app_name: string
  description: string
}) {
  const app_id = randomId()
  await query(
    `INSERT INTO Apps (app_id, creator_id, app_name, description) VALUES ($app_id, $creator_id, $app_name, $description)`,
    {
      $app_id: app_id,
      $creator_id: app.creator_id,
      $app_name: app.app_name,
      $description: app.description,
    }
  )
  // Also add an initial message to the chat
  await writeMessage(app.app_name, app.creator_id, app.description)
  return app_id
}

type App = {
  app_id: string
  creator_id: string
  app_name: string
  description: string
  created_at: string
}

export async function listApps() {
  const res = await query('SELECT * FROM Apps ORDER BY created_at DESC')
  return res as App[]
}

export async function writeMessage(
  app_name: string,
  author_id: string,
  content: string
) {
  const message_id = randomId()
  // Look up app_id from app_name, then insert into Messages, in a single SQL query
  const res = await query(
    `INSERT INTO Messages (message_id, app_id, author_id, content) 
    VALUES ('${message_id}', 
    (SELECT app_id FROM Apps WHERE app_name = $app_name), 
    $author_id, 
    $content)`,
    { $app_name: app_name, $author_id: author_id, $content: content }
  )
  return message_id
}

export type Message = {
  message_id: string
  app_id: string
  author_id: string
  content: string
  created_at: string
}

export async function listMessages(app_name: string) {
  const res = await query(
    `SELECT * FROM Messages WHERE app_id = (SELECT app_id FROM Apps WHERE app_name = $app_name)`,
    { $app_name: app_name }
  )
  return res as Message[]
}

export async function clearMessages(app_name: string) {
  await query(
    `DELETE FROM Messages WHERE app_id = (SELECT app_id FROM Apps WHERE app_name = $app_name)`,
    { $app_name: app_name }
  )
}

export async function writeFile(filename: string, content: string) {
  console.log('writing file', filename, content.slice(0, 100))
  await fetch('/write', {
    method: 'POST',
    body: JSON.stringify({
      filename,
      content,
    }),
  })
}

// Could also consider saving file versions in DB instead of straight on disk
export async function backupCode(filename: string, code: string) {
  // In a single SQL query, find the current version of the file in Versions, increment it, and save the new version
  const result = await query(
    `INSERT INTO Versions (filename, version, content) 
    VALUES ($filename, 
      (SELECT COALESCE(MAX(version), 0) + 1 FROM Versions WHERE filename = $filename), 
      $code)
    RETURNING version`,
    { $filename: filename, $code: code }
  )
  return result[0].version
}

// Return a list of integers, representing the version numbers
export async function listVersions(filename: string) {
  const res = await query(
    `SELECT version FROM Versions WHERE filename = $filename`,
    { $filename: filename }
  )
  return (res as { version: number }[]).map((v) => v.version)
}

export async function loadVersion(filename: string, version: number) {
  const res = await query(
    `SELECT content FROM Versions WHERE filename = $filename AND version = $version`,
    { $filename: filename, $version: version }
  )
  return res[0].content
}
export async function deleteApp(app_name: string) {
  await query(
    `DELETE FROM Messages WHERE app_id = (SELECT app_id FROM Apps WHERE app_name = $app_name)`,
    { $app_name: app_name }
  )
  await query(`DELETE FROM Apps WHERE app_name = $app_name`, {
    $app_name: app_name,
  })
}
export async function upvoteApp(app_id: string, user_id: string) {
  await query(
    `INSERT INTO Upvotes (app_id, user_id) VALUES ($app_id, $user_id)`,
    {
      $app_id: app_id,
      $user_id: user_id,
    }
  )
}

export async function unvoteApp(app_id: string, user_id: string) {
  await query(
    `DELETE FROM Upvotes WHERE app_id = $app_id AND user_id = $user_id`,
    {
      $app_id: app_id,
      $user_id: user_id,
    }
  )
}

export type DbUser = {
  user_id: string
  username: string
  email: string
  name: string
  avatar_url: string
  created_at: string
}

export async function listUsers() {
  const res = await query('SELECT * FROM Users ORDER BY created_at DESC')
  return res as DbUser[]
}
