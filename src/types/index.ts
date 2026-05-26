export interface TodoItem {
  id: string
  content: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
}

export interface ShortcutConfig {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

export interface AppSettings {
  completionMode: "checkbox" | "longpress"
  longPressDuration: number
  theme: "system" | "light" | "dark"
  addTodoShortcut: ShortcutConfig
  cloudSync: {
    enabled: boolean
    provider: "webdav" | "local_folder"
    webdavUrl: string
    webdavUsername: string
    webdavPassword: string
    localSyncPath: string
  }
}