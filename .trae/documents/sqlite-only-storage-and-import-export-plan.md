# 计划：纯 SQLite 存储 + 数据库导入导出

## 概述

将应用从「SQLite + localStorage 双模式」改为「纯 SQLite 存储」，移除所有 localStorage 回退逻辑，并增加数据库文件导入导出功能。

---

## 当前状态分析

### 现有架构

- **todoService.ts**: 所有 CRUD 操作都通过 `isTauri` 守卫判断，Tauri 环境走 SQLite，浏览器环境走 localStorage
- **settingsService.ts**: 同上，双模式存储
- **tauriEnv.ts**: 通过 `window.__TAURI__` 检测运行环境
- **App.vue**: 调用 `initTodos()` / `initSettings()` 初始化，所有 handler 调用 service 后重新 fetch

### 关键依赖

- `@tauri-apps/plugin-sql` (SQLite) — 已安装
- `@tauri-apps/plugin-dialog` (文件对话框) — 已安装
- `@tauri-apps/plugin-fs` (文件读写) — 已安装
- 权限配置中已有 `sql:default`、`dialog:default`、`fs:scope`（`**`）

### 数据库文件位置

SQLite 数据库文件 `doit.db` 由 Tauri 插件管理，位于应用数据目录（AppData 下），用户无法直接访问。

---

## 变更方案

### 1. 移除 localStorage 回退，纯 SQLite 存储

**涉及文件**: `src/services/todoService.ts`, `src/services/settingsService.ts`

**改动内容**:
- 删除所有 `getLocalTodos()` / `saveLocalTodos()` / `getLocalSettings()` / `saveLocalSettings()` 函数
- 删除所有 `isTauri` 守卫判断，所有操作直接走 SQLite
- 删除 `tauriEnv.ts` 的导入和使用
- 简化 `init()` 函数，不再需要 `isTauri` 判断
- 删除 `STORAGE_KEY` 常量

**原因**: 应用是 Tauri 桌面应用，不需要浏览器回退。移除双模式代码可大幅简化逻辑。

### 2. 合并数据库连接，共享同一个 db 实例

**当前问题**: `todoService.ts` 和 `settingsService.ts` 各自维护自己的 `db` 变量，各自调用 `loadDB()`，各自创建表。它们连接的是同一个 `sqlite:doit.db` 文件，但有两个独立连接。

**改动内容**:
- 新建 `src/services/db.ts` 作为共享数据库模块
- 导出 `getDb()` 函数，返回单例数据库连接
- 在 `getDb()` 中执行所有 `CREATE TABLE IF NOT EXISTS` 语句（todos 表 + settings 表）
- `todoService.ts` 和 `settingsService.ts` 都从 `db.ts` 导入 `getDb()`

**原因**: 避免重复连接，统一管理数据库生命周期。

### 3. 新增数据库导入导出功能

**涉及文件**: `src/services/dbService.ts`（新建）

**导出功能**:
- 使用 `@tauri-apps/plugin-dialog` 的 `save()` 弹出保存对话框，默认文件名 `doit-backup-YYYY-MM-DD.db`
- 使用 `@tauri-apps/plugin-fs` 读取数据库文件（二进制），写入到用户选择的路径
- 数据库文件路径通过 `@tauri-apps/plugin-sql` 的 `path` 属性获取，或通过 Tauri 的 `appDataDir` 解析

**导入功能**:
- 使用 `@tauri-apps/plugin-dialog` 的 `open()` 弹出文件选择对话框，过滤 `.db` 文件
- 读取用户选择的文件内容
- 关闭当前数据库连接
- 用导入的文件内容覆盖当前数据库文件
- 重新打开数据库连接
- 返回成功状态

**关键考虑**: SQLite 插件不直接暴露文件路径。需要通过 Tauri 的 `appDataDir` API 获取应用数据目录，然后拼接 `doit.db`。或者使用 `@tauri-apps/plugin-sql` 的 `Database.load()` 返回的 path 信息。

### 4. 在设置界面增加导入导出按钮

**涉及文件**: `src/components/SettingsDialog.vue`, `src/App.vue`

**改动内容**:
- SettingsDialog 增加两个按钮：「导出数据库」和「导入数据库」
- 新增 emit 事件: `@export-db` 和 `@import-db`
- App.vue 增加对应 handler: `handleExportDb()` 和 `handleImportDb()`
- 导入成功后调用 `getAllTodos()` 和 `getSettings()` 刷新所有数据
- 导入/导出前后给出用户反馈（成功/失败提示）

### 5. 清理不再需要的代码

- `src/services/tauriEnv.ts` — 可以保留（可能其他地方引用），但不再被 service 使用
- 删除 `src/services/todoService.ts` 中的 `sortTodos()` 导出（如果只在内部使用）

---

## 具体文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/db.ts` | **新建** | 共享数据库连接模块，单例模式 |
| `src/services/dbService.ts` | **新建** | 导入导出服务 |
| `src/services/todoService.ts` | **修改** | 移除 localStorage 逻辑，使用共享 db |
| `src/services/settingsService.ts` | **修改** | 移除 localStorage 逻辑，使用共享 db |
| `src/components/SettingsDialog.vue` | **修改** | 增加导入导出按钮和事件 |
| `src/App.vue` | **修改** | 增加导入导出 handler |

---

## 假设与决策

1. **不再支持浏览器模式** — 应用是 Tauri 桌面应用，移除 localStorage 回退是合理的
2. **数据库文件路径获取** — 通过 `@tauri-apps/plugin-sql` 的 `Database.load()` 返回的 path 或 `@tauri-apps/api/app` 的 `appDataDir()` 获取
3. **导入时关闭/重启数据库** — 导入需要替换数据库文件，必须关闭当前连接再重新打开
4. **用户反馈** — 使用 `antdv-next` 的 `message` 组件显示成功/失败提示

---

## 验证步骤

1. `npm run build` — 确保类型检查和构建通过
2. `npm run tauri dev` — 启动 Tauri 开发模式，验证：
   - 待办数据正常读写（增删改查）
   - 设置正常读写
   - 导出数据库文件可正常保存
   - 导入数据库文件后数据正确刷新
