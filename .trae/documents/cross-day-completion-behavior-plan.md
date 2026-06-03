# 跨天完成行为优化计划

## 概述

优化今日待办和按时间查看的过滤逻辑，解决跨天后已完成待办的显示问题。

---

## 当前状态分析

当前过滤逻辑在 `src/App.vue` 第52-64行：

```typescript
// activeTodos — 今日待办
todos.value.filter((t) => !t.completed || dayjs(t.completedAt).format("YYYY-MM-DD") === todayStr.value)

// completedTodos — 按时间查看
todos.value.filter((t) => t.completed && t.completedAt && dayjs(t.completedAt).format("YYYY-MM-DD") !== todayStr.value)
```

**问题**: 使用 `dayjs(t.completedAt).format("YYYY-MM-DD")` 解析 ISO 时间字符串时，可能存在时区转换导致的日期偏差。例如北京时间 00:01 完成的待办，其 ISO 字符串日期是前一天，但 dayjs 解析后转为本地时间日期是当天，反之亦然，导致跨天时已完成待办的显示行为不符合预期。

---

## 变更方案

保持基于 `completedAt` 的过滤语义不变（今日待办 = 未完成 + 今日完成），但改用字符串前缀匹配来避免 dayjs 时区解析问题。

`todayStr` 格式为 `"YYYY-MM-DD"`（如 `"2026-06-03"`），`completedAt` 是 ISO 8601 字符串（如 `"2026-06-03T08:00:00.000Z"`）。直接用 `startsWith` 比较日期部分，不经过 dayjs 解析。

### 新逻辑

**activeTodos（今日待办）**:
```typescript
todos.value.filter((t) => !t.completed || (t.completedAt && t.completedAt.startsWith(todayStr.value)))
```

**completedTodos（按时间查看）**:
```typescript
todos.value.filter((t) => t.completed && t.completedAt && !t.completedAt.startsWith(todayStr.value))
```

### 效果

| 场景 | 今日待办 | 按时间查看 |
|------|---------|-----------|
| 未完成的待办 | 显示 | - |
| 今天完成的待办 | 显示（跨天前始终可见） | - |
| 之前完成的待办 | - | 显示 |

---

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.vue` | 修改 | 修改 `activeTodos` 和 `completedTodos` 的过滤逻辑 |

## 验证

- `npm run build` 确保类型检查通过
