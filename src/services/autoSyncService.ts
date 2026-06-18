import type { TodoItem, AppSettings } from "../types"
import { uploadBackup, downloadBackup } from "./webdavService"

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 分钟

type SyncCallback = {
  onStatusChange?: (status: string) => void
}

let timer: ReturnType<typeof setInterval> | null = null
let lastSyncAt: string | null = null
let lastTodosHash: string | null = null
let callback: SyncCallback | null = null

function hashTodos(todos: TodoItem[]): string {
  // 用 JSON 字符串的简单哈希来检测是否变化
  return JSON.stringify(todos.map((t) => ({ id: t.id, content: t.content, completed: t.completed, completedAt: t.completedAt, order: t.order, tagId: t.tagId, catId: t.catId, parentId: t.parentId })))
}

export function setSyncCallback(cb: SyncCallback) {
  callback = cb
}

export function startAutoSync(
  todos: () => TodoItem[],
  settings: () => AppSettings
) {
  stopAutoSync()
  runSync(todos, settings)
  timer = setInterval(() => runSync(todos, settings), SYNC_INTERVAL_MS)
}

export function stopAutoSync() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

export function isAutoSyncRunning(): boolean {
  return timer !== null
}

export function setLastSyncTime(time: string) {
  lastSyncAt = time
}

export async function forceSync(
  todos: TodoItem[],
  settings: AppSettings
): Promise<string> {
  const { cloudSync } = settings
  if (!cloudSync.enabled || cloudSync.provider !== "webdav" || !cloudSync.webdavUrl) {
    return "云同步未启用或未配置 WebDAV"
  }

  try {
    await uploadBackup(cloudSync.webdavUrl, cloudSync.webdavUsername, cloudSync.webdavPassword, {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { todos, settings },
    })
    lastSyncAt = new Date().toISOString()
    lastTodosHash = hashTodos(todos)
    return "同步完成"
  } catch (e: unknown) {
    const err = e as Error
    return `同步失败: ${err.message || String(err)}`
  }
}

async function runSync(
  todos: () => TodoItem[],
  settings: () => AppSettings
) {
  const currentSettings = settings()
  const { cloudSync } = currentSettings

  if (!cloudSync.enabled || cloudSync.provider !== "webdav" || !cloudSync.webdavUrl) {
    return
  }

  const currentTodos = todos()
  const currentHash = hashTodos(currentTodos)

  // 如果数据没有变化且已经同步过，跳过本次同步
  if (lastTodosHash !== null && currentHash === lastTodosHash && lastSyncAt !== null) {
    return
  }

  try {
    callback?.onStatusChange?.("正在同步...")

    // 先尝试从远程下载最新备份，比较时间戳
    let remoteData: { todos: TodoItem[]; settings: AppSettings } | null = null
    let remoteTime: string | null = null
    try {
      const backup = await downloadBackup(cloudSync.webdavUrl, cloudSync.webdavUsername, cloudSync.webdavPassword)
      remoteData = backup.data
      remoteTime = backup.exportedAt
    } catch {
      // 远程没有备份或无法读取，忽略
    }

    if (remoteData && remoteTime) {
      // 远程版本较新且本地有未同步变更 — 简单策略：以较新的为准
      if (lastSyncAt && remoteTime > lastSyncAt) {
        // 本地有变化但远程更新 — 用户需要手动处理冲突
        // 为安全起见，本版先不上传，提示用户手动处理
        callback?.onStatusChange?.("远程版本较新，跳过自动同步。请手动使用「下载恢复」功能。")
        return
      }
    }

    // 上传本地数据
    await uploadBackup(cloudSync.webdavUrl, cloudSync.webdavUsername, cloudSync.webdavPassword, {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { todos: currentTodos, settings: currentSettings },
    })

    lastSyncAt = new Date().toISOString()
    lastTodosHash = currentHash
    callback?.onStatusChange?.("同步完成")
  } catch (e: unknown) {
    const err = e as Error
    callback?.onStatusChange?.(`同步失败: ${err.message || String(err)}`)
  }
}
