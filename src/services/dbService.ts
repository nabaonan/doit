import { getDb, closeDb } from "./db"
import dayjs from "dayjs"

interface BackupData {
  version: 1
  exportedAt: string
  todos: unknown[]
  settings: unknown
}

export async function exportDatabase(): Promise<void> {
  try {
    const { appConfigDir } = await import("@tauri-apps/api/path")
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { copyFile } = await import("@tauri-apps/plugin-fs")

    const configDir = await appConfigDir()
    const dbPath = `${configDir}doit.db`

    const filePath = await save({
      defaultPath: `doit-backup-${dayjs().format("YYYY-MM-DD")}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    })

    if (!filePath) return

    await copyFile(dbPath, filePath)
    return
  } catch {
    // 非 Tauri 环境，走浏览器 JSON 导出
  }

  const todosJson = localStorage.getItem("doit_todos")
  const settingsJson = localStorage.getItem("doit_settings")

  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: todosJson ? JSON.parse(todosJson) : [],
    settings: settingsJson ? JSON.parse(settingsJson) : null,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `doit-backup-${dayjs().format("YYYY-MM-DD")}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importDatabase(): Promise<void> {
  try {
    const { appConfigDir } = await import("@tauri-apps/api/path")
    const { open } = await import("@tauri-apps/plugin-dialog")
    const { readFile, writeFile } = await import("@tauri-apps/plugin-fs")

    const filePath = await open({
      multiple: false,
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    })

    if (!filePath) return

    const data = await readFile(filePath as string)

    await closeDb()

    const configDir = await appConfigDir()
    const dbPath = `${configDir}doit.db`

    await writeFile(dbPath, data)

    await getDb()
    return
  } catch {
    // 非 Tauri 环境，走浏览器 JSON 导入
  }

  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"

  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })

  if (!file) return

  const text = await file.text()
  const data: BackupData = JSON.parse(text)

  if (!data || data.version !== 1) {
    throw new Error("不支持的备份文件格式")
  }

  if (data.todos) {
    localStorage.setItem("doit_todos", JSON.stringify(data.todos))
  }
  if (data.settings) {
    localStorage.setItem("doit_settings", JSON.stringify(data.settings))
  }
}
