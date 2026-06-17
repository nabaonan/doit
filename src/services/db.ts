let db: unknown = null

const TODO_KEY = "doit_todos"
const SETTINGS_KEY = "doit_settings"

function createLocalDb() {
  return {
    async execute(sql: string, params?: unknown[]) {
      if (sql.startsWith("CREATE TABLE")) return

      if (sql.startsWith("DELETE FROM todos WHERE id") || sql.startsWith("DELETE FROM todos WHERE parent_id")) {
        const items = JSON.parse(localStorage.getItem(TODO_KEY) || "[]")
        const id = params?.[0] as string
        // Delete item and its children
        const idsToDelete = new Set([id])
        const findChildren = (parentId: string) => {
          for (const item of items) {
            if (item.parent_id === parentId && !idsToDelete.has(item.id as string)) {
              idsToDelete.add(item.id as string)
              findChildren(item.id as string)
            }
          }
        }
        findChildren(id)
        const filtered = items.filter((i: Record<string, unknown>) => !idsToDelete.has(i.id as string))
        localStorage.setItem(TODO_KEY, JSON.stringify(filtered))
        return
      }

      // Generic DELETE (clear all)
      if (sql.startsWith("DELETE FROM")) {
        if (sql.includes("todos")) localStorage.removeItem(TODO_KEY)
        if (sql.includes("settings")) localStorage.removeItem(SETTINGS_KEY)
        return
      }

      if (sql.startsWith("INSERT INTO todos")) {
        const items = JSON.parse(localStorage.getItem(TODO_KEY) || "[]")
        const item: Record<string, unknown> = {}
        // Map positional params to column names based on the INSERT statement
        // INSERT INTO todos (id, content, completed, ...) VALUES ($1, $2, ...)
        const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/)
        if (colsMatch && params) {
          const cols = colsMatch[1].split(",").map((c: string) => c.trim())
          cols.forEach((col: string, i: number) => {
            item[col] = params[i]
          })
        }
        items.push(item)
        localStorage.setItem(TODO_KEY, JSON.stringify(items))
        return
      }

      if (sql.startsWith("INSERT INTO settings")) {
        const rows = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "[]")
        if (params && params.length >= 2) {
          const existing = rows.findIndex((r: { key: string }) => r.key === params[0])
          if (existing >= 0) {
            rows[existing] = { key: params[0], value: params[1] }
          } else {
            rows.push({ key: params[0], value: params[1] })
          }
        }
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(rows))
        return
      }

      if (sql.startsWith("UPDATE todos SET")) {
        const items = JSON.parse(localStorage.getItem(TODO_KEY) || "[]")
        // Extract SET clauses and WHERE id
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE\s+id\s*=\s*\$(\d+)/)
        if (setMatch && params) {
          const setClauses = setMatch[1].split(",").map((s: string) => s.trim())
          const idParamIdx = parseInt(setMatch[2]) - 1
          const id = params[idParamIdx] as string
          const item = items.find((i: Record<string, unknown>) => i.id === id)
          if (item) {
            // Column names in the SET clause are like "content = $1", "completed = $2", etc.
            // We use the params array index to determine the column
            setClauses.forEach((clause: string) => {
              const colMatch = clause.match(/^(\w+)\s*=\s*\$(\d+)/)
              if (colMatch) {
                const colName = colMatch[1]
                const paramIdx = parseInt(colMatch[2]) - 1
                item[colName] = params[paramIdx]
              }
            })
          }
        }
        localStorage.setItem(TODO_KEY, JSON.stringify(items))
        return
      }
    },
    async select<T>(sql: string): Promise<T> {
      try {
        if (sql.includes("FROM todos")) {
          const raw = localStorage.getItem(TODO_KEY)
          if (!raw) return [] as unknown as T
          const parsed = JSON.parse(raw)
          return (Array.isArray(parsed) ? parsed : []) as unknown as T
        }
        if (sql.includes("FROM settings")) {
          const raw = localStorage.getItem(SETTINGS_KEY)
          if (!raw) return [] as unknown as T
          const parsed = JSON.parse(raw)
          return (Array.isArray(parsed) ? parsed : []) as unknown as T
        }
      } catch {
        // ignore parse errors
      }
      return [] as unknown as T
    },
    async close() {
      // no-op
    },
  }
}

export async function getDb() {
  if (db) return db
  try {
    const mod = await import("@tauri-apps/plugin-sql")
    const Database = mod.default
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
  } catch {
    db = createLocalDb()
    return db
  }
}

export async function closeDb() {
  if (db) {
    try {
      await (db as { close: () => Promise<void> }).close()
    } catch {
      // ignore
    }
    db = null
  }
}
