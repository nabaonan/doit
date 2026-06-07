# 修复 Tauri 客户端导出数据库逻辑

## 问题描述

在 Tauri 客户端中点击"导出数据库"时：
1. 没有弹出保存对话框，而是直接下载到浏览器默认下载目录
2. 导出的是 JSON 文件而不是 SQLite `.db` 文件

**根因**：`exportDatabase()` 中 `isTauri` 检测为 `true`，进入 Tauri 路径后 `save()` 对话框弹出，但 `readFile(dbPath)` 读取 SQLite 数据库文件失败（路径问题或权限问题），`catch` 后落入浏览器 JSON 导出路径，导致用 `a.click()` 下载 JSON 文件。

## 当前状态分析

- `exportDatabase()` 在 [dbService.ts](file:///c:/Users/nbn/workspace/github/doit/src/services/dbService.ts) 第 12-56 行
- Tauri 路径：`isTauri` 守卫 → `save()` 对话框 → `readFile(dbPath)` → `writeFile(filePath, data)` → `return`
- 浏览器路径：`a.click()` 下载 JSON（无对话框选择路径）
- 问题：`readFile(dbPath)` 失败，因为 `appConfigDir()` 返回的路径可能包含 `doit.db` 但路径拼接方式不对，或者 `readFile` 需要正确的 `baseDirectory`
- `tauri.conf.json` 中 `devUrl` 为 `http://localhost:1420`，但 vite 实际端口为 `8443`，这可能导致 `npm run tauri dev` 时前端无法正确加载（但这不是本次问题的原因）

## 修改方案

### 1. 修复 `exportDatabase()` 中的 Tauri 导出逻辑

**文件**：[src/services/dbService.ts](file:///c:/Users/nbn/workspace/github/doit/src/services/dbService.ts)

**问题分析**：
- `appConfigDir()` 返回的路径末尾带 `/`，`${configDir}doit.db` 拼接正确
- 但 `readFile` 在 Tauri 2 中需要 `baseDirectory` 参数，或者使用绝对路径
- 当前 `capabilities/default.json` 中 `fs:scope` 允许 `"**"`，但 `readFile` 的路径需要是绝对路径或相对于某个 base directory

**修改**：
- 在 Tauri 路径中，使用 `readTextFile` 或 `readFile` 时指定正确的路径格式
- 使用 `@tauri-apps/plugin-fs` 的 `readFile` 时，路径需要是绝对路径（`appConfigDir()` 返回的就是绝对路径）
- 关键问题可能是 `appConfigDir()` 返回的路径格式问题，需要确保路径正确

具体代码变更：

```typescript
export async function exportDatabase(): Promise<void> {
  if (isTauri) {
    try {
      const { appConfigDir } = await import("@tauri-apps/api/path")
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { readFile, writeFile } = await import("@tauri-apps/plugin-fs")

      const configDir = await appConfigDir()
      const dbPath = `${configDir}doit.db`

      const filePath = await save({
        defaultPath: `doit-backup-${dayjs().format("YYYY-MM-DD")}.db`,
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      })

      if (!filePath) return

      const data = await readFile(dbPath)
      await writeFile(filePath, data)
      return
    } catch (e) {
      console.error("Tauri 导出失败", e)
      // 不 fallback 到浏览器路径，直接报错
      throw e
    }
  }

  // 浏览器环境：使用 showSaveFilePicker 让用户选择路径
  const todosJson = localStorage.getItem("doit_todos")
  const settingsJson = localStorage.getItem("doit_settings")

  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: todosJson ? JSON.parse(todosJson) : [],
    settings: settingsJson ? JSON.parse(settingsJson) : null,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const fileName = `doit-backup-${dayjs().format("YYYY-MM-DD")}.json`

  // 尝试使用 File System Access API (现代浏览器支持)
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "JSON Backup",
          accept: { "application/json": [".json"] },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  } catch {
    // 如果用户取消或浏览器不支持，fallback 到传统下载
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
```

**说明**：
- Tauri 路径中 `catch` 不再 fallback 到浏览器路径，而是直接 `throw`，这样用户能感知到错误
- 浏览器路径恢复使用 `showSaveFilePicker` 让用户选择保存位置，如果用户取消或浏览器不支持，再 fallback 到 `a.click()` 下载

### 2. 验证 Tauri 中 SQLite 数据库文件的实际路径

**文件**：[src/services/db.ts](file:///c:/Users/nbn/workspace/github/doit/src/services/db.ts)

`@tauri-apps/plugin-sql` 的 `Database.load("sqlite:doit.db")` 会在 Tauri 的默认应用数据目录创建数据库文件。`appConfigDir()` 返回的路径应该就是这个目录。

需要确认 `appConfigDir()` 返回的路径格式，确保 `readFile` 能正确读取。

### 3. 验证 Tauri 权限配置

**文件**：[src-tauri/capabilities/default.json](file:///c:/Users/nbn/workspace/github/doit/src-tauri/capabilities/default.json)

当前配置已包含：
- `"dialog:default"` — 保存对话框
- `"fs:default"` — 文件系统操作
- `"fs:scope"` 允许 `"**"` — 任意路径读写

这些权限已经足够，无需修改。

## 验证步骤

1. `npm run build` — 确保类型检查通过
2. `npm run tauri dev` — 在 Tauri 客户端中测试导出：
   - 点击设置 → 导出数据库
   - 确认弹出保存对话框，可选择保存路径
   - 确认保存的是 `.db` 文件（SQLite 格式）
3. 浏览器中测试导出：
   - 在浏览器中打开 `http://localhost:8443`
   - 点击设置 → 导出数据库
   - 确认弹出保存对话框（File System Access API）或下载 JSON 文件
