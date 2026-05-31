# 嵌套拖拽 Bug 修复计划

## Bug 1: 从底部向顶部拖拽失败

### 根因

外层容器 `<div class="flex-1 overflow-y-auto">` 与 VueDraggable 之间存在中间 `<div class="flex flex-col">` 包裹层，导致 SortableJS 在 `force-fallback` 模式下无法正确识别可滚动祖先，自动滚动失效。

### 修复

**NestedTodoList.vue**：在 `<VueDraggable>` 上添加 `bubble-scroll` 和 `scroll-sensitivity` 属性：

```html
<VueDraggable
  v-model="list"
  group="todos"
  :animation="200"
  ghost-class="opacity-50"
  :force-fallback="true"
  :bubble-scroll="true"
  :scroll-sensitivity="100"
  :scroll-speed="20"
>
```

`bubble-scroll` 让 SortableJS 向上查找所有可滚动祖先，`scroll-sensitivity` 扩大边缘触发区域。

---

## Bug 2: 放开子任务层级限制

### 根因

[TodoItem.vue L110](file:///c:/Users/nbn/workspace/github/doit/src/components/TodoItem.vue#L110)：`if (!props.isSubTask)` 阻止了子任务创建孙任务，强制限制为最多 2 层。

### 修复

**TodoItem.vue**：移除 `!props.isSubTask` 条件，允许任意层级创建子任务：

```typescript
// 修改前
if (!props.isSubTask) {
  items.push({
    key: "subtask",
    label: "子任务",
    icon: h(PlusOutlined),
    disabled: props.todo.completed,
  });
}

// 修改后
items.push({
  key: "subtask",
  label: "子任务",
  icon: h(PlusOutlined),
  disabled: props.todo.completed,
});
```

---

## Bug 3: 父任务拖拽到其他父任务下时，嵌套子任务不显示

### 根因

`flatToNested()` 每次创建全新的 `TodoItemNode` 对象引用。当父任务被拖到另一个父任务下时，整个树结构被重建，旧的 `element.children` 引用被替换。VueDraggable 的 `v-model` 绑定在递归组件中依赖响应式对象的同一性，引用替换可能导致子级 `NestedTodoList` 组件被销毁重建。

### 修复

**TodoList.vue**：在 `flatToNested` 的 watch 中，不直接替换整个 `nestedTodos`，而是使用深度合并策略：只更新变化的字段，保持对象引用稳定。

改用 `watch` 配合手动 diff 而非全量替换：

```typescript
watch(
  () => props.todos,
  (todos) => {
    isProgrammaticUpdate = true;
    const newNested = flatToNested(todos);
    mergeNested(nestedTodos.value, newNested);
    setTimeout(() => {
      isProgrammaticUpdate = false;
    }, 0);
  },
  { deep: true, immediate: true }
);
```

新增 `mergeNested` 函数，递归合并节点，只更新 `content`、`completed` 等字段，保留 `children` 数组引用和 `id` 不变的节点。

---

## Bug 4: 勾选子任务后父任务完成状态延迟（严重 Bug）

### 根因

[App.vue handleToggleComplete](file:///c:/Users/nbn/workspace/github/doit/src/App.vue#L138-L153)：

```typescript
await updateTodo(id, { completed: !todo.completed, ... });  // 写入存储
if (todo.parentId) {
  await syncParentCompletion(todo.parentId);  // 从过期内存读取！
}
todos.value = await getAllTodos();  // 刷新
```

`syncParentCompletion` 从 `todos.value` 读取子任务状态，但 `todos.value` 在上一步 `updateTodo` 后**未更新内存**，仍持有旧值。导致 `allCompleted` 计算永远为错。

### 修复

**App.vue**：在调用 `syncParentCompletion` 之前，先更新内存中的 `todos.value`：

```typescript
async function handleToggleComplete(id: string) {
  const todo = todos.value.find((t) => t.id === id);
  if (!todo) return;
  if (todo.parentId === null) {
    const hasChildren = todos.value.some((t) => t.parentId === id);
    if (hasChildren) return;
  }
  const newCompleted = !todo.completed;
  todo.completed = newCompleted;  // 立即更新内存
  todo.completedAt = newCompleted ? new Date().toISOString() : null;
  await updateTodo(id, {
    completed: newCompleted,
    completedAt: todo.completedAt,
  });
  if (todo.parentId) {
    await syncParentCompletion(todo.parentId);
  }
  // 不再需要 getAllTodos()，直接触发深层 watch 即可
  todos.value = [...todos.value];  // 触发响应式更新
}
```

同时 `syncParentCompletion` 也需同步更新内存：

```typescript
async function syncParentCompletion(parentId: string) {
  const children = todos.value.filter((t) => t.parentId === parentId);
  if (children.length === 0) return;
  const allCompleted = children.every((c) => c.completed);
  const parent = todos.value.find((t) => t.id === parentId);
  if (parent && parent.completed !== allCompleted) {
    parent.completed = allCompleted;  // 立即更新内存
    parent.completedAt = allCompleted ? new Date().toISOString() : null;
    await updateTodo(parentId, {
      completed: allCompleted,
      completedAt: parent.completedAt,
    });
  }
}
```

---

## 修改清单

| 文件 | 修改内容 |
|------|---------|
| `NestedTodoList.vue` | 添加 `bubble-scroll` / `scroll-sensitivity` / `scroll-speed` 属性 |
| `TodoItem.vue` | 移除 `!props.isSubTask` 条件，放开层级限制 |
| `TodoList.vue` | `flatToNested` watch 改用 `mergeNested` 保持对象引用稳定 |
| `App.vue` | `handleToggleComplete` 和 `syncParentCompletion` 先更新内存再写存储 |

## 验证

```bash
npm run build
```