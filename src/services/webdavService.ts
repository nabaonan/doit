import type { TodoItem, AppSettings } from "../types"

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
  const urls: string[] = []
  const normalized = base.endsWith("/") ? base : base + "/"
  urls.push(normalized)
  // 一些 WebDAV 服务（如飞牛 NAS）的路径是 /webdav/ 而非根路径
  if (!normalized.toLowerCase().includes("/webdav")) {
    urls.push(normalized + "webdav/")
  }
  return urls
}

async function tryFetch(url: string, method: string, headers: Record<string, string>, body?: BodyInit): Promise<Response> {
  return fetch(url, { method, headers, body })
}

export async function testConnection(url: string, username: string, password: string): Promise<{ ok: boolean; status?: number; message: string }> {
  const authHeader = getAuthHeader(username, password)
  const candidates = tryUrls(url)

  for (const baseUrl of candidates) {
    try {
      // 尝试 OPTIONS
      let resp = await tryFetch(baseUrl, "OPTIONS", { Authorization: authHeader })
      if (resp.ok) return { ok: true, status: resp.status, message: "连接成功" }

      // 尝试 GET
      resp = await tryFetch(baseUrl, "GET", { Authorization: authHeader })
      if (resp.ok || resp.status === 404 || resp.status === 405) return { ok: true, status: resp.status, message: "连接成功" }

      // 尝试 PROPFIND
      resp = await tryFetch(baseUrl, "PROPFIND", { Authorization: authHeader, Depth: "0" })
      if (resp.ok) return { ok: true, status: resp.status, message: "连接成功" }

      // 如果返回 405 Method Not Allowed，说明地址可达但方法不支持，也算连接成功
      if (resp.status === 405) return { ok: true, status: resp.status, message: "连接成功" }
    } catch {
      // 当前 URL 失败，尝试下一个
      continue
    }
  }

  // 所有 URL 都失败，返回最后一个错误
  try {
    const lastUrl = candidates[candidates.length - 1]
    const resp = await tryFetch(lastUrl, "OPTIONS", { Authorization: authHeader })
    return { ok: false, status: resp.status, message: `服务器返回 ${resp.status} ${resp.statusText}` }
  } catch (e: unknown) {
    const err = e as Error
    const msg = err.message || String(err)
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      return { ok: false, message: "网络错误：无法连接到服务器，请检查地址是否正确以及网络是否可达" }
    }
    if (msg.includes("CORS") || msg.includes("cors")) {
      return { ok: false, message: "CORS 错误：浏览器限制了跨域请求。请使用 Tauri 桌面模式运行，或在 NAS 上配置 CORS" }
    }
    return { ok: false, message: msg }
  }
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
    const resp = await fetch(buildUrl(url, name), {
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
  const resp = await fetch(latestUrl, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(username, password),
    },
  })
  if (!resp.ok) {
    throw new Error(`下载失败: ${resp.status} ${resp.statusText}`)
  }
  const data: BackupData = await resp.json()
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
  const resp = await fetch(baseUrl, {
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
