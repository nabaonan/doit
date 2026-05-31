import type { TodoItem } from "../types"
import { isTauri } from "./tauriEnv"

let db: unknown = null

const STORAGE_KEY = "doit_todos"

async function loadDB() {
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
      parent_id TEXT
    )`
  )
}

function getLocalTodos(): TodoItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveLocalTodos(todos: TodoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

let initialized = false

export async function init(): Promise<void> {
  if (initialized) return
  initialized = true
  if (isTauri) {
    await loadDB()
  }
}

function sortTodos(todos: TodoItem[]): TodoItem[] {
  const childMap = new Map<string, TodoItem[]>()
  for (const t of todos) {
    if (t.parentId) {
      const list = childMap.get(t.parentId) || []
      list.push(t)
      childMap.set(t.parentId, list)
    }
  }
  for (const [, list] of childMap) {
    list.sort((a, b) => a.order - b.order)
  }
  const topLevel = todos.filter((t) => !t.parentId)
  topLevel.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return a.order - b.order
  })
  const result: TodoItem[] = []
  function collect(parentId: string) {
    const children = childMap.get(parentId) || []
    for (const child of children) {
      result.push(child)
      collect(child.id)
    }
  }
  for (const parent of topLevel) {
    result.push(parent)
    collect(parent.id)
  }
  return result
}

export async function getAllTodos(): Promise<TodoItem[]> {
  if (isTauri) {
    if (!db) await loadDB()
    const rows = await (db as { select: <T>(sql: string) => Promise<T> }).select<Array<{
      id: string
      content: string
      completed: number
      created_at: string
      completed_at: string | null
      sort_order: number
      tag_id: string | null
      parent_id: string | null
    }>>("SELECT * FROM todos ORDER BY completed ASC, sort_order ASC")
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      completed: row.completed === 1,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      order: row.sort_order,
      tagId: row.tag_id,
      parentId: row.parent_id,
    }))
  }
  return sortTodos(getLocalTodos())
}

export async function addTodo(item: TodoItem): Promise<void> {
  if (isTauri) {
    if (!db) await loadDB()
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute(
      "INSERT INTO todos (id, content, completed, created_at, completed_at, sort_order, tag_id, parent_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [item.id, item.content, item.completed ? 1 : 0, item.createdAt, item.completedAt, item.order, item.tagId, item.parentId]
    )
    return
  }
  const todos = getLocalTodos()
  todos.push(item)
  saveLocalTodos(todos)
}

export async function updateTodo(id: string, data: Partial<TodoItem>): Promise<void> {
  if (isTauri) {
    if (!db) await loadDB()

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
    if (data.tagId !== undefined) {
      setClauses.push(`tag_id = $${params.length + 1}`)
      params.push(data.tagId)
    }
    if (data.parentId !== undefined) {
      setClauses.push(`parent_id = $${params.length + 1}`)
      params.push(data.parentId)
    }

    if (setClauses.length === 0) return

    params.push(id)
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute(
      `UPDATE todos SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
      params
    )
    return
  }

  const todos = getLocalTodos()
  const idx = todos.findIndex((t) => t.id === id)
  if (idx !== -1) {
    todos[idx] = { ...todos[idx], ...data }
    saveLocalTodos(todos)
  }
}

export async function deleteTodo(id: string): Promise<void> {
  if (isTauri) {
    if (!db) await loadDB()
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("DELETE FROM todos WHERE parent_id = $1", [id])
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("DELETE FROM todos WHERE id = $1", [id])
    return
  }
  const todos = getLocalTodos()
  const idsToDelete = new Set<string>()
  idsToDelete.add(id)
  for (const t of todos) {
    if (t.parentId === id) idsToDelete.add(t.id)
  }
  saveLocalTodos(todos.filter((t) => !idsToDelete.has(t.id)))
}

export async function reorderTodos(ids: string[]): Promise<void> {
  if (isTauri) {
    if (!db) await loadDB()
    for (let i = 0; i < ids.length; i++) {
      await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("UPDATE todos SET sort_order = $1 WHERE id = $2", [i, ids[i]])
    }
    return
  }
  const todos = getLocalTodos()
  const map = new Map(todos.map((t) => [t.id, t]))
  const reordered: TodoItem[] = []
  for (let i = 0; i < ids.length; i++) {
    const item = map.get(ids[i])
    if (item) {
      reordered.push({ ...item, order: i })
    }
  }
  const remaining = todos.filter((t) => !ids.includes(t.id))
  saveLocalTodos([...reordered, ...remaining])
}