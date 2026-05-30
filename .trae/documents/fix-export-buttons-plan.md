# 修复导出按钮功能计划

## 问题分析

1. **浏览器环境**：`exportMarkdown()` 和 `exportPDF()` 都只调用 `copyToClipboard()`，没有触发文件下载
2. **Tauri 环境**：动态 `import()` 可能静默失败，且 `catch {}` 空块吞掉所有错误
3. **用户期望**：
   - 浏览器：点击按钮直接下载文件到默认下载目录
   - Tauri 桌面端：弹出系统保存对话框选择位置

## 修改文件

### `src/components/ReportDialog.vue`

#### 1. 修复 Markdown 导出

**之前**：
- 非 Tauri → 复制到剪贴板
- Tauri → 动态 `import("@tauri-apps/plugin-dialog")` + `writeTextFile`

**之后**：
- 非 Tauri（浏览器）→ 创建 Blob → `<a>` download → click → revoke（直接触发下载）
- Tauri → 使用顶层静态 `import { save }` + `import { writeTextFile }`（避免动态 import 失败），弹出系统保存对话框

#### 2. 修复 PDF 导出

**之前**：
- 非 Tauri → 复制到剪贴板
- Tauri → 动态 import + `writeFile`

**之后**：
- 非 Tauri（浏览器）→ `doc.save("doit-日报-20260530.pdf")`（jsPDF 原生方法，触发浏览器下载）
- Tauri → `doc.output("arraybuffer")` + 静态 import 的 `save` + `writeFile`，弹出系统保存对话框

#### 3. Tauri 相关 import 改为顶层静态导入

**之前**：
```ts
const { save } = await import("@tauri-apps/plugin-dialog")
const { writeTextFile } = await import("@tauri-apps/plugin-fs")
```

**之后**：
```ts
import { save } from "@tauri-apps/plugin-dialog"
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs"
```

注意：这些 import 只在 `isTauri` 为 true 时才会被调用，Vite tree-shaking 会处理。

#### 4. 添加错误处理

将空的 `catch {}` 改为 `catch (e) { console.error(e) }`，方便调试。

## 实现细节

### exportMarkdown 新逻辑
```ts
async function exportMarkdown() {
  const filename = `doit-${reportType === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.md`
  const content = reportText.value

  if (isTauri) {
    try {
      const filePath = await save({ defaultPath: filename, filters: [{ name: "Markdown", extensions: ["md"] }] })
      if (!filePath) return
      await writeTextFile(filePath, content)
    } catch (e) { console.error(e) }
    return
  }

  // Browser: trigger download
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### exportPDF 新逻辑
```ts
async function exportPDF() {
  const filename = `doit-${reportType === "daily" ? "日报" : "周报"}-${dayjs().format("YYYYMMDD")}.pdf`
  const doc = buildPDFDoc() // 提取 PDF 构建逻辑

  if (isTauri) {
    try {
      const pdfBytes = doc.output("arraybuffer")
      const filePath = await save({ defaultPath: filename, filters: [{ name: "PDF", extensions: ["pdf"] }] })
      if (!filePath) return
      await writeFile(filePath, new Uint8Array(pdfBytes as ArrayBuffer))
    } catch (e) { console.error(e) }
    return
  }

  // Browser: use jsPDF native save
  doc.save(filename)
}
```

### 提取 PDF 构建函数
```ts
function buildPDFDoc(): jsPDF {
  const doc = new jsPDF()
  // ... PDF content building (existing code)
  return doc
}
```

## 注意事项

- `@tauri-apps/plugin-dialog` 和 `@tauri-apps/plugin-fs` 已在 `package.json` 中安装
- Tauri 权限配置（`capabilities/default.json`）已包含 `dialog:default`、`fs:default` 和 `fs:scope: **`
- Rust 后端已注册 `.plugin(tauri_plugin_dialog::init())` 和 `.plugin(tauri_plugin_fs::init())`