# 完成率环形统计图 实现计划

## Summary

在 Doit 应用的「统计」tab 内、热点图下方新增一个**完成率**区段。用户可通过 antdv-next DatePicker 选定某月或某周,组件按"该周期内创建的待办"为统计基数,通过 antdv-next `a-progress type="circle"` 渲染一个绿色环形进度条,展示"周期内已完成 vs 未完成"的比例与计数。

## Current State Analysis

- `src/components/HeatmapView.vue` 是「统计」tab 当前的唯一组件,仅展示热点图
- `src/components/TimeView.vue` 已在使用 antdv-next `a-date-picker picker="week"|"month"`,可直接复用思路
- `src/types/index.ts` 中 `TodoItem` 已有 `createdAt` 与 `completedAt` 两个 ISO 时间字段,正是本次统计的输入
- antdv-next 没有真饼状图组件;`a-progress type="circle"` 是标准全圆环,正好充当"饼状"视觉
- 主题色已在 `isDark` 状态中监听,可通过响应式 `:stroke-color` / `:rail-color` 切换明暗配色
- 项目无任何图表库,本次零新增依赖

## Design Decisions (与用户确认)

| 决策 | 选择 |
|------|------|
| 入口位置 | 统计 tab 内,热点图下方,新增「完成率」区段 |
| 图表组件 | `a-progress type="circle"` (antdv-next 全圆环) |
| DatePicker | antdv-next `a-date-picker` (picker=week/month) |
| 统计基数 | `createdAt` 落在选中周期内的待办 |
| 完成定义 | 基数内 `completedAt` 也落在同一周期内 |
| 未完成定义 | 基数内 `completedAt` 为 null 或不在同一周期内 |
| 周期粒度切换 | segmented:「按月 / 按周」 |
| 配色 | 已完成用绿(浅/深主题各一套),未完成用中性灰 |

## Proposed Changes

### 1. 重命名文件 `src/components/HeatmapView.vue` → `src/components/StatisticsView.vue`

- 改名原因:该组件将承载多个统计模块(热点图 + 完成率),"StatisticsView" 更准确
- 改动:用 Write 写新文件,DeleteFile 删旧文件
- 同步更新 `src/App.vue` 的 import 路径与模板使用名

### 2. 修改 `src/components/StatisticsView.vue`

#### 2.1 在 `<script setup>` 追加状态与计算

```ts
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

const completionMode = ref<"week" | "month">("month");
const selectedDate = ref(dayjs());

const periodRange = computed(() => {
  if (completionMode.value === "month") {
    return {
      start: selectedDate.value.startOf("month"),
      end: selectedDate.value.endOf("month"),
      label: selectedDate.value.format("YYYY年M月"),
    };
  }
  return {
    start: selectedDate.value.isoWeekday(1).startOf("day"),
    end: selectedDate.value.isoWeekday(7).endOf("day"),
    label: `${selectedDate.value.isoWeekday(1).format("M月D日")} - ${selectedDate.value.isoWeekday(7).format("M月D日")}`,
  };
});

const completionStats = computed(() => {
  const { start, end } = periodRange.value;
  const inRange = (d: dayjs.Dayjs) =>
    (d.isSame(start, "day") || d.isAfter(start)) &&
    (d.isSame(end, "day") || d.isBefore(end));
  const cohort = props.todos.filter((t) => t.createdAt && inRange(dayjs(t.createdAt)));
  let completed = 0;
  for (const t of cohort) {
    if (t.completedAt && inRange(dayjs(t.completedAt))) completed++;
  }
  const total = cohort.length;
  const incomplete = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, incomplete, percent };
});

const ringColors = computed(() =>
  isDark.value
    ? { done: "#22c55e", todo: "#374151" }
    : { done: "#16a34a", todo: "#e5e7eb" }
);
```

#### 2.2 在 `<template>` 现有热点图区段下方追加完成率区段

```html
<div class="border-t border-[var(--border)] pt-4 mt-2">
  <div class="flex items-baseline justify-between gap-3 flex-wrap mb-3">
    <h2 class="text-sm font-semibold text-[var(--foreground)]">完成率</h2>
    <span class="text-xs text-[var(--muted-foreground)]">
      周期: {{ periodRange.label }} · 共 {{ completionStats.total }} 个待办
    </span>
  </div>
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
    <a-segmented
      v-model:value="completionMode"
      :options="[
        { label: '按月', value: 'month' },
        { label: '按周', value: 'week' },
      ]"
      size="small"
    />
    <a-date-picker
      v-if="completionMode === 'month'"
      v-model:value="selectedDate"
      picker="month"
      format="YYYY年M月"
      class="flex-1 min-w-0"
    />
    <a-date-picker
      v-else
      v-model:value="selectedDate"
      picker="week"
      format="YYYY 第wo"
      class="flex-1 min-w-0"
    />
  </div>
  <div class="flex flex-col sm:flex-row items-center gap-6 mt-4">
    <a-progress
      type="circle"
      :percent="completionStats.percent"
      :stroke-color="ringColors.done"
      :rail-color="ringColors.todo"
      :size="160"
      :stroke-width="10"
      :format="(p) => `${p}%`"
    />
    <div class="flex flex-col gap-2 text-sm">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm" :style="{ background: ringColors.done }" />
        <span class="text-[var(--muted-foreground)]">已完成</span>
        <span class="font-semibold text-[var(--foreground)]">{{ completionStats.completed }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-sm" :style="{ background: ringColors.todo }" />
        <span class="text-[var(--muted-foreground)]">未完成</span>
        <span class="font-semibold text-[var(--foreground)]">{{ completionStats.incomplete }}</span>
      </div>
    </div>
  </div>
  <p
    v-if="completionStats.total === 0"
    class="text-xs text-[var(--muted-foreground)] mt-3 text-center"
  >
    该周期内没有创建的待办
  </p>
</div>
```

#### 2.3 模板外层容器适配

将现有最外层 `flex-1 overflow-x-auto overflow-y-hidden p-4` 改为 `flex-1 overflow-y-auto p-4`(`overflow-x-auto` 移除避免与纵向滚动冲突;新增区段无须横向滚动)。

### 3. 修改 `src/App.vue`

- 同步 import 名:`HeatmapView` → `StatisticsView`
- 同步模板引用:组件名与判断保持 `currentView === "heatmap"` 不变(用户视角"统计" tab 仍存在)

## Assumptions & Trade-offs

- **"未完成"判定**:同周期未完成的才计入未完成,跨周期完成的也计未完成(用户原文:"在某月没有完成就算未完成")
- **跨周期重复计入**:一个在 1 月创建、2 月才完成的待办,只在 1 月统计里被记为未完成,2 月统计基数里不包含它
- **父子任务**:沿用项目既有口径,所有 `completed=true` 的都算"完成",与热点图保持一致
- **defaultPeriod**:进入页面时默认显示当前月(可由用户通过 DatePicker 切换)
- **不持久化用户上次选的周期**:刷新后回到当前月;若需要后续再追加
- **窄屏**:sm 以下 DatePicker 与环形堆叠显示,避免挤占

## Verification

1. **构建检查**:
   ```bash
   cd /Users/nbn/workspace/github/doit && npm run build
   ```
   预期:vue-tsc 0 错误,Vite 构建成功

2. **运行时验证**:
   - `npm run dev` 启动浏览器调试
   - 切换到「统计」tab → 热点图下方出现「完成率」区段
   - 默认显示当前月,完成率圆环显示当前月数据
   - 切换「按周」→ DatePicker 切换为周选择器,圆环与数字更新
   - 在 DatePicker 中选择历史月份/周 → 圆环与数字按所选周期重算
   - 选中一个无待办的周期 → 显示「该周期内没有创建的待办」
   - 切换 light/dark 主题 → 圆环颜色与图例同步切换

3. **回归检查**:
   - 「今日待办」「按时间查看」tab 切换正常
   - 热点图本身不受影响
   - 报告弹窗的日报/周报不受影响
