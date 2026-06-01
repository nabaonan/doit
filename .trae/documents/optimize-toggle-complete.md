# 优化点击完成时的状态更新

## 问题描述

1. **状态更新延迟**：点击 checkbox 完成待办后，UI 没有立即更新，需要下一次状态变化后才刷新
2. **点击位置错位**：待办完成后移动到列表底部，但 DOM 更新有延迟，导致用户点击原来位置的元素时，实际点击到的是移动后的其他元素

## 根因分析

### 问题 1：状态更新延迟

数据流链路中存在不必要的异步延迟：

```
点击 checkbox
  → @change → onCheckboxClick() → emit("toggle-complete")
    → TodoList.vue onToggleComplete → emit("toggle-complete", id)
      → App.vue handleToggleComplete
        → todo.completed = newCompleted          ✅ 立即更新内存
        → await updateTodo(id, ...)              ✅ 持久化
        → todos.value = [...todos.value]         ✅ 触发响应式
          → TodoList.vue watch props.todos
            → mergeNested(nestedTodos, flatToNested(todos))  ✅ 同步更新
            → setTimeout(() => { flag = false }, 0)           ⚠️ 不必要的延迟
```

`setTimeout(0)` 虽然只有 ~4ms 延迟，但在快速连续点击时，`isProgrammaticUpdate` 标志位管理不当会导致 watch 链中的更新被跳过。

### 问题 2：点击位置错位

当 `todos.value = [...todos.value]` 触发重新渲染时，Vue 的异步渲染机制（`nextTick`）导致 DOM 更新滞后于用户的下一次点击。用户点击旧 DOM 位置时，该位置可能已被新的元素占据。

## 修改方案

### 修改 1：App.vue — 移除 `handleToggleComplete` 中的 `await`

当前 `handleToggleComplete` 使用 `await updateTodo(...)` 等待存储写入完成才触发 UI 更新。改为先触发 UI 更新再异步写入存储。

**变更**：
- 先更新内存 `todos.value = [...todos.value]` 触发 UI 立即刷新
- 再 `await updateTodo(...)` 异步持久化
- `syncParentCompletion` 同理

### 修改 2：TodoList.vue — 移除 `setTimeout(0)`

将 `setTimeout(() => { isProgrammaticUpdate = false }, 0)` 改为 `nextTick(() => { isProgrammaticUpdate = false })`，确保标志位在下一个微任务（Vue 渲染完成后）立即重置，减少不必要的延迟窗口。

### 修改 3：TodoItem.vue — checkbox 使用 `@click.stop` 替代 `@change`

当前 checkbox 使用 `@change` 事件，该事件在 ant-design 中可能延迟触发。改用 `@click` 事件直接触发 toggle，配合 `@mousedown.stop` 防止 SortableJS 拦截。

### 修改 4：App.vue — `handleToggleComplete` 中先排序再触发更新

在 `todos.value = [...todos.value]` 之前，先对 `todos.value` 进行排序（已完成项排到末尾），确保 DOM 位置在渲染前就已确定，减少 FLIP 动画导致的视觉错位。

## 修改清单

| 文件 | 修改内容 |
|------|---------|
| `src/App.vue` | `handleToggleComplete` 先更新 UI 再异步持久化；`syncParentCompletion` 同理 |
| `src/components/TodoList.vue` | `setTimeout(0)` → `nextTick()` |
| `src/components/TodoItem.vue` | checkbox `@change` → `@click` |

## 验证

```bash
npm run build
```
