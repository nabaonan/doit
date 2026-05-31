# 父任务拖拽时子任务跟随

## 问题

当前拖拽父任务时，子任务不会跟随移动，而是留在原地。拖拽结束后，`onDragEnd` 会将子任务错误地分配到新位置的父任务下。

## 方案

采用拖拽结束后自动归组策略：在 `onDragEnd` 中检测到拖拽的是父任务时，**重新归组所有父任务与其子任务**（而非仅归组被拖拽父任务的子任务）。

## 为什么需要全量归组

假设列表 `[A, a1, a2, B, b1, b2]`，拖拽 B 到 A 和 a1 之间：

| 步骤 | 列表状态 |
|------|----------|
| SortableJS 完成 | `[A, B, a1, a2, b1, b2]` |
| 仅归组 B 的子任务 | `[A, B, b1, b2, a1, a2]` |
| parentIdChanges 扫描 | a1, a2 被**错误地**分配到 B 下 ❌ |

**原因**：`parentIdChanges` 逻辑按"最近上方父任务"来分配子任务，a1/a2 上方最近的是 B 而非 A。

**解决**：归组**所有**父任务的子任务，确保每个父任务后紧跟其子任务，`parentIdChanges` 扫描将找不到任何不匹配。

| 步骤 | 列表状态 |
|------|----------|
| SortableJS 完成 | `[A, B, a1, a2, b1, b2]` |
| 全量归组 | `[A, a1, a2, B, b1, b2]` |
| parentIdChanges 扫描 | 无变化 ✅ |

全量归组保留父任务间的相对顺序（A 在 B 前），并将各自子任务归到各自父任务下。

## 修改范围

仅修改 `src/components/TodoList.vue` 的 `<script setup>` 部分。

## 已实现（v1）

- 新增 `draggedItemId` ref
- `onDragStart` 记录被拖拽条目 ID

## 待实现（v2 优化）

### 修改 `onDragEnd` 归组逻辑

将现有的"仅归组被拖拽父任务的子任务"替换为"全量归组所有父任务"：

```typescript
function onDragEnd() {
  isDragging.value = false;

  if (draggedItemId.value) {
    const draggedItem = draggableList.value.find((t) => t.id === draggedItemId.value);
    if (draggedItem && !draggedItem.parentId) {
      const childMap = new Map<string, TodoItemType[]>();
      for (const item of draggableList.value) {
        if (item.parentId) {
          const list = childMap.get(item.parentId) || [];
          list.push(item);
          childMap.set(item.parentId, list);
        }
      }
      const result: TodoItemType[] = [];
      const seen = new Set<string>();
      for (const item of draggableList.value) {
        if (seen.has(item.id)) continue;
        if (!item.parentId) {
          result.push(item);
          seen.add(item.id);
          const children = childMap.get(item.id) || [];
          for (const child of children) {
            result.push(child);
            seen.add(child.id);
          }
        }
      }
      draggableList.value = result;
    }
  }
  draggedItemId.value = null;

  // 以下 parentIdChanges 逻辑保持不变
  const parentIdChanges: Record<string, string | null> = {};
  let currentParentId: string | null = null;
  // ...
}
```

### 类型检查与构建验证

```bash
npm run build
```

### 手动测试

- 父任务 A（有子任务 a1, a2）+ 父任务 B（有子任务 b1, b2）→ 拖拽 B 到 A 和 a1 之间 → a1, a2 仍归属 A，b1, b2 仍归属 B
- 父任务拖拽 → 子任务跟随
- 子任务单独拖到另一个父任务下
- FLIP 动画、勾选完成、删除等现有功能