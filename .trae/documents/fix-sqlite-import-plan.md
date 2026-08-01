# SQLite 导入功能修复计划

## 问题总结

用户反馈导入 SQLite 数据库功能存在 4 个问题：
1. 导入后数据没有覆盖
2. 两个表（todos, settings）的数据都没有导入成功
3. 没有提示成功信息
4. 没有限制只能选择 SQLite 数据库文件

## 当前状态分析

### Tauri 模式导入流程（[dbService.ts](file:///Users/nbn/workspace/github/doit/src/services/dbService.ts#L156-L184)）

```typescript
// 当前实现（简化）：
1. open dialog（不加 filter 也能选任意文件）
2. readFile 读取选中文件的二进制内容
3. closeDb() 关闭当前 SQLite 连接
4. 用 appConfigDir() + "doit.db" 拼接目标路径
5. writeFile 直接把读取的字节写入目标路径
6. getDb() 重新打开 SQLite 连接
```

### 根因分析

**问题 1 & 2：数据没有覆盖导入**

`closeDb()` 关闭了 tauri-plugin-sql 的连接，但 `getDb()` 内部有缓存检查：

```typescript
// db.ts L3-L4
if (db) return db  // 如果 db 不为 null，直接返回
```

导入流程：`closeDb()` 将 `db` 置为 `null` → `writeFile` 写入新数据 → `getDb()` 重新 `Database.load("sqlite:doit.db")` → 建表 `CREATE TABLE IF NOT EXISTS`，因为表已存在，不覆盖。

根本问题：`writeFile` 写入后，`getDb()` 加载的是新文件，数据应该是有的。但问题可能出在：
1. **`appConfigDir()` 返回的路径末尾可能没有 `/`**，导致 `configDir + "doit.db"` 拼接出错误的路径（如 `/Users/xxx/Library/Application Support/com.example.appdoit.db`），写入到了错误位置，而 `getDb()` 读取的是原来的正确路径。
2. 即使路径正确，`closeDb()` 关闭后，`getDb()` 重新 `Database.load("sqlite:doit.db")` 时，tauri-plugin-sql 可能因为缓存或 WAL 文件残留导致读到的仍是旧数据。

**问题 3：没有提示成功信息**

`handleImportDb()`（[App.vue L696-L703](file:///Users/nbn/workspace/github/doit/src/App.vue#L696-L703)）的 catch 块只 `console.error`，没有给用户任何 UI 反馈。成功时也没有 `message.success()` 提示。

**问题 4：没有限制文件类型**

`open()` 调用设置了 `filters: [{ name: "SQLite Database", extensions: ["db"] }]`，但这个只是建议性的，用户在系统文件选择器中仍然可以选择 "All Files" 从而选择任意文件。

## 解决方案

### 方案：完全重写 Tauri 模式的导入（推荐）

放弃前端直接读写文件的方式，改为调用 Rust 命令 `clean_import_db` 来处理导入。这样可以：

1. **确保路径正确**：Rust 端使用与导出相同的 `db_path()` 函数获取正确的数据库路径
2. **确保数据覆盖**：用 `rusqlite` 直接读取导入文件的内容，用 `INSERT OR REPLACE` 写入当前数据库
3. **正确处理 WAL**：导入时先 checkpoint 再操作
4. **验证数据完整性**：导入完成后验证行数
5. **安全可靠**

### 具体修改

#### 1. [lib.rs](file:///Users/nbn/workspace/github/doit/src-tauri/src/lib.rs) — 新增 `clean_import_db` 命令

```rust
#[tauri::command]
async fn clean_import_db(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    // 1. 验证源文件存在且是有效的 SQLite 数据库
    // 2. 打开源数据库，读取 todos 和 settings 表数据
    // 3. 获取当前应用数据库路径
    // 4. 用 rusqlite 直接打开应用数据库（不通过 tauri-plugin-sql）
    // 5. 清空 todos 和 settings 表
    // 6. 用 INSERT OR REPLACE 逐行插入源数据
    // 7. VACUUM + checkpoint
    // 8. 返回导入的行数统计
}
```

实施细节：
- 使用 `rusqlite::Connection::open` 打开源 db（先尝试 WAL 模式打开，做 checkpoint 合并 WAL 数据）
- 读取源 db 的 todos 和 settings 数据到内存
- 用 `rusqlite::Connection::open` 打开应用 db（同样先 checkpoint）
- `DELETE FROM todos` + `DELETE FROM settings` 清空
- 逐行 `INSERT INTO ... VALUES (...)` 插入
- `VACUUM` + `wal_checkpoint(TRUNCATE)`
- 返回 `"已导入: todos=X条, settings=Y条"`

#### 2. [dbService.ts](file:///Users/nbn/workspace/github/doit/src/services/dbService.ts) — 修改 Tauri 模式导入

```typescript
export async function importDatabase(): Promise<void> {
  const isTauri = !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
  if (isTauri) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const { invoke } = await import("@tauri-apps/api/core")

      const filePath = await open({
        multiple: false,
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      })

      if (!filePath) return

      // 调用 Rust 命令导入
      const result = await invoke<string>("clean_import_db", { sourcePath: filePath })
      console.log("[doit] 导入结果:", result)
      return result
    } catch (e) {
      console.error("Tauri 导入失败", e)
      throw e
    }
  }
  // ... 浏览器模式保持不变 ...
}
```

#### 3. [App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue#L696-L703) — 添加成功提示

```typescript
async function handleImportDb() {
  try {
    const result = await importDatabase();
    todos.value = await getAllTodos();
    settings.value = await getSettings();
    message.success(`导入成功: ${result}`);
  } catch (e) {
    console.error("导入数据库失败", e);
    message.error("导入数据库失败");
  }
}
```

#### 4. [dbService.ts](file:///Users/nbn/workspace/github/doit/src/services/dbService.ts#L156-L237) — 文件类型限制

当前已有 `filters: [{ name: "SQLite Database", extensions: ["db"] }]`，但在系统文件选择器中用户仍可选择"所有文件"。可改进：
- 在 Rust 命令中读取文件前验证文件头是否为 SQLite 格式（`SQLite format 3\x00`）
- 如果不是，返回错误信息

#### 5. [lib.rs](file:///Users/nbn/workspace/github/doit/src-tauri/src/lib.rs) — 注册命令

在 `invoke_handler` 的 `generate_handler![]` 中添加 `clean_import_db`。

## 涉及修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src-tauri/src/lib.rs` | 新增 `clean_import_db` 命令 + 注册到 handler |
| `src/services/dbService.ts` | 修改 `importDatabase()` 中 Tauri 分支的逻辑 |
| `src/App.vue` | 添加 `message.success` / `message.error` 提示 |

## 验证步骤

1. 启动应用，创建一些待办事项
2. 导出数据库（确认导出功能正常）
3. 修改一些数据（增删改）
4. 导入之前导出的数据库
5. 验证：数据恢复到导出时的状态
6. 验证：设置也同步恢复到导出时的状态
7. 验证：导入成功后看到成功提示消息
8. 验证：选择非 `.db` 文件（如 `.txt`）尝试导入，应提示错误
