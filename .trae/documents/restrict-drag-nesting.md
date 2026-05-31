# 拖拽嵌套限制

## 需求

1. **父任务不允许拖拽到其他父任务下** — 顶级任务不能通过拖拽变成其他任务的子任务
2. **子任务不能再添加子任务** — 还原单层嵌套限制，仅顶级任务可以有子任务

## 限制逻辑

```
允许的拖拽：
  顶级 A ──────────────→ 顶级列表其他位置 ✅
  子任务 a1 ───────────→ 同父任务下的其他位置 ✅
  子任务 a1 ───────────→ 另一个父任务 B 下 ✅（变成 B 的子任务）
  子任务 a1 ───────────→ 顶级列表 ✅（变成顶级任务）

禁止的拖拽：
  顶级 A ──────────────→ 任何嵌套容器 ❌
  任何任务 ────────────→ 子任务下的容器 ❌（子任务本身无子任务）
```

## 修改清单

### 1. TodoItem.vue — 还原右键菜单限制

恢复 `if (!props.isSubTask)` 条件，子任务不再显示"子任务"菜单项。

### 2. NestedTodoList.vue — 添加拖拽限制

新增两个 prop：
- `isRoot?: boolean` — 标识是否为顶级容器（TodoList.vue 传入 `true`）
- `parentIsSubTask?: boolean` — 标识当前容器的父级是否为子任务

在模板中给每条目添加 `data-is-top-level` 属性用于识别顶级任务。

新增 `onMove` 回调：
```typescript
function onMove(evt: { dragged: HTMLElement; from: HTMLElement; to: HTMLElement }) {
  if (parentIsSubTask) return false
  if (!isRoot) {
    const isTopLevel = evt.dragged.dataset.isTopLevel === "true"
    if (isTopLevel) return false
  }
}
```

递归调用时传递 `:is-root="false"` 和 `:parent-is-sub-task="!!element.parentId"`。

### 3. TodoList.vue — 传入 isRoot

```html
<NestedTodoList
  v-model="nestedTodos"
  :is-root="true"
  ...
/>
```

## 验证

```bash
npm run build
```