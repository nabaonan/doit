export interface TodoItem {
  id: string
  content: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
  tagId: string | null
  parentId: string | null
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

export interface AppSettings {
  completionMode: "checkbox" | "longpress"
  longPressDuration: number
  theme: "system" | "light" | "dark"
  happyMode: boolean
  addTodoShortcut: ShortcutConfig
  tags: Tag[]
  cloudSync: {
    enabled: boolean
    provider: "webdav" | "local_folder"
    webdavUrl: string
    webdavUsername: string
    webdavPassword: string
    localSyncPath: string
  }
}