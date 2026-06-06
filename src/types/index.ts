export interface TodoItem {
  id: string
  content: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  tagId: string | null
  catId: string | null
  parentId: string | null
}

export interface TodoItemNode {
  id: string
  content: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  tagId: string | null
  catId: string | null
  parentId: string | null
  children: TodoItemNode[]
}

export function flatToNested(flat: TodoItem[]): TodoItemNode[] {
  const map = new Map<string, TodoItemNode>()
  const roots: TodoItemNode[] = []

  for (const item of flat) {
    map.set(item.id, { ...item, children: [] })
  }

  for (const item of flat) {
    const node = map.get(item.id)!
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function nestedToFlat(nodes: TodoItemNode[]): TodoItem[] {
  const result: TodoItem[] = []

  function walk(list: TodoItemNode[], parentId: string | null, orderStart: number) {
    for (let i = 0; i < list.length; i++) {
      const { children, ...flat } = list[i]
      result.push({ ...flat, parentId, order: orderStart + i })
      if (children.length > 0) {
        walk(children, list[i].id, 0)
      }
    }
  }

  walk(nodes, null, 0)
  return result
}

export interface ShortcutConfig {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Category {
  id: string
  name: string
  color: string
}

export type FontFamilyOption = "default" | "cartoon"

export interface AppSettings {
  completionMode: "checkbox" | "longpress"
  longPressDuration: number
  theme: "system" | "light" | "dark"
  happyMode: boolean
  fontFamily: FontFamilyOption
  addTodoShortcut: ShortcutConfig
  tags: Tag[]
  categories: Category[]
  cloudSync: {
    enabled: boolean
    provider: "webdav" | "local_folder"
    webdavUrl: string
    webdavUsername: string
    webdavPassword: string
    localSyncPath: string
  }
}