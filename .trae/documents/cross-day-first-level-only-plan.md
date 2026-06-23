# 跨天自动完成逻辑优化：只按第一级任务状态判断

## 概述

优化 `src/App.vue` 中的 `activeTodos` / `completedTodos` 过滤逻辑，使"跨天"行为只依据第一级任务的状态来决定是否移动到「按时间查看」视图，避免父任务尚未全部完成时，已完成的子任务被提前转移到时间视图。

---

## 当前状态分析

### 现有逻辑 (`src/App.vue` 第 114-136 行)

```typescript
const todayStr = computed(() => dayjs().format("YYYY-MM-DD"));

function toLocalDateStr(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const activeTodos = computed(() => {
  let filtered = todos.value.filter((t) => !t.completed || (t.completedAt && toLocalDateStr(t.completedAt) === todayStr.value));
  if (selectedCatId.value === "__none__") {
    filtered = filtered.filter((t) => t.catId === null);
  } else {
    filtered = filtered.filter((t) => t.catId === selectedCatId.value);
  }
  return filtered;
});

const completedTodos = computed(() =>
  todos.value.filter((t) => t.completed && t.completedAt && toLocalDateStr(t.completedAt) !== todayStr.value)
);
```

### 问题

`completedTodos` 是基于每条记录自身的 `completedAt` 独立判断的，**不感知父子层级**。

典型错误场景：

| 父任务 | 子任务 A | 子任务 B | 子任务 C | 当前行为 | 期望行为 |
|--------|---------|---------|---------|---------|---------|
| 未完成（仅 B、C 待办） | 昨天已完成 | 未完成 | 未完成 | A 被移到「按时间查看」❌ | A 保留在「今日待办」✓ |
| 全部完成 | 已完成 | 已完成 | 已完成 | 整组移到「按时间查看」✓ | 整组移到「按时间查看」✓ |
| 未完成 | 未完成 | 未完成 | 未完成 | 整组留在「今日待办」✓ | 整组留在「今日待办」✓ |

出现"半完成"父任务时，已完成的子任务被孤立搬到时间视图，但父任务和其他子任务还在今日视图，导致层级分裂，TimeView 看到的是孤儿子任务。

同样的反向问题在 `activeTodos` 上：如果不做调整，A 这类「子任务已完成 + 父任务未完成」的任务会同时不满足 `activeTodos` 和新 `completedTodos` 的条件，变得既不在今日也不在按时间视图——任务消失。

---

## 变更方案

**核心规则：跨天移动决策只看第一级任务（`parentId === null`）的状态。**

- 一个第一级任务**"已跨天"** = `completed === true` 且 `completedAt` 的本地日期 ≠ 今天
- 任意任务是否进入「按时间查看」= 它的**第一级祖先**处于"已跨天"状态
- 任意任务是否留在「今日待办」= 不在「按时间查看」（即它的第一级祖先未跨天），**且**满足原有的"未完成 / 今日完成"条件
  - 对于「子任务已完成 + 父任务未完成」这种"父未跨天、子已跨天（昨天完成）"的情况：父未跨天 → 整个子树留在今日待办，子任务继续显示（保持层级完整）

### 涉及代码

仅修改 `src/App.vue` 中的两个 computed。引入一个 `getFirstLevelAncestor` 工具函数供两者共用（`todos` 是响应式 ref，闭包内读取会自动追踪依赖）。

```typescript
function getFirstLevelAncestor(item: TodoItem): TodoItem {
  let current = item;
  while (current.parentId !== null) {
    const parent = todos.value.find((x) => x.id === current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

const activeTodos = computed(() => {
  let filtered = todos.value.filter((t) => {
    if (!t.completed) return true;
    if (t.completedAt && toLocalDateStr(t.completedAt) === todayStr.value) return true;
    const ancestor = getFirstLevelAncestor(t);
    return !isFirstLevelCrossedOver(ancestor);
  });
  if (selectedCatId.value === "__none__") {
    filtered = filtered.filter((t) => t.catId === null);
  } else {
    filtered = filtered.filter((t) => t.catId === selectedCatId.value);
  }
  return filtered;
});

const completedTodos = computed(() =>
  todos.value.filter((t) => {
    if (!t.completed) return false;
    const ancestor = getFirstLevelAncestor(t);
    return isFirstLevelCrossedOver(ancestor);
  })
);
```

其中 `isFirstLevelCrossedOver` 辅助函数（放在 `todayStr` 之后）：

```typescript
function isFirstLevelCrossedOver(item: TodoItem): boolean {
  if (item.parentId !== null) return false;
  if (!item.completed || !item.completedAt) return false;
  return toLocalDateStr(item.completedAt) !== todayStr.value;
}
```

### 行为矩阵

| 第一级任务 | 子任务 | 今日待办显示 | 按时间查看显示 |
|-----------|--------|-------------|---------------|
| 未完成 | - | ✓ | ✗ |
| 今日完成 | - | ✓ | ✗ |
| 昨天完成（跨天） | - | ✗ | ✓ |
| 未完成 | 子任务昨日完成 | 父子都在「今日待办」✓ | ✗ |
| 今日完成 | 子任务今日完成 | 父子都在「今日待办」✓ | ✗ |
| 昨日完成（跨天） | 子任务昨日完成 | ✗ | 整组都在「按时间查看」✓ |

子任务永远不会先于第一级祖先被搬到时间视图，父子始终同进同出。

### 边界情况

- **孤立子任务**（`parentId` 指向不存在的任务）：`getFirstLevelAncestor` 沿链上溯到不存在的 `parent` 时 `break`，最终 `current` 仍是非第一级任务，`isFirstLevelCrossedOver` 返回 `false`，被排除于「按时间查看」、保留在「今日待办」。✓
- **跨层级同步**：`syncParentCompletion` 在 `src/App.vue` 中仍然按现有逻辑把父任务 `completedAt` 设为同步时刻；不修改该函数（用户没要求），本计划仅调整两个 computed 的过滤语义。
- **TimeView 内部**：`src/components/TimeView.vue` 第 70 行用 `dayjs(t.completedAt).format("YYYY-MM-DD")` 按 selectedDay 过滤，行为独立于本计划改动；父任务与子任务由 `flatToNested` 重组，父子同日完成时正常显示父子层级。**不在本次修改范围**。

---

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.vue` | 修改 | 新增 `getFirstLevelAncestor` 和 `isFirstLevelCrossedOver`；改写 `activeTodos` 与 `completedTodos` 的过滤条件 |

## 验证

- `npm run build` 确保类型检查通过
- 手工验证场景：
  1. 创建带 3 个子任务的父任务
  2. 完成第 1 个子任务 → 切到「按时间查看」，确认看不到任何子任务
  3. 修改系统时间到次日（或直接编辑 SQLite 的 `completedAt` 字段），刷新
  4. 切到「按时间查看」→ 应仍看不到子任务
  5. 切回「今日待办」→ 父任务和已完成的子任务 1 都应可见（保持父子层级）
  6. 再完成子任务 2、3 → 整组从「今日待办」消失，到「按时间查看」按层级显示
