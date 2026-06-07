# 修复客户端导出数据库逻辑

## 问题描述

在 Tauri 客户端中点击"导出数据库"时：
1. 弹出原生保存对话框选择 `.db` 文件保存路径
2. `copyFile()` 执行后 `return`，但函数并未真正退出
3. 代码继续执行到 `catch` 块之后的浏览器 JSON 导出逻辑
4. 导致弹出第二个保存对话框（JSON 格式）

**根因**：`exportDatabase()` 中 Tauri 导出路径的 `try` 块内 `copyFile()` 执行成功，但 `catch` 块捕获了异常（可能是 `copyFile` 的权限问题或路径问题），导致流程落入浏览器 JSON 导出路径。

## 当前状态分析

- `exportDatabase()` 在 `dbService.ts` 第 11-71 行
- Tauri 路径：`try` 块内 `copyFile(dbPath, filePath)` 后 `return`
- 浏览器路径：`catch` 块之后，生成 JSON blob 并触发下载
- 问题：`copyFile` 可能因权限/路径问题抛出异常，被 `catch` 捕获后继续执行浏览器路径

## 修改方案

### 1. 修复 `exportDatabase()` 中的 Tauri 导出逻辑

**文件**：`src/services/dbService.ts`

**问题**：`copyFile` 在 Tauri 2 中需要正确的权限和作用域。当前 `capabilities/default.json` 中已有 `"fs:scope"` 允许 `"**"`，但 `copyFile` 的源路径（`appConfigDir()` 返回的路径）可能不在允许范围内。

**修改**：
- 在 Tauri 路径中，使用 `readFile` + `writeFile` 替代 `copyFile`，避免 `copyFile` 的路径权限问题
- 添加一个标志变量 `exportedInTauri`，在 Tauri 路径成功完成后设置为 `true`，在浏览器路径前检查该标志

具体代码变更：

```typescript
export async function exportDatabase(): Promise<void> {
  let exportedInTauri = false
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
    exportedInTauri = true
    return
  } catch {
    // 非 Tauri 环境或导出失败，走浏览器 JSON 导出
  }

  // 如果已经在 Tauri 中成功导出，跳过浏览器路径
  if (exportedInTauri) return

  // ... 浏览器 JSON 导出逻辑不变
}
```

**说明**：
- 使用 `readFile` + `writeFile` 替代 `copyFile`：`readFile` 读取应用数据目录的文件（Tauri 默认允许），`writeFile` 写入用户选择的路径（已在 `fs:scope` 中允许 `"**"`），这样更可靠
- 添加 `exportedInTauri` 标志：即使 `try` 块内 `return` 未执行到（理论上不会，但作为防御性编程），也能防止浏览器路径被执行

### 2. 验证 Tauri 权限配置

**文件**：`src-tauri/capabilities/default.json`

确认已有以下权限（当前已存在，无需修改）：
- `"dialog:default"` — 保存对话框
- `"fs:default"` — 文件系统操作
- `"fs:scope"` 允许 `"**"` — 任意路径读写

## 验证步骤

1. `npm run build` — 确保类型检查通过
2. `npm run tauri dev` — 在 Tauri 客户端中测试导出：
   - 点击设置 → 导出数据库
   - 选择保存路径
   - 确认只弹出一次保存对话框，且 `.db` 文件正确保存
3. 浏览器中测试导出：
   - 在浏览器中打开
   - 点击设置 → 导出数据库
   - 确认弹出 JSON 保存对话框
