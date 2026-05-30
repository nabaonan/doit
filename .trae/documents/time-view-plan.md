# 按时间查看待办事项功能计划

## 目标

已完成的项目自动归档到对应日期分类中，提供按时间维度查看历史已完成待办事项的功能。默认展示当天未完成待办，非当天完成的不在主列表显示。

## 需要修改的文件

### 1. `src/components/TitleBar.vue` — 顶部增加 Tab 切换

* 标题 "Doit" 左侧增加两个 Tab："今日待办" / "按时间查看"

* 使用 `a-segmented` 或两个 `a-button` 实现切换

* emit 新事件 `update:view` 通知 App.vue 当前视图

### 2. `src/App.vue` — 新增视图状态和条件渲染

* 新增 `currentView` ref: `'today' | 'time'`

* `todos` 拆分为 `activeTodos`（未完成）+ `completedTodos`（已完成）

* 默认视图渲染 `TodoList`，时间视图渲染 `TimeView`

* `handleAddTodo` 等操作只作用于当日视图

### 3. `src/components/TimeView.vue` — 新建时间查看页面（核心）

**布局**：左侧时间列表 + 右侧已完成待办详情

**顶部**：

* `a-date-picker`，支持 `mode="week"` 和 `mode="month"` 两种模式

* 模式切换使用 `a-radio-group` 或 `a-segmented`："按周" / "按月"

**左侧列表**：

* 按周：展示当周 7 天（周一\~周日），格式 `周一 6月2日`

* 按月：展示当月每一天（1 日\~月底）

* 点击某一天高亮选中，右侧展示该天的已完成待办

**右侧面板**：

* 展示选中日期的已完成待办列表（只读）

* 复用 `TodoItem` 但需要只读模式（禁用 checkbox、右键菜单、双击编辑、长按完成）

* 每个待办显示内容、标签、完成时间、耗时

### 4. `src/components/TodoItem.vue` — 新增只读模式

* 新增 prop `readonly: boolean`（默认 false）

* 当 `readonly=true` 时：

  * 不显示 checkbox

  * 不响应右键菜单（`a-dropdown` 禁用）

  * 不响应双击编辑

  * 不响应长按完成

  * 内容以 `line-through` 展示（因为都是已完成的）

### 5. `src/components/TodoList.vue` — 过滤逻辑调整

* 改为接收 `activeTodos`（未完成待办）

* 不再需要 `:filter` 排除已完成项

* `a-empty` 文案调整："暂无待办事项"

## 数据流

```
App.vue
  ├─ todos[] (全部)
  ├─ activeTodos = todos.filter(t => !t.completed && isToday(t.createdAt))
  ├─ completedTodos = todos.filter(t => t.completed)
  │
  ├─ currentView === 'today'
  │   └─ TodoList(:todos="activeTodos")
  │
  └─ currentView === 'time'
      └─ TimeView(:todos="completedTodos")
           ├─ date-picker (week/month)
           ├─ day list (left)
           └─ TodoItem(readonly) x N (right)
```

## 文件变更清单

| 文件                            | 操作     | 说明                   |
| ----------------------------- | ------ | -------------------- |
| `src/components/TitleBar.vue` | 修改     | 增加视图切换 Tab           |
| `src/App.vue`                 | 修改     | `currentView` + 条件渲染 |
| `src/components/TimeView.vue` | **新建** | 时间查看页面               |
| `src/components/TodoItem.vue` | 修改     | 新增 `readonly` prop   |
| `src/components/TodoList.vue` | 修改     | 接收 activeTodos       |

## 注意事项

* `TimeView` 中的日期计算使用 `dayjs`（已安装）

* `a-date-picker` 的 `mode` 支持 `week`/`month`，使用 `v-model:value` + `@change`

* 只读 `TodoItem` 移除所有交互事件绑定

* 已完成待办按 `completedAt` 降序排列

