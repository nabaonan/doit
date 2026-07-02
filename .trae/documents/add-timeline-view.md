# 时间轴视图（基于 antdv-next Timeline 组件）

## Summary

新增"时间轴"视图，与现有"按时间查看"并列展示。TitleBar 增加 4 个选项（今日待办 / 日历浏览 / 时间轴 / 统计）。

实现采用 antdv-next `a-timeline` 组件，模式 `mode="left"`（左侧为日期轴 / `title`，右侧为事件内容 / `content`），完美匹配用户"左侧时间轴 + 右侧完成事件"的要求。数据按日期从近到远排序，每个日期节点内事件按完成时刻倒序，每条事件展示 `HH:mm` + 内容。

为消除与"时间轴"名称混淆，将现有 `time` view 标识符重命名为 `calendar`，显示文本改为"日历浏览"。

## Current State Analysis

- [TitleBar.vue](file:///Users/nbn/workspace/github/doit/src/components/TitleBar.vue#L74-L83) 中 `a-segmented` 当前有 3 个选项：`today` / `time` / `heatmap`
- [TimeView.vue](file:///Users/nbn/workspace/github/doit/src/components/TimeView.vue) 是现有 `time` 视图：按周/按月日历浏览 + 选中某天查看条目
- [App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue#L155-L161) 已有 `completedTodos` computed，但只包含"跨日完成"的（`isFirstLevelCrossedOver`）— 当天完成的不会进入；时间轴需要看到当天完成项
- [App.vue](file:///Users/nbn/workspace/github/doit/src/App.vue#L70) `currentView` 类型是 `"today" | "time" | "heatmap"`
- antdv-next Timeline 组件权威类型（来自 `node_modules/antdv-next/dist/timeline/Timeline.d.ts`）：
  - `TimelineItemType` 字段：`title` / `content`（推荐）/ `label` / `children`（已废弃）
  - Timeline 顶层 `mode`：`'left' | 'alternate' | 'right' | 'start' | 'end'`
  - `mode="left"` 行为：title 在竖线左侧、content 在竖线右侧（默认）
  - TimelineItem 的 slots：`title?`、`content?`、`icon?`
  - 全局 prop `titleSpan?: string | number` 可控制 title 列宽度

## Proposed Changes

### 1. 新建 `src/components/TimelineView.vue`

**Props**：
- `todos: TodoItem[]` — 全部已完成待办（包含当天完成项）

**Script**：
- 引入 `dayjs`（项目全局已配置中文 locale）
- `WEEKDAYS` 常量数组 `["周日", "周一", "周二", "周三", "周四", "周五", "周六"]`
- `dayGroups` computed：
  - 过滤 `t.completed && t.completedAt`
  - 用 `dayjs(t.completedAt).format("YYYY-MM-DD")` 作为 group key
  - 组内按 `completedAt` 倒序
  - 整体按 date key 倒序
  - 结构：`{ dateKey: string, items: TodoItem[] }`

**Template**：
- 外层 `flex-1 overflow-y-auto px-6 py-6`
- 空状态：`a-empty description="还没有完成记录"`
- 主体：`<a-timeline mode="left" title-span="100px">` —— title 列固定 100px
- 每个 `<a-timeline-item>` 内：
  - `#title` 插槽：两行右对齐文本
    - 第一行 `MM-DD`，`text-base font-semibold text-[var(--foreground)] tabular-nums`
    - 第二行 `星期`，`text-xs text-[var(--muted-foreground)]`
  - 默认内容插槽：纵向事件列表
    - 每条事件一行：`flex items-baseline gap-3`
    - 左侧 `HH:mm`，`text-xs text-[var(--muted-foreground)] tabular-nums w-12 shrink-0`
    - 右侧 `line-through text-[var(--muted-foreground)]` 的内容

**为什么用 Timeline 组件而非自绘**：
- 用户明确要求 `Use antdv-next 时间轴组件`（即 Timeline 组件）
- antdv-next Timeline 本身就支持"左 title + 右 content"模式，与"左侧时间轴 + 右侧事件"语义一致
- 减少手写 CSS 竖线/dot 的工作量，主题自动适配

### 2. 修改 `src/components/TitleBar.vue`

- `a-segmented` 选项从 3 个变 4 个：
  ```ts
  [
    { label: "今日待办", value: "today" },
    { label: "日历浏览", value: "calendar" },
    { label: "时间轴", value: "timeline" },
    { label: "统计", value: "heatmap" },
  ]
  ```
- value 标识符变化：`"time"` → `"calendar"`

### 3. 修改 `src/App.vue`

**Script**：
- 新增 `allCompletedTodos` computed（仅按 `completed && completedAt` 过滤，不走 `isFirstLevelCrossedOver`）：
  ```ts
  const allCompletedTodos = computed(() =>
    todos.value.filter((t) => t.completed && !!t.completedAt)
  );
  ```
- `currentView` 类型扩展为 `"today" | "calendar" | "timeline" | "heatmap"`
- `currentView` 初值不变（"today"）

**Template**：
- TitleBar 事件 cast 同步：`v as 'today' | 'calendar' | 'timeline' | 'heatmap'`
- 把现有 `v-if="currentView === 'time'"` 改为 `v-if="currentView === 'calendar'"`
- 在 `TimeView` 与 `StatisticsView` 之间插入新分支：
  ```html
  <TimelineView
    v-if="currentView === 'timeline'"
    :todos="allCompletedTodos"
  />
  ```

## Assumptions & Decisions

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Timeline 库 | antdv-next `a-timeline` + `a-timeline-item` | 用户明确要求 |
| 模式 | `mode="left"` | 默认就是左 title + 右 content，匹配用户语义 |
| 标识符重命名 | `"time"` → `"calendar"` | 避免与 `"timeline"` 混淆；只影响 2 处 |
| title 列宽 | `title-span="100px"` | 给日期标签足够空间，避免挤压 |
| 数据源 | 新建 `allCompletedTodos`（不过滤跨日） | 时间轴要看到当天完成项 |
| 排序 | computed 中按 date 倒序、组内按 completedAt 倒序 | 不依赖 `reverse` prop，更显式 |
| 标签/分类展示 | 不显示 | 时间轴是流水账视图，简洁为上 |
| 父-子任务展示 | 平铺，子任务也作为独立事件 | 与现有 TimeView 不同，更简单 |
| 选中分类过滤 | 暂不生效 | 时间轴是全局回顾视图 |
| 父任务完成时子任务未完成的情况 | 不特殊处理 | 子任务若 completed=false 不会进入 dayGroups |

## Verification Steps

1. `npm run build` 通过（vue-tsc + vite build）
2. `npm run dev` 启动后：
   - TitleBar 出现 4 个分段项：今日待办 / 日历浏览 / 时间轴 / 统计
   - 点击"日历浏览"：原 TimeView 行为不变
   - 点击"时间轴"：进入新视图
3. 时间轴视图验证：
   - 没有完成项时显示 `a-empty` 占位
   - 至少一天有完成项时，按日期从近到远排序
   - 每个日期节点：左侧显示 `MM-DD` + 星期（两行右对齐），右侧列出该日完成项
   - 每条事件：`HH:mm`（等宽）+ `line-through` 内容
   - 圆点 + 竖线由 `a-timeline` 自动渲染
4. 当天完成的待办在时间轴中可见（验证不依赖 `isFirstLevelCrossedOver`）
5. 完成新待办后，时间轴立即出现对应记录（响应式刷新）
6. 在 TitleBar 间反复切换，"日历浏览"和"时间轴"互不干扰
7. 暗色模式下颜色变量自动适配（用 `bg-[var(--border)]` `text-[var(--muted-foreground)]` 等）
