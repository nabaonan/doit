# 清空本地数据功能 — 实现计划

## 需求描述
在设置弹窗中增加一个"清空本地数据"按钮，点击后弹出确认对话框，确认后清空所有待办事项数据（todos），同时保留设置（settings）不变。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/services/todoService.ts` | 新增 `clearAllTodos()` 函数 |
| `src/components/SettingsDialog.vue` | 新增"清空本地数据"按钮 + 确认弹窗 |
| `src/App.vue` | 新增 `handleClearData()` 事件处理，调用 service 并刷新 todos |

## 实现步骤

### Step 1: todoService.ts — 新增 `clearAllTodos()`

在文件末尾新增导出函数 `clearAllTodos()`：

- **Tauri 模式**：执行 `DELETE FROM todos` SQL 语句
- **浏览器模式**：清除 `localStorage` 中的 `doit_todos` 键

### Step 2: App.vue — 新增 `handleClearData()`

在 `handleSaveSettings` 附近新增 `handleClearData()` 方法：

```ts
async function handleClearData() {
  const { clearAllTodos } = await import("./services/todoService");
  await clearAllTodos();
  todos.value = await getAllTodos();
}
```

将 `handleClearData` 通过 props 或 emit 传递给 SettingsDialog。由于 SettingsDialog 已经通过 `v-model:open` 和 `@save` 与 App.vue 通信，最简洁的方式是让 SettingsDialog 直接 emit 一个 `@clear-data` 事件。

### Step 3: SettingsDialog.vue — 新增 UI

1. 在 `defineEmits` 中新增 `(e: "clear-data"): void`
2. 在模板中，保存/取消按钮上方新增一个"危险操作"区域：
   - 红色警示文字 + "清空本地数据"按钮
   - 点击按钮时弹出 `a-modal` 确认对话框（使用 Ant Design 的 `Modal.confirm` 或内嵌确认）
   - 确认后 emit `clear-data` 事件

### Step 4: App.vue — 绑定事件

在 SettingsDialog 组件上监听 `@clear-data="handleClearData"`。

## 交互流程

```
用户点击"清空本地数据"按钮
  → 弹出确认对话框："确定要清空所有待办数据吗？此操作不可恢复。"
  → 用户确认
  → emit("clear-data")
  → App.vue 调用 clearAllTodos()
  → 刷新 todos.value = []
  → 设置弹窗保持打开状态（或关闭）
```

## 注意事项

- 清空数据后设置弹窗应保持打开（让用户看到操作已完成），或者关闭。这里选择**保持打开**，让用户自行关闭。
- 清空操作只影响 todos，不影响 settings。
- 需要同时处理 Tauri SQLite 和浏览器 localStorage 两种模式。
- 遵循项目规范：不加注释、使用分号、emit 事件名 kebab-case。
