# 修复排序问题和添加快捷键适配

## 当前状态分析

### 问题 1：导入后添加子任务，已完成项跑到最上方

**根因：** `db.ts` 的 localStorage 降级模式 (`createLocalDb`) 中，`select` 方法直接返回 localStorage 中存储的原始数组，完全忽略了 SQL 中的 `ORDER BY completed ASC, sort_order ASC` 子句。

- `getAllTodos()` (todoService.ts:40) 传给 `db.select()` 的 SQL 是 `"SELECT * FROM todos ORDER BY completed ASC, sort_order ASC"`
- 但 localStorage 的 `select` 实现 (db.ts:94-112) 只是 `JSON.parse(localStorage.getItem(TODO_KEY))`，不做任何排序
- `addTodo` 在 localStorage 模式下返回 `true`（因为 `createLocalDb` 的 `execute` 成功写入），所以 `handleAddSubTodo` 不会走 `sortTodos` 降级路径
- 结果：`getAllTodos()` 返回的数组是 localStorage 中的原始插入顺序，没有排序

具体流程：
1. 导入后：localStorage 中存储的是导入时的原始顺序（DB 中的行顺序），可能碰巧看起来正确
2. 添加子任务后：`addTodo` 将新项 push 到 localStorage 数组末尾
3. `getAllTodos()` 返回数组——新项在末尾，整体未排序
4. 由于未排序，`flatToNested` 按数组顺序分组，已完成项可能出现在未完成项上方

**修复方案：** 在 `getAllTodos` 函数中，无论是 Tauri SQLite 模式还是 localStorage 模式，返回前都调用 `sortTodos` 确保全局排序正确。

### 问题 2：添加快捷键未应用到添加子任务

当前快捷键 (`addTodoShortcut`) 仅在两个输入框上有监听：
- `TodoList.vue` 顶部的新建待办输入框 (`onInputKeydown`) — **已有**
- `TodoItem.vue` 的内联编辑输入框 (`onKeydown`) — **已有**

缺少：在编辑模式下按快捷键应能保存并创建子任务。目前子任务创建流程是：右键菜单 → "子任务" → 创建空内容条目 → 自动进入编辑模式。编辑模式下按快捷键应该保存编辑内容。

### 问题 3：添加上级任务快捷键

顶部的新建待办输入框已经支持快捷键。用户要求的"最上的添加父级任务"就是指这个输入框，**功能已经存在**。无需额外修改。

## 修改方案

### 文件 1：`src/services/todoService.ts`

**修改：** `getAllTodos` 函数，在返回前始终应用 `sortTodos` 排序。

```typescript
// 修改前
return rows.map(...)

// 修改后
const items = rows.map(...)
return sortTodos(items)
```

这样无论是 Tauri SQLite 模式还是 localStorage 模式，`getAllTodos()` 始终返回排序后的结果。所有调用 `getAllTodos` 的地方（handleAddTodo, handleAddSubTodo, handleToggleComplete, handleReorder, handleDeleteTodo, handleImportDb, handleRestoreBackup）都会自动获得正确的排序。

### 文件 2：`src/components/TodoItem.vue`

**修改：** `onKeydown` 函数中，快捷键除了保存编辑外，还应该能触发创建子任务。当前逻辑已经能保存编辑——当一个空内容条目进入编辑模式（即新建子任务），按快捷键会保存空内容，导致触发 `saveEdit` 中的删除逻辑。

实际上，当前的 `onKeydown` 逻辑在编辑模式下按快捷键会调用 `onSave`，`onSave` 会调用 `emit("save-edit", trimmed)`，在 `TodoList.vue` 的 `saveEdit` 中：
- 如果 `content.trim() === ""` → `emit("delete-todo", id)` 删除
- 否则 → `emit("update-todo", id, content)` 更新内容

对于从右键菜单创建的子任务（content 为空字符串进入编辑模式），按快捷键保存时 content 为空，会被删除——**这是不合理的行为**。

**修复：** 当编辑内容为空且条目有 parentId（子任务），按快捷键不删除，而是直接保存空内容（保持创建时状态），让用户后续继续编辑。

实际上更自然的做法是：在编辑模式下按快捷键应该**不做特殊处理**，直接使用已有的 Enter 行为。但快捷键逻辑和 Enter 逻辑目前是分开的。

我们只需保持现状：快捷键在编辑模式下等同于"保存并退出编辑"。对于空内容子任务，`saveEdit` 中已有删除逻辑（空内容删除），但这不太合理——用户刚刚创建子任务还没来得及输入内容就按快捷键，不应该删除。

**改为：** 在 `TodoList.vue` 的 `saveEdit` 中，对于有 parentId 的空内容条目不删除，只清除编辑状态。

### 文件 3：`src/components/TodoList.vue`

**修改：** `saveEdit` 函数，当内容为空且条目是子任务时，不清除条目，仅退出编辑模式。

## 不需要的修改

- 顶部输入框的快捷键支持已经存在（`onInputKeydown`）
- `NestedTodoList.vue` 无需修改
- `App.vue` 无需修改

## 涉及的完整文件列表

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/services/todoService.ts` | 修改 | `getAllTodos` 返回前调用 `sortTodos` |
| `src/components/TodoItem.vue` | 无需修改 | 已有快捷键支持 |
| `src/components/TodoList.vue` | 修改 | `saveEdit` 对空内容子任务不删除 |

## 验证步骤

1. `npm run build` 确保类型检查通过
2. 浏览器模式测试：
   - 导入包含已完成项的数据
   - 添加子任务
   - 确认已完成项在底部
3. 测试快捷键：
   - 在设置中设置快捷键
   - 在顶部输入框，按快捷键应创建待办
   - 右键创建子任务，进入编辑模式，输入内容后按快捷键应保存
