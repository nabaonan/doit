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

async function runBackup() {
  if (!getSettings) return
  const { cloudSync } = getSettings()
  onBackupStatus?.("正在自动备份...")
  try {
    await uploadDbBackup(
      cloudSync.webdavUrl,
      cloudSync.webdavUsername,
      cloudSync.webdavPassword
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
