# 分类下拉菜单显示修复方案

## 问题描述

在本地构建安装包 (`npm run tauri build`) 并安装后，新创建的分类不会显示在顶部栏的分类下拉菜单中。但通过 `npm run dev` 浏览器开发模式运行是正常的。

## 根因分析

### 关键差异：dev 模式 vs 打包模式

| 环节 | `npm run dev` (浏览器) | 打包 Tauri 应用 |
|------|----------------------|----------------|
| `isTauri` | `false` | `true` |
| `getDb()` | 返回 `null` | 尝试加载 `@tauri-apps/plugin-sql` |
| 数据存储 | localStorage | SQLite |
| `saveSettings` | `saveLocalSettings()` | SQLite INSERT |
| `getSettings` | `getLocalSettings()` | SQLite SELECT |

### 根本原因

在打包的 Tauri 应用中，`saveSettings()` 调用 SQLite INSERT 时，如果 `@tauri-apps/plugin-sql` 动态导入失败或者 SQL 执行失败，会抛出异常。`handleSaveCategories` 的 `catch` 块会调用 `settings.value = await getSettings()` 尝试从存储恢复。

但问题在于：**`getDb()` 没有 `try/catch`**。如果动态导入 `@tauri-apps/plugin-sql` 失败或 SQLite `Database.load()` 失败，`getDb()` 会抛出未捕获的异常。

异常传播链：
```
handleSaveCategories → saveSettings → getDb() → import("@tauri-apps/plugin-sql").default 失败 → throw
                    → catch: settings.value = await getSettings() → getDb() 再次失败 → throw
                    → 未捕获的 Promise 异常
```

由于 `catch` 块内 `getSettings()` 也调用了 `getDb()` 且同样抛出异常，导致整个 `handleSaveCategories` 的异常无法被处理，`showCategoryDialog.value = false` 之后的 Vue 更新周期可能中断，导致 `settings.value.categories = categories` 的更新虽然已执行（在前面的代码行），但 Vue 的响应式系统可能因异常进入不一致状态。

更具体地说，在 Tauri 2 的打包环境中，`window.__TAURI__` 存在（所以 `isTauri = true`），但 `@tauri-apps/plugin-sql` 的模块加载可能因打包后的资源路径解析问题而失败。

### 次要问题

Rust 侧 `lib.rs` 中的迁移 SQL (`lib.rs` 第 12-26 行)定义的 `todos` 表缺少 `tag_id`、`cat_id`、`parent_id` 列，但 JS 侧 `getDb()` 的 `CREATE TABLE IF NOT EXISTS` 包含这些列。由于迁移先运行，表已创建，JS 侧无法添加缺失的列。这会影响子任务和分类关联功能。

## 修改方案

### 1. `src/services/db.ts` — 为 `getDb()` 添加 try/catch

**现状**：`getDb()` 没有异常处理，动态导入和 `Database.load()` 失败时直接抛异常。

**修改**：用 `try/catch` 包裹动态导入和 SQLite 初始化代码段。失败时返回 `null`，让调用方优雅回退到 localStorage。

```typescript
export async function getDb() {
  if (!isTauri) return null
  if (db) return db
  try {
    const Database = (await import("@tauri-apps/plugin-sql")).default
    db = await Database.load("sqlite:doit.db")
    // ... 建表语句
    return db
  } catch {
    console.warn("SQLite 初始化失败，回退到 localStorage")
    return null
  }
}
```

### 2. `src-tauri/src/lib.rs` — 同步 `todos` 表列定义

**现状**：Rust 迁移 SQL 定义的 `todos` 表缺少 `tag_id`、`cat_id`、`parent_id`。

**修改**：在 Rust 迁移 SQL 中添加缺失的三列，与 JS 侧保持一致。

```rust
// 添加:
// tag_id TEXT,
// cat_id TEXT,
// parent_id TEXT
```

### 3. `src/App.vue` — 优化 `handleSaveCategories` 异常处理

**现状**：`catch` 块调用 `getSettings()` 可能再次失败。

**修改**：在 `catch` 块外层也加 try/catch，确保即使回退也失败，界面状态仍能正常工作。

### 4. `src/services/settingsService.ts` — 增强 saveSettings 健壮性

**现状**：SQLite 模式下的 `saveSettings` 依次执行 DELETE + 多个 INSERT，任何一个失败都会中断。

**修改**：用 `try/catch` 包裹 SQLite 写入操作，失败时自动回退到 `saveLocalSettings`。

## 验证步骤

1. 执行 `npm run build` 确认类型检查和构建通过
2. 执行 `npm run tauri build` 打包安装包
3. 安装后运行应用，创建新分类，确认出现在下拉菜单中
4. 重启应用，确认分类数据持久化正常
