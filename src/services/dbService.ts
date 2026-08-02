import { getDb, closeDb } from "./db"
import dayjs from "dayjs"

const TODO_KEY = "doit_todos"
const SETTINGS_KEY = "doit_settings"

let _SQL: Promise<any> | null = null

async function getSQL(): Promise<any> {
  if (_SQL) return _SQL
  _SQL = (async () => {
    const mod = await import("sql.js/dist/sql-wasm-browser.js")
    const initFn = (mod as any).default || mod
    const SQL = await initFn({
      locateFile: (file: string) => {
        if (file.endsWith(".wasm")) {
          return "/sql-wasm.wasm"
        }
        return file
      },
    })
    return SQL
  })()
  return _SQL
}

function readLocalTodos(): any[] {
  try {
    const raw = localStorage.getItem(TODO_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readLocalSettings(): { key: string; value: string }[] {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function buildSqliteBuffer(): Promise<Uint8Array> {
  const SQL = await getSQL()
  const db = new SQL.Database()

  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    tag_id TEXT,
    cat_id TEXT,
    parent_id TEXT
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`)

  const todos = readLocalTodos()
  const stmt = db.prepare(`INSERT OR IGNORE INTO todos (id, content, completed, created_at, completed_at, sort_order, tag_id, cat_id, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const todo of todos) {
    stmt.run([
      todo.id ?? crypto.randomUUID(),
      todo.content ?? "",
      typeof todo.completed === "number" ? todo.completed : 0,
      todo.created_at ?? dayjs().format("YYYY-MM-DD HH:mm:ss"),
      todo.completed_at ?? null,
      typeof todo.sort_order === "number" ? todo.sort_order : 0,
      todo.tag_id ?? null,
      todo.cat_id ?? null,
      todo.parent_id ?? null,
    ])
  }
  stmt.free()

  const settings = readLocalSettings()
  const sStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
  for (const s of settings) {
    sStmt.run([s.key, s.value])
  }
  sStmt.free()

  const data = db.export()
  db.close()
  return data
}

export async function exportDatabase(): Promise<void> {
  const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
  if (isTauri) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { invoke } = await import("@tauri-apps/api/core")

      const filePath = await save({
        defaultPath: `doit-backup-${dayjs().format("YYYY-MM-DD")}.db`,
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      })

      if (!filePath) return

      const result = await invoke<string>("clean_export_db", { targetPath: filePath })
      console.log("[doit] 导出结果:", result)
      return
    } catch (e) {
      console.error("Tauri 导出失败", e)
      throw e
    }
  }

  // 浏览器模式：使用 sql.js 构建真正的 SQLite 数据库文件
  const buffer = await buildSqliteBuffer()
  const blob = new Blob([buffer.buffer as ArrayBuffer], { type: "application/x-sqlite3" })
  const fileName = `doit-backup-${dayjs().format("YYYY-MM-DD")}.db`

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "SQLite Database",
          accept: { "application/x-sqlite3": [".db"] },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  } catch (e) {
    if ((e as DOMException).name === "AbortError") {
      return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export async function importDatabase(): Promise<{ todos: Record<string, unknown>[]; settings: Record<string, unknown>[] } | { summary: string; settingsFromSource?: Record<string, unknown>[] }> {
  const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
  if (isTauri) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const { invoke } = await import("@tauri-apps/api/core")

      const filePath = await open({
        multiple: false,
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      })

      if (!filePath) {
        return { summary: "" }
      }

      const pathStr = typeof filePath === "string" ? filePath : (filePath as { path?: string }).path ?? ""
      if (!pathStr.toLowerCase().endsWith(".db")) {
        throw new Error("只能选择 .db 后缀的 SQLite 数据库文件")
      }

      // 与下载恢复 BackupDialog.handleDownload 完全一致的步骤：
      // 1. 关闭 db 连接（让 tauri-plugin-sql 释放文件锁，Windows 必须）
      await closeDb()
      // 2. 等待 300ms 让 Windows 释放文件句柄
      await new Promise((r) => setTimeout(r, 300))
      // 3. 调用 Rust 端用 temp + rename 原子替换 db
      const resultJson = await invoke<string>("clean_import_db", { sourcePath: pathStr })
      // 4. 重新初始化数据库
      await getDb()
      // 5. 解析返回的 JSON，包含 summary 和 source db 的 settings KV 数据
      const parsed = JSON.parse(resultJson) as { summary: string; settings: Array<{ key: string; value: string }> }
      return { summary: parsed.summary, settingsFromSource: parsed.settings }
    } catch (e) {
      console.error("Tauri 导入失败", e)
      throw e
    }
  }

  // 浏览器模式：使用 sql.js 读取真正的 SQLite 数据库文件
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".db"

  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })

  if (!file) {
    return { todos: [], settings: [] }
  }

  if (!file.name.toLowerCase().endsWith(".db")) {
    throw new Error("只能选择 .db 后缀的 SQLite 数据库文件")
  }

  const fileBuffer = await file.arrayBuffer()
  const SQL = await getSQL()
  const db = new SQL.Database(new Uint8Array(fileBuffer))

  // 读取 todos
  const todos: Record<string, unknown>[] = []
  try {
    const stmt = db.prepare("SELECT * FROM todos")
    while (stmt.step()) {
      const row = stmt.getAsObject()
      todos.push(row)
    }
    stmt.free()
  } catch {
    // todos 表可能不存在
  }

  // 读取 settings
  const settings: Record<string, unknown>[] = []
  try {
    const stmt = db.prepare("SELECT key, value FROM settings")
    while (stmt.step()) {
      const row = stmt.getAsObject()
      settings.push(row)
    }
    stmt.free()
  } catch {
    // settings 表可能不存在
  }

  db.close()

  if (todos.length > 0) {
    localStorage.setItem(TODO_KEY, JSON.stringify(todos))
  }
  if (settings.length > 0) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }

  return { todos, settings }
}
