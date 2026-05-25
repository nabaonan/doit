import Database from "@tauri-apps/plugin-sql"
import type { AppSettings } from "../types"

let db: Database | null = null

export async function init(): Promise<void> {
  db = await Database.load("sqlite:doit.db")
  await db.execute(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  )
}

export async function getSettings(): Promise<AppSettings> {
  if (!db) throw new Error("Database not initialized. Call init() first.")

  const rows = await db.select<Array<{ key: string; value: string }>>(
    "SELECT key, value FROM settings"
  )

  const kv: Record<string, string> = {}
  for (const row of rows) {
    kv[row.key] = row.value
  }

  return {
    completionMode: (kv["completionMode"] as "checkbox" | "longpress") || "checkbox",
    longPressDuration: kv["longPressDuration"] ? Number(kv["longPressDuration"]) : 800,
    cloudSync: kv["cloudSync"]
      ? JSON.parse(kv["cloudSync"])
      : {
          enabled: false,
          provider: "webdav",
          webdavUrl: "",
          webdavUsername: "",
          webdavPassword: "",
          localSyncPath: "",
        },
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!db) throw new Error("Database not initialized. Call init() first.")

  await db.execute("DELETE FROM settings")

  await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "completionMode",
    settings.completionMode,
  ])
  await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "longPressDuration",
    String(settings.longPressDuration),
  ])
  await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "cloudSync",
    JSON.stringify(settings.cloudSync),
  ])
}