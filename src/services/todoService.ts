import Database from "@tauri-apps/plugin-sql"
import type { TodoItem } from "../types"

let db: Database | null = null

export async function init(): Promise<void> {
  db = await Database.load("sqlite:doit.db")
  await db.execute(
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`
  )
}

export async function getAllTodos(): Promise<TodoItem[]> {
  if (!db) throw new Error("Database not initialized. Call init() first.")
  const rows = await db.select<Array<{
    id: string
    content: string
    completed: number
    created_at: string
    completed_at: string | null
    sort_order: number
  }>>("SELECT * FROM todos ORDER BY completed ASC, sort_order ASC")
  return rows.map((row: {
    id: string
    content: string
    completed: number
    created_at: string
    completed_at: string | null
    sort_order: number
  }) => ({
    id: row.id,
    content: row.content,
    completed: row.completed === 1,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    order: row.sort_order,
  }))
}

export async function addTodo(item: TodoItem): Promise<void> {
  if (!db) throw new Error("Database not initialized. Call init() first.")
  await db.execute(
    "INSERT INTO todos (id, content, completed, created_at, completed_at, sort_order) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      item.id,
      item.content,
      item.completed ? 1 : 0,
      item.createdAt,
      item.completedAt,
      item.order,
    ]
  )
}

export async function updateTodo(id: string, data: Partial<TodoItem>): Promise<void> {
  if (!db) throw new Error("Database not initialized. Call init() first.")

  const setClauses: string[] = []
  const params: unknown[] = []

  if (data.content !== undefined) {
    setClauses.push(`content = $${params.length + 1}`)
    params.push(data.content)
  }
  if (data.completed !== undefined) {
    setClauses.push(`completed = $${params.length + 1}`)
    params.push(data.completed ? 1 : 0)
  }
  if (data.createdAt !== undefined) {
    setClauses.push(`created_at = $${params.length + 1}`)
    params.push(data.createdAt)
  }
  if (data.completedAt !== undefined) {
    setClauses.push(`completed_at = $${params.length + 1}`)
    params.push(data.completedAt)
  }
  if (data.order !== undefined) {
    setClauses.push(`sort_order = $${params.length + 1}`)
    params.push(data.order)
  }

  if (setClauses.length === 0) return

  params.push(id)
  await db.execute(
    `UPDATE todos SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
    params
  )
}

export async function deleteTodo(id: string): Promise<void> {
  if (!db) throw new Error("Database not initialized. Call init() first.")
  await db.execute("DELETE FROM todos WHERE id = $1", [id])
}

export async function reorderTodos(ids: string[]): Promise<void> {
  if (!db) throw new Error("Database not initialized. Call init() first.")
  for (let i = 0; i < ids.length; i++) {
    await db.execute("UPDATE todos SET sort_order = $1 WHERE id = $2", [i, ids[i]])
  }
}