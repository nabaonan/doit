import { uploadDbBackup } from "./webdavService"

const SYNC_INTERVAL_MS = 5 * 60 * 1000

type SyncCallback = {
  onStatusChange?: (status: string) => void
}

let timer: ReturnType<typeof setInterval> | null = null
let callback: SyncCallback | null = null

export function setSyncCallback(cb: SyncCallback) {
  callback = cb
}

export function startAutoSync(
  settings: () => { cloudSync: { enabled: boolean; provider: string; webdavUrl: string; webdavUsername: string; webdavPassword: string } }
) {
  stopAutoSync()
  runSync(settings)
  timer = setInterval(() => runSync(settings), SYNC_INTERVAL_MS)
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

async function runSync(
  settings: () => { cloudSync: { enabled: boolean; provider: string; webdavUrl: string; webdavUsername: string; webdavPassword: string } }
) {
  const { cloudSync } = settings()

  if (cloudSync.provider !== "webdav" || !cloudSync.webdavUrl) {
    return
  }

  if (!cloudSync.enabled) {
    return
  }

  callback?.onStatusChange?.("正在同步...")

  try {
    await uploadDbBackup(cloudSync.webdavUrl, cloudSync.webdavUsername, cloudSync.webdavPassword)
    callback?.onStatusChange?.("同步完成")
  } catch {
    callback?.onStatusChange?.("同步失败")
  }
}
