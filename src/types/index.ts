export interface TodoItem {
  id: string
  content: string
  completed: boolean
  createdAt: string
  completedAt: string | null
  order: number
}

export interface AppSettings {
  completionMode: "checkbox" | "longpress"
  longPressDuration: number
  cloudSync: {
    enabled: boolean
    provider: "webdav" | "local_folder"
    webdavUrl: string
    webdavUsername: string
    webdavPassword: string
    localSyncPath: string
  }
}