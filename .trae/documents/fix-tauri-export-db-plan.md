# 计划：修复 Tauri 客户端导出 SQLite 数据库文件

## 概述

用户在 Windows Tauri 客户端中点击"导出数据库"时，仍然导出的是 JSON 文件而不是 `.db` 文件。原因是 `isTauri` 检测失败导致代码走了浏览器分支。

---

## 当前状态分析

### 问题根因

`src/services/tauriEnv.ts` 中的检测方式：
```typescript
export const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
```

在 Tauri v2 中，`window.__TAURI__` 默认**不注入**到全局作用域。需要通过 `@tauri-apps/api` 的 import 来访问 Tauri API。`withGlobalTauri` 配置项未在 `tauri.conf.json` 中设置，所以 `window.__TAURI__` 为 `undefined`，`isTauri` 始终为 `false`。

### 影响范围

- `dbService.ts` 中的 `exportDatabase()` 和 `importDatabase()` 因为 `isTauri` 为 `false`，始终走浏览器 JSON 分支
- `ReportDialog.vue` 中的 Tauri 特定导出功能也可能受影响

### 现有依赖

- `@tauri-apps/plugin-sql` — 已安装并配置
- `@tauri-apps/plugin-dialog` — 已安装并配置
- `@tauri-apps/plugin-fs` — 已安装并配置
- `src-tauri/capabilities/default.json` 中已有 `sql:default`、`dialog:default`、`fs:scope` 权限

---

## 变更方案

### 方案：改进 `isTauri` 检测方式

将 `isTauri` 从静态的 `window.__TAURI__` 检测改为动态检测，通过尝试 import Tauri API 来判断是否在 Tauri 环境中。

**涉及文件**: `src/services/tauriEnv.ts`

**改动内容**:
- 将 `isTauri` 改为异步函数 `checkIsTauri()`，通过 `dynamic import()` 尝试加载 `@tauri-apps/plugin-sql` 来判断
- 或者更简单：保留同步检测，但增加对 `window.__TAURI__` 的备用检测路径
- 实际上最可靠的方案是：在 `dbService.ts` 中直接 try-catch import Tauri API，而不是依赖 `isTauri`

### 具体实现

**方案 A（推荐）**: 修改 `dbService.ts`，不依赖 `isTauri`，而是直接 try-catch 动态 import Tauri API：

```typescript
export async function exportDatabase(): Promise<void> {
  try {
    const { appConfigDir } = await import("@tauri-apps/api/path")
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { copyFile } = await import("@tauri-apps/plugin-fs")
    // ... Tauri 导出逻辑
    return
  } catch {
    // 非 Tauri 环境，走浏览器 JSON 导出
  }
  // ... 浏览器导出逻辑
}
```

**方案 B**: 在 `tauri.conf.json` 中设置 `"withGlobalTauri": true`，让 `window.__TAURI__` 可用。

方案 A 更可靠，因为即使 `withGlobalTauri` 未设置，动态 import 也能正确检测 Tauri 环境。

---

## 具体文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/dbService.ts` | **修改** | 导出/导入函数改用 try-catch 检测 Tauri 环境，而非依赖 `isTauri` |

---

## 验证步骤

1. `npm run build` — 确保类型检查和构建通过
2. 在浏览器中运行 `npm run dev`，点击导出 → 应下载 JSON 文件
3. 在 Tauri 中运行 `npm run tauri dev`，点击导出 → 应弹出系统保存对话框，保存 `.db` 文件
