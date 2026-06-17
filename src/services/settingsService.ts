import type { AppSettings } from "../types"
import { getDb } from "./db"

const defaultSettings: AppSettings = {
  completionMode: "checkbox",
  longPressDuration: 3,
  theme: "system",
  happyMode: false,
  fontFamily: "default",
  addTodoShortcut: {
    key: "Enter",
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  },
  tags: [],
  categories: [],
  cloudSync: {
    enabled: false,
    provider: "webdav",
    webdavUrl: "",
    webdavUsername: "",
    webdavPassword: "",
    localSyncPath: "",
  },
}

export async function init(): Promise<void> {
  await getDb()
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb()
  if (!db) return { ...defaultSettings }

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
    happyMode: kv["happyMode"] === "true",
    fontFamily: (kv["fontFamily"] as "default" | "cartoon") || "default",
    addTodoShortcut: kv["addTodoShortcut"]
      ? JSON.parse(kv["addTodoShortcut"])
      : { ...defaultSettings.addTodoShortcut },
    tags: kv["tags"]
      ? JSON.parse(kv["tags"])
      : [...defaultSettings.tags],
    categories: kv["categories"]
      ? JSON.parse(kv["categories"])
      : [...defaultSettings.categories],
    cloudSync: kv["cloudSync"]
      ? JSON.parse(kv["cloudSync"])
      : { ...defaultSettings.cloudSync },
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb()
  if (!db) return
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
    "happyMode",
    String(settings.happyMode),
  ])
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "fontFamily",
    settings.fontFamily,
  ])
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "addTodoShortcut",
    JSON.stringify(settings.addTodoShortcut),
  ])
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "tags",
    JSON.stringify(settings.tags),
  ])
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "categories",
    JSON.stringify(settings.categories),
  ])
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [
    "cloudSync",
    JSON.stringify(settings.cloudSync),
  ])
}
