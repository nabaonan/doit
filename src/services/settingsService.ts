import type { AppSettings } from "../types"
import { isTauri } from "./tauriEnv"

let db: unknown = null

const STORAGE_KEY = "doit_settings"

const defaultSettings: AppSettings = {
  completionMode: "checkbox",
  longPressDuration: 3,
  theme: "system",
  addTodoShortcut: {
    key: "Enter",
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  },
  cloudSync: {
    enabled: false,
    provider: "webdav",
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    localSyncPath: "",
  },
}

async function loadDB() {
  const Database = (await import("@tauri-apps/plugin-sql")).default
  db = await Database.load("sqlite:doit.db")
  await (db as { execute: (sql: string) => Promise<void> }).execute(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  )
}

function getLocalSettings(): AppSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : { ...defaultSettings }
  } catch {
    return { ...defaultSettings }
  }
}

function saveLocalSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

let initialized = false

export async function init(): Promise<void> {
  if (initialized) return
  initialized = true
  if (isTauri) {
    await loadDB()
  }
}

export async function getSettings(): Promise<AppSettings> {
  if (isTauri) {
    if (!db) await loadDB()

    const rows = await (db as { select: <T>(sql: string) => Promise<T> }).select<Array<{ key: string; value: string }>>(
      "SELECT key, value FROM settings"
    )

    const kv: Record<string, string> = {}
    for (const row of rows) {
      kv[row.key] = row.value
    }

    return {
      completionMode: (kv["completionMode"] as "checkbox" | "longpress") || "checkbox",
      longPressDuration: kv["longPressDuration"] ? Number(kv["longPressDuration"]) : 3,
      theme: (kv["theme"] as "system" | "light" | "dark") || "system",
      addTodoShortcut: kv["addTodoShortcut"]
        ? JSON.parse(kv["addTodoShortcut"])
        : { ...defaultSettings.addTodoShortcut },
      cloudSync: kv["cloudSync"]
        ? JSON.parse(kv["cloudSync"])
        : { ...defaultSettings.cloudSync },
    }
  }

  return getLocalSettings()
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (isTauri) {
    if (!db) await loadDB()

    await (db as { execute: (sql: string) => Promise<void> }).execute("DELETE FROM settings")

    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
      "completionMode",
      settings.completionMode,
    ])
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
      "longPressDuration",
      String(settings.longPressDuration),
    ])
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
      "theme",
      settings.theme,
    ])
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
      "addTodoShortcut",
      JSON.stringify(settings.addTodoShortcut),
    ])
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
      "cloudSync",
      JSON.stringify(settings.cloudSync),
    ])
    return
  }

  saveLocalSettings(settings)
}