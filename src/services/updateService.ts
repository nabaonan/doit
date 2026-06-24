import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export interface ReleaseInfo {
  tag_name: string
  version: string
  name: string
  html_url: string
  published_at: string
  body: string
}

export interface UpdateCheckResult {
  current_version: string
  latest_version: string
  has_update: boolean
  release: ReleaseInfo | null
  asset: ReleaseAsset | null
  platform: string
  arch: string
}

export interface DownloadProgress {
  bytes_downloaded: number
  total_bytes: number
  percentage: number
  file_name: string
}

/**
 * 检测是否在 Tauri 环境中
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__
}

/**
 * 获取当前应用版本
 */
export async function getAppVersion(): Promise<string> {
  if (!isTauri()) {
    return "0.0.0"
  }
  return await invoke<string>("get_app_version")
}

/**
 * 查询最新版本（调用 GitHub API + 匹配当前平台资产）
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri()) {
    throw new Error("仅在 Tauri 桌面环境中可用")
  }
  return await invoke<UpdateCheckResult>("check_for_update")
}

/**
 * 流式下载 + 进度回调 + 完成后自动打开
 * @param url 安装包下载链接
 * @param fileName 保存的文件名
 * @param onProgress 进度回调（每 200ms 一次）
 */
export async function downloadAndInstallUpdate(
  url: string,
  fileName: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  if (!isTauri()) {
    throw new Error("仅在 Tauri 桌面环境中可用")
  }

  // 提前订阅进度事件（避免错过早期事件）
  let unlisten: UnlistenFn | null = null
  if (onProgress) {
    unlisten = await listen<DownloadProgress>(
      "update-download-progress",
      (event) => {
        onProgress(event.payload)
      }
    )
  }

  try {
    return await invoke<string>("download_and_install_update", { url, fileName })
  } finally {
    if (unlisten) unlisten()
  }
}

/**
 * 取消正在进行的下载
 */
export async function cancelDownload(): Promise<void> {
  if (!isTauri()) return;
  await invoke("cancel_download");
}

/**
 * 字节数格式化为可读字符串
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
