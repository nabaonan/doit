import { isTauri } from "./tauriEnv"

let db: unknown = null

export async function getDb() {
  if (!isTauri) return null
  if (db) return db
  const Database = (await import("@tauri-apps/plugin-sql")).default
  db = await Database.load("sqlite:doit.db")
  await (db as { execute: (sql: string) => Promise<void> }).execute(
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      tag_id TEXT,
      cat_id TEXT,
      parent_id TEXT
    )`
  )
  await (db as { execute: (sql: string) => Promise<void> }).execute(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  )
  return db
}

export async function closeDb() {
  if (db) {
    await (db as { close: () => Promise<void> }).close()
    db = null
  }
}
