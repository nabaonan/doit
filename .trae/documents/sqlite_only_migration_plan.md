# SQLite 唯一存储迁移方案

## 概述

移除所有 `localStorage` 代码路径，所有数据仅通过 SQLite 存储。应用将只支持 Tauri 环境运行，浏览器模式不再支持数据持久化。

## 当前架构

```
命令                   isTauri    存储方式
──────────────────────────────────────────────
npm run tauri dev       true      SQLite（主存储）
npm run dev (浏览器)    false      localStorage（降级）
npm run tauri build     true      SQLite（主存储）
```

当前 `getDb()` 依赖 `isTauri` 判断：`if (!isTauri) return null`。所有 CRUD 操作在 `getDb()` 返回 `null` 时降级到 localStorage。

## 目标架构

```
命令                   isTauri    存储方式
──────────────────────────────────────────────
npm run tauri dev       true      SQLite（唯一存储）
npm run tauri build     true      SQLite（唯一存储）
```

**纯浏览器 `npm run dev`（无 Tauri WebView）仍会尝试加载 SQLite，但由于 `@tauri-apps/plugin-sql` 不可用，`getDb()` 会抛出异常。这是可接受的——本应用设计为 Tauri 桌面应用，浏览器模式仅用于快速 UI 开发，数据操作应通过 Tauri 开发模式验证。**

```
getDb()
  ├── isTauri=true ──→ SQLite 初始化
  │     ├── 成功 ──→ 返回 db（唯一存储）
  │     └── 失败 ──→ throw Error（不降级）
  └── isTauri=false ──→ throw Error（浏览器不支持）
```

## 修改文件清单

### 1. `src/services/db.ts`

**改动**：
- 移除 `isTauri` 守卫，不再用环境判断决定是否初始化 SQLite
- 失败时抛异常（不再返回 `null` 让调用方降级）

### 2. `src/services/todoService.ts`

**改动**：
- 删除 `STORAGE_KEY = "doit_todos"`
- 删除 `getLocalTodos()` / `saveLocalTodos()` 函数
- `getAllTodos()`：移除 `return sortTodos(getLocalTodos())` 回退
- `addTodo()`：移除 localStorage 回退，SQLite 失败抛异常
- `updateTodo()`：同上
- `deleteTodo()`：同上
- `clearAllTodos()`：同上
- `reorderTodos()`：同上
- `sortTodos()` 函数保留（在 `getAllTodos` 的 SQL 查询中已用 `ORDER BY` 排序，但 `App.vue` 中有调用 `sortTodos(todos.value)` 用于内存排序）

### 3. `src/services/settingsService.ts`

**改动**：
- 删除 `STORAGE_KEY = "doit_settings"`
- 删除 `getLocalSettings()` / `saveLocalSettings()` 函数
- 删除 `defaultSettings`（此对象在 `getSettings` 的 SQLite 回退逻辑中仍有使用，保留作为默认值常量）
- `getSettings()`：精简为只走 SQLite 路径，SQLite 失败时返回 `defaultSettings` 的深拷贝（不需要抛异常，启动时设置表可能为空）
- `saveSettings()`：移除 localStorage 回退

### 4. `src/services/tauriEnv.ts`

**改动**：删除此文件（不再需要 `isTauri` 判断）

## 执行步骤

1. 修改 `db.ts`：移除 `isTauri` 导入和守卫，失败时抛异常
2. 修改 `todoService.ts`：删除所有 localStorage 函数和回退路径
3. 修改 `settingsService.ts`：删除所有 localStorage 函数和回退路径
4. 删除 `tauriEnv.ts`
5. 运行 `npm run build` 验证

## 注意事项

- `settingsService.ts` 中 `defaultSettings` 保留，用于 SQLite `getSettings()` 表为空时返回默认值
- `sortTodos()` 函数保留（`App.vue` 中 `handleToggleComplete` 和 `handleReorder` 调用）
- Rust 侧 `lib.rs` 迁移 SQL 已包含所有列，无需修改

## 验证

1. `npm run build` 通过
2. `npm run tauri dev` 启动后正常读写数据（分类创建、待办 CRUD 均正常）
3. 纯浏览器 `npm run dev` 仍可启动用于 UI 调试，但数据操作不可用（会抛出异常）
