interface FetchOptions {
  method: string
  headers: Record<string, string>
  body?: BodyInit | null
}

interface ProxyResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  text(): Promise<string>
  json(): Promise<any>
}

let _invoke: any = null
let _isTauriEnv: boolean | null = null

async function getInvoke() {
  if (!_invoke) {
    const mod = await import("@tauri-apps/api/core")
    _invoke = mod.invoke
  }
  return _invoke
}

async function detectTauri(): Promise<boolean> {
  if (_isTauriEnv !== null) return _isTauriEnv

  // 方法 1: 尝试导入官方 isTauri 函数
  try {
    const mod = await import("@tauri-apps/api/core")
    if (typeof mod.isTauri === "function") {
      _isTauriEnv = mod.isTauri()
      if (_isTauriEnv) return true
    }
    // 方法 2: 尝试调用一个已知存在的命令来检测
    await mod.invoke("greet", { name: "test" })
    _isTauriEnv = true
    return true
  } catch {
    // 不在 Tauri 环境
    _isTauriEnv = false
    return false
  }
}

async function tauriFetch(url: string, options: FetchOptions): Promise<ProxyResponse> {
  const invoke = await getInvoke()

  const headers: Record<string, string> = {}
  if (options.headers) {
    if (typeof (options.headers as any).forEach === "function") {
      ;(options.headers as any).forEach((value: string, key: string) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, options.headers)
    }
  }

  const bodyStr = options.body ? (options.body instanceof Blob ? await options.body.text() : String(options.body)) : undefined

  const result = await invoke("tauri_fetch", {
    req: {
      method: options.method,
      url,
      headers,
      body: bodyStr,
    },
  })

  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    statusText: result.status_text,
    headers: result.headers,
    text: async () => result.body,
    json: async () => JSON.parse(result.body),
  }
}

async function browserFetch(url: string, options: FetchOptions): Promise<ProxyResponse> {
  const resp = await fetch(url, {
    method: options.method,
    headers: options.headers as HeadersInit,
    body: options.body,
  })

  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    headers: Object.fromEntries(resp.headers.entries()),
    text: async () => resp.text(),
    json: async () => resp.json(),
  }
}

export async function httpFetch(url: string, options: FetchOptions): Promise<ProxyResponse> {
  if (await detectTauri()) {
    return tauriFetch(url, options)
  }
  return browserFetch(url, options)
}

// 添加一个专门用于检测 WebDAV 连接的快捷命令
export async function testWebdavConnection(
  url: string,
  username: string,
  password: string
): Promise<{ ok: boolean; status?: number; message: string }> {
  if (!(await detectTauri())) {
    return { ok: false, message: "非 Tauri 环境，请使用桌面应用运行" }
  }

  const invoke = await getInvoke()
  const authHeader = "Basic " + btoa(`${username}:${password}`)

  // 尝试多个 URL 候选
  const candidates: string[] = []
  const normalized = url.endsWith("/") ? url : url + "/"
  candidates.push(normalized)
  const hasWebdav = normalized.toLowerCase().includes("/webdav")
  if (!hasWebdav) {
    candidates.push(normalized + "webdav/")
    candidates.push(normalized + "webdav")
  }

  const errors: string[] = []
  for (const baseUrl of [...new Set(candidates)]) {
    try {
      const result = await invoke("tauri_fetch", {
        req: {
          method: "OPTIONS",
          url: baseUrl,
          headers: { Authorization: authHeader },
          body: undefined,
        },
      })

      if (result.status >= 200 && result.status < 300) {
        return { ok: true, status: result.status, message: `连接成功 (${baseUrl})` }
      }
      errors.push(`${baseUrl} -> HTTP ${result.status} ${result.status_text}`)
    } catch (e: any) {
      const msg = e?.message || String(e)
      errors.push(`${baseUrl} -> ${msg}`)
    }
  }

  return { ok: false, message: "连接失败:\n" + errors.join("\n") }
}
