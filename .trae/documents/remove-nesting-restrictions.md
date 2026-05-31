# 放开层级限制

## 问题

之前添加的 `onMove` 限制和 `isSubTask` 条件阻止了：
- 父任务拖拽到其他父任务下（onMove 拦截顶级任务进入嵌套容器）
- 子任务创建子任务（`if (!props.isSubTask)` 隐藏菜单项）
- 深层嵌套渲染（`parentIsSubTask` 阻止任何任务拖入子任务容器）

导致多层嵌套无法展示和操作。

## 方案

撤销之前的限制改动，恢复完整嵌套拖拽能力。NestedTodoList 的递归渲染本身支持任意层级，只是被 `onMove` 拦截了。

## 修改清单

### 1. TodoItem.vue — 移除子任务菜单限制

```typescript
// 修改前
if (!props.isSubTask) {
  items.push({ key: "subtask", ... });
}

// 修改后
items.push({ key: "subtask", ... });
```

### 2. NestedTodoList.vue — 移除拖拽拦截

移除以下内容：
- `isRoot?: boolean` prop
- `parentIsSubTask?: boolean` prop
- `onMove` 函数
- `@move="onMove"` 事件绑定
- `data-is-top-level` 属性
- 递归调用中的 `:is-root="false"` 和 `:parent-is-sub-task="!!element.parentId"`

恢复到仅有 `group="todos"` 无限制跨层级拖拽。

### 3. TodoList.vue — 移除 isRoot prop

```html
<!-- 修改前 -->
<NestedTodoList v-model="nestedTodos" :is-root="true" ... />

<!-- 修改后 -->
<NestedTodoList v-model="nestedTodos" ... />
```

## 验证

```bash
npm run build
```