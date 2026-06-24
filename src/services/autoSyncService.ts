import { uploadDbBackup, downloadDbBackup } from "./webdavService"
import { closeDb, getDb } from "./db"
import { getNextRunTime } from "../utils/cron"
import type { AppSettings } from "../types"

let backupTimer: ReturnType<typeof setTimeout> | null = null
let restoreTimer: ReturnType<typeof setTimeout> | null = null
let getSettings: (() => AppSettings) | null = null
let onBackupStatus: ((status: string) => void) | null = null
let onRestoreStatus: ((status: string) => void) | null = null
let onDataChanged: (() => void) | null = null

export function setCallbacks(opts: {
  onBackupStatus?: (status: string) => void
  onRestoreStatus?: (status: string) => void
  onDataChanged?: () => void
}) {
  onBackupStatus = opts.onBackupStatus ?? null
  onRestoreStatus = opts.onRestoreStatus ?? null
  onDataChanged = opts.onDataChanged ?? null
}

export function startScheduler(settings: () => AppSettings) {
  stopScheduler()
  getSettings = settings
  scheduleNextBackup()
  scheduleNextRestore()
}

export function stopScheduler() {
  if (backupTimer !== null) {
    clearTimeout(backupTimer)
    backupTimer = null
  }
  if (restoreTimer !== null) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
  getSettings = null
}

export function restartScheduler(settings: () => AppSettings) {
  if (getSettings) {
    startScheduler(settings)
  }
}

/**
 * 启动时拉取远程（一次性，不进入定时调度）。
 * 由 App.vue onMounted 在 settings 加载完成后调用。
 */
export async function runRestoreOnStartup(
  settingsGetter: () => AppSettings
): Promise<void> {
  if (!settingsGetter) return
  const s = settingsGetter()
  if (!s.cloudSync.enabled) return
  if (!s.cloudSync.fetchOnStartup) return
  if (s.cloudSync.provider !== "webdav" || !s.cloudSync.webdavUrl) return

  try {
    onRestoreStatus?.("正在拉取云端数据...")
    await closeDb()
    await new Promise((r) => setTimeout(r, 300))
    await downloadDbBackup(
      s.cloudSync.webdavUrl,
      s.cloudSync.webdavUsername,
      s.cloudSync.webdavPassword
    )
    await getDb()
    onDataChanged?.()
    onRestoreStatus?.("云端数据拉取成功")
  } catch (e) {
    console.warn("[doit] 启动拉取失败:", e)
    onRestoreStatus?.("启动拉取失败")
    // 失败时主动重新打开本地 DB，避免 DB 处于关闭状态导致后续查询失败
    try {
      await getDb()
    } catch {}
  }
}

/**
 * 关闭时上传本地（一次性，不进入定时调度）。
 * 由 App.vue 注册的 tauri onCloseRequested 监听器触发。
 */
export async function runBackupOnExit(): Promise<void> {
  if (!getSettings) return
  const s = getSettings()
  if (!s.cloudSync.enabled) return
  if (!s.cloudSync.uploadOnExit) return
  if (s.cloudSync.provider !== "webdav" || !s.cloudSync.webdavUrl) return

  try {
    onBackupStatus?.("正在关闭时上传本地数据...")
    // keepRecent 由 Rust 端在 upload_db_to_webdav 内部处理
    await uploadDbBackup(
      s.cloudSync.webdavUrl,
      s.cloudSync.webdavUsername,
      s.cloudSync.webdavPassword,
      s.cloudSync.keepRecent
    )
    onBackupStatus?.("关闭时上传完成")
  } catch (e) {
    console.warn("[doit] 关闭时上传失败:", e)
    onBackupStatus?.("关闭时上传失败")
  }
}

function canRun(): boolean {
  if (!getSettings) return false
  const s = getSettings()
  return (
    s.cloudSync.enabled &&
    s.cloudSync.provider === "webdav" &&
    !!s.cloudSync.webdavUrl
  )
}

function scheduleNextBackup() {
  if (!getSettings || !canRun()) return
  const ab = getSettings().autoBackup
  if (!ab.enabled) return
  const next = getNextRunTime(ab.unit, ab.interval)
  const delay = Math.max(1000, next.getTime() - Date.now())
  backupTimer = setTimeout(async () => {
    await runBackup()
    scheduleNextBackup()
  }, delay)
}

function scheduleNextRestore() {
  if (!getSettings || !canRun()) return
  const ar = getSettings().autoRestore
  if (!ar.enabled) return
  const next = getNextRunTime(ar.unit, ar.interval)
  const delay = Math.max(1000, next.getTime() - Date.now())
  restoreTimer = setTimeout(async () => {
    await runRestore()
    scheduleNextRestore()
  }, delay)
}

export async function runBackup(): Promise<void> {
  if (!getSettings) return
  const { cloudSync } = getSettings()
  onBackupStatus?.("正在自动备份...")
  try {
    // keepRecent 由 Rust 端在 upload_db_to_webdav 内部处理
    await uploadDbBackup(
      cloudSync.webdavUrl,
      cloudSync.webdavUsername,
      cloudSync.webdavPassword,
      cloudSync.keepRecent
    )
    onBackupStatus?.("自动备份完成")
  } catch {
    onBackupStatus?.("自动备份失败")
  }
}

async function runRestore() {
  if (!getSettings) return
  const { cloudSync } = getSettings()
  onRestoreStatus?.("正在自动恢复...")
  try {
    await closeDb()
    await new Promise((r) => setTimeout(r, 300))
    await downloadDbBackup(
      cloudSync.webdavUrl,
      cloudSync.webdavUsername,
      cloudSync.webdavPassword
    )
    await getDb()
    onDataChanged?.()
    onRestoreStatus?.("自动恢复完成")
  } catch {
    onRestoreStatus?.("自动恢复失败")
  }
}
