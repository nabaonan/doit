# 重构导入功能：修复 Tauri 模式下未正确写入 SQLite 的问题

## 摘要

当前 `importDatabase()` 的 Tauri 模式通过 `closeDb()` → `writeFile(覆盖 .db)` → `getDb()` 来"写入"SQLite，但这个流程存在一个严重缺陷：**只覆盖了** **`.db`** **主文件，没有删除残留的** **`.db-wal`** **和** **`.db-shm`** **文件**。SQLite 的 WAL（Write-Ahead Log）模式会在关闭后遗留 WAL 文件，这些残留文件中的数据会在下次打开时被合并，从而**覆盖掉新写入的数据库内容**。

参考同步的**恢复（restore）功能** —— `download_db_from_webdav` Rust 命令正确地处理了 WAL 文件残留：它会先**删除** **`.db`、`.db-wal`、`.db-shm`** **三个文件**，再将临时文件重命名为 `.db`。

## 当前状态分析

### 导入功能 Tauri 模式 (`src/services/dbService.ts:158-185`)

```typescript
const data = await readFile(filePath as string)  // 读取选择的 .db 文件
await closeDb()                                   // 关闭当前 SQLite 连接（可能残留 WAL）
const configDir = await appConfigDir()
const dbPath = `${configDir}doit.db`
await writeFile(dbPath, data)                     // 只覆盖 doit.db
await getDb()                                     // 重新打开 → WAL 数据合并进来，污染数据
```

**问题**：`writeFile()` 只覆盖了 `doit.db`，但同目录下可能还存在 `doit.db-wal` 和 `doit.db-shm` 文件。当 `getDb()` 重新打开数据库时，**SQLite 会检查 WAL 文件并将其中的数据合并到主文件**。由于 WAL 文件是旧数据库的写入日志，合并后旧数据会覆盖新导入的数据，导致导入似乎没有生效。

### 恢复功能 (`src-tauri/src/lib.rs:452-508`, `download_db_from_webdav`)

```rust
// 1. 下载到临时文件
std::fs::write(&temp_path, &bytes)?;

// 2. 删除原 db + wal + shm（关键步骤！）
let _ = std::fs::remove_file(&db);                           // 删除 doit.db
let _ = std::fs::remove_file(db.with_extension("db-wal"));   // 删除 doit.db-wal
let _ = std::fs::remove_file(db.with_extension("db-shm"));   // 删除 doit.db-shm

// 3. 重命名临时文件为 db
std::fs::rename(&temp_path, &db)?;
```

**关键区别**：恢复了不仅覆盖 `.db` 文件，还**明确删除了 WAL 和 SHM 文件**，然后通过重命名确保原子替换。

## 根因总结

| 操作                        | `.db`   | `.db-wal` | `.db-shm` | 结果              |
| ------------------------- | ------- | --------- | --------- | --------------- |
| `importDatabase()`        | 覆盖 ✅    | **未删除 ❌** | **未删除 ❌** | 旧 WAL 数据污染新导入数据 |
| `download_db_from_webdav` | 重命名替换 ✅ | 删除 ✅      | 删除 ✅      | 纯正的新数据          |

## 变更方案

### 唯一修改：`src/services/dbService.ts`

在 `importDatabase()` 的 Tauri 分支中，`closeDb()` 之后、`writeFile()` 之前，**先删除残留的** **`.db-wal`** **和** **`.db-shm`** **文件**。

修改后的 Tauri 分支流程：

```typescript
await closeDb()

const configDir = await appConfigDir()
const dbPath = `${configDir}doit.db`

// 删除残留的 WAL/SHM 文件，防止旧数据污染新导入的数据库
try {
  await removeFile(`${configDir}doit.db-wal`);
  await removeFile(`${configDir}doit.db-shm`);
} catch { /* 文件不存在，忽略 */ }

await writeFile(dbPath, data)
await getDb()
```

需要从 `@tauri-apps/plugin-fs` import `removeFile`（该模块已经 import 了 `readFile` 和 `writeFile`，只需增加 `removeFile`）。

### 无需修改的文件

* `src/App.vue` — `handleImportDb()` 后续的 `getAllTodos()`/`getSettings()` 调用无需修改

* `src/services/autoSyncService.ts` — 不涉及

* `src-tauri/src/lib.rs` — 不涉及（在 Rust 侧修复也是可以的，但 JS 侧更简单直接）

## 验证步骤

1. **Tauri 模式导入验证**：

   * 准备一个有 WAL 残留的数据库（正常的 Tauri 使用后会产生 WAL）

   * 用导入功能导入另一个不同数据的 `.db` 文件

   * 确认页面显示的是导入的新数据，而不是旧数据 + WAL 污染的数据

2. **回归验证**：

   * 确认同步/恢复功能不受影响

   * 确认正常 CRUD 操作不受影响

