import type { TodoItem, AppSettings } from "../types"
import { httpFetch, testWebdavConnection } from "./httpClient"

export interface BackupData {
  version: number
  exportedAt: string
  data: {
    todos: TodoItem[]
    settings: AppSettings
  }
}

function getAuthHeader(username: string, password: string): string {
  return "Basic " + btoa(`${username}:${password}`)
}

function buildUrl(baseUrl: string, filename: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"
  return base + filename
}

function tryUrls(base: string): string[] {
  const candidates: string[] = []

  // 用户输入的原样 + "/"
  const normalized = base.endsWith("/") ? base : base + "/"
  candidates.push(normalized)

  // 尝试 /webdav/ 路径（飞牛 NAS 等）
  const hasWebdav = normalized.toLowerCase().includes("/webdav")
  if (!hasWebdav) {
    candidates.push(normalized + "webdav/")
    // 也尝试 webdav 不带 /
    candidates.push(normalized + "webdav")
  }

  // 去重
  return [...new Set(candidates)]
}

export interface ConnectionResult {
  ok: boolean
  status?: number
  message: string
}

export async function testConnection(
  url: string,
  username: string,
  password: string
): Promise<ConnectionResult> {
  // 使用专门的 Tauri 直接连接测试（绕过 WebView fetch）
  const directResult = await testWebdavConnection(url, username, password)
  if (directResult.message.startsWith("连接成功")) {
    return directResult
  }

  // 如果 Tauri 测试失败，再用 httpFetch 尝试一次（兼容浏览器模式）
  const authHeader = getAuthHeader(username, password)
  const candidates = tryUrls(url)
  const errors: string[] = [directResult.message]

  for (const baseUrl of candidates) {
    try {
      let resp = await httpFetch(baseUrl, {
        method: "OPTIONS",
        headers: { Authorization: authHeader },
      })
      if (resp.ok) {
        return { ok: true, status: resp.status, message: `连接成功 (${baseUrl})` }
      }

      resp = await httpFetch(baseUrl, {
        method: "PROPFIND",
        headers: { Authorization: authHeader, Depth: "0" },
      })
      if (resp.ok || resp.status === 405) {
        return { ok: true, status: resp.status, message: `连接成功 (${baseUrl})` }
      }

      resp = await httpFetch(baseUrl, {
        method: "GET",
        headers: { Authorization: authHeader },
      })
      if (resp.ok || resp.status === 404 || resp.status === 405) {
        return { ok: true, status: resp.status, message: `连接成功 (${baseUrl})` }
      }

      errors.push(`${baseUrl} -> HTTP ${resp.status} ${resp.statusText}`)
    } catch (e: unknown) {
      const err = e as Error
      const msg = err.message || String(err)
      errors.push(`${baseUrl} -> ${msg}`)
    }
  }

  const lastError = errors[errors.length - 1] || "未知错误"
  const allErrors = errors.join("; ")

  if (
    lastError.includes("ERR_CERT") ||
    lastError.includes("certificate") ||
    lastError.includes("SSL") ||
    lastError.includes("ssl")
  ) {
    return {
      ok: false,
      message:
        "SSL 证书错误：NAS 使用了自签名证书。\n" +
        "请尝试以下方法：\n" +
        "1. 在浏览器中先打开 NAS 的 WebDAV 地址，信任证书后再试\n" +
        "2. 如果使用 Tauri 桌面应用，确保以开发模式运行（自动忽略证书错误）\n" +
        "详细错误：" +
        allErrors,
    }
  }

  if (lastError.includes("401")) {
    return {
      ok: false,
      message: "认证失败（HTTP 401）：用户名或密码错误，请检查后重试",
    }
  }

  if (lastError.includes("403")) {
    return {
      ok: false,
      message: "权限不足（HTTP 403）：用户没有访问该路径的权限，请检查 WebDAV 用户权限设置",
    }
  }

  if (lastError.includes("404")) {
    return {
      ok: false,
      message:
        "地址不存在（HTTP 404）：请检查 WebDAV URL 是否正确。\n" +
        "常见 WebDAV 地址格式：\n" +
        "- 群晖 NAS：http://<IP>:5005/webdav/ 或 https://<IP>:5006\n" +
        "- 飞牛 NAS：http://<IP>/webdav/\n" +
        "详细错误：" +
        allErrors,
    }
  }

  if (lastError.includes("Failed to fetch") || lastError.includes("NetworkError") || lastError.includes("network") || lastError.includes("拒绝连接") || lastError.includes("Connection refused")) {
    return {
      ok: false,
      message:
        "网络错误：无法连接到服务器。\n" +
        "可能的原因：\n" +
        "1. NAS 地址或端口不正确\n" +
        "2. NAS 未开启 WebDAV 服务\n" +
        "3. 网络不可达（是否在同一局域网？）\n" +
        "4. NAS 自签名证书被 WebView 拒绝\n" +
        "详细错误：" +
        allErrors,
    }
  }

  return { ok: false, message: "连接失败：" + allErrors }
}

export async function uploadBackup(
  url: string,
  username: string,
  password: string,
  data: BackupData
): Promise<void> {
  const body = JSON.stringify(data, null, 2)
  const timestamp = data.exportedAt.replace(/[:.]/g, "-").slice(0, 19)
  const filename = `doit-backup_${timestamp}.json`
  const latestFilename = "doit-backup_latest.json"

  const headers: Record<string, string> = {
    Authorization: getAuthHeader(username, password),
    "Content-Type": "application/json",
  }

  const uploadFile = async (name: string) => {
    const resp = await httpFetch(buildUrl(url, name), {
      method: "PUT",
      headers,
      body,
    })
    if (!resp.ok) {
      throw new Error(`上传失败: ${resp.status} ${resp.statusText}`)
    }
  }

  await uploadFile(filename)
  await uploadFile(latestFilename)
}

export async function downloadBackup(
  url: string,
  username: string,
  password: string
): Promise<BackupData> {
  const latestUrl = buildUrl(url, "doit-backup_latest.json")
  const resp = await httpFetch(latestUrl, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(username, password),
    },
  })
  if (!resp.ok) {
    throw new Error(`下载失败: ${resp.status} ${resp.statusText}`)
  }
  const bodyText = await resp.text()
  const data: BackupData = JSON.parse(bodyText)
  if (!data.version || !data.data) {
    throw new Error("备份文件格式不兼容")
  }
  return data
}

export async function listBackups(
  url: string,
  username: string,
  password: string
): Promise<string[]> {
  const baseUrl = url.endsWith("/") ? url : url + "/"
  const resp = await httpFetch(baseUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: getAuthHeader(username, password),
      Depth: "1",
    },
  })
  if (!resp.ok) {
    throw new Error(`获取备份列表失败: ${resp.status} ${resp.statusText}`)
  }
  const text = await resp.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, "text/xml")
  const hrefs = xml.querySelectorAll("D\\:href, href")
  const files: string[] = []
  for (const el of hrefs) {
    const href = el.textContent || ""
    if (href.endsWith(".json") && !href.endsWith("latest.json")) {
      const name = href.split("/").pop() || href
      files.push(name)
    }
  }
  return files.sort().reverse()
}
