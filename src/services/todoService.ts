import type { TodoItem } from "../types"
import { getDb } from "./db"

export async function init(): Promise<void> {
  await getDb()
}

export function sortTodos(todos: TodoItem[]): TodoItem[] {
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
  const db = await getDb()
  if (!db) return []
  const rows = await (db as { select: <T>(sql: string) => Promise<T> }).select<Array<{
    id: string
    content: string
    completed: number
    created_at: string
    completed_at: string | null
    sort_order: number
    tag_id: string | null
    cat_id: string | null
    parent_id: string | null
  }>>("SELECT * FROM todos ORDER BY completed ASC, sort_order ASC")
  const items = rows.map((row) => ({
    id: row.id,
    content: row.content,
    completed: row.completed === 1,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    order: row.sort_order,
    tagId: row.tag_id,
    catId: row.cat_id,
    parentId: row.parent_id,
  }))
  return sortTodos(items)
}

export async function addTodo(item: TodoItem): Promise<boolean> {
  const db = await getDb()
  if (!db) {
    console.warn("[doit] addTodo: db unavailable")
    return false
  }
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute(
    "INSERT INTO todos (id, content, completed, created_at, completed_at, sort_order, tag_id, cat_id, parent_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [item.id, item.content, item.completed ? 1 : 0, item.createdAt, item.completedAt, item.order, item.tagId, item.catId, item.parentId]
  )
  console.log("[doit] addTodo success:", item.id)
  return true
}

export async function updateTodo(id: string, data: Partial<TodoItem>): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
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
  if (data.catId !== undefined) {
    setClauses.push(`cat_id = $${params.length + 1}`)
    params.push(data.catId)
  }
  if (data.parentId !== undefined) {
    setClauses.push(`parent_id = $${params.length + 1}`)
    params.push(data.parentId)
  }

  if (setClauses.length === 0) return true

  params.push(id)
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute(
    `UPDATE todos SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
    params
  )
  return true
}

export async function deleteTodo(id: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("DELETE FROM todos WHERE id = $1 OR parent_id = $1", [id])
  return true
}

export async function clearAllTodos(): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  await (db as { execute: (sql: string) => Promise<void> }).execute("DELETE FROM todos")
  return true
}

export async function reorderTodos(ids: string[]): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  for (let i = 0; i < ids.length; i++) {
    await (db as { execute: (sql: string, params: unknown[]) => Promise<void> }).execute("UPDATE todos SET sort_order = $1 WHERE id = $2", [i, ids[i]])
  }
  return true
}
