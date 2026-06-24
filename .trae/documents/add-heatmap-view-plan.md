# 热点图 (Heatmap) 实现计划

## Summary

在 Doit 应用中新增 GitHub 风格的「活动热点图」,展示过去 52 周(约 1 年)的每日待办完成情况,深浅不一的绿色小方块直观呈现用户的"打卡密度"。作为顶部导航的第三个视图 tab「统计」出现。实现采用现成 Vue 3 组件库 `vue3-calendar-heatmap`(基于 SVG + Tippy.js tooltip,GitHub 同款绿色配色),避免手写网格逻辑。

## Current State Analysis

- `App.vue` 持有 `currentView = ref<"today" | "time">("today")`,模板中通过 `v-if` 切换 `TodoList` / `TimeView`
- `TitleBar.vue` 的 segmented control 当前只暴露两个选项:`"today"` / `"time"`,通过 `emit("update:view")` 上抛
- `TodoItem.completedAt` 字段已存在且为 ISO 字符串,正是计算每日完成数的数据源
- `ReportDialog.vue` 中已使用 `dayjs` / `isoWeek` 处理日期
- 全局色彩令牌在 `src/style.css` 中以 OKLCH 定义在 `:root` 与 `.dark`,**但本次不需扩展**——库自带 GitHub 同款色板
- 现有 `package.json` 已包含 `dayjs` (1.11.21) 等基础依赖,本次新增两个: `vue3-calendar-heatmap`、`tippy.js`(peer dep)

## Design Decisions (与用户确认)

| 决策 | 选择 |
|------|------|
| 入口位置 | TitleBar 新增「统计」tab,与「今日待办」「按时间查看」并列 |
| 时间范围 | 最近 52 周 (~1 年,库的内置窗口) |
| 完成数定义 | 所有 `completed=true` 的条目(含父级) |
| 配色 | 使用库内置 GitHub 同款绿色阶,通过 `darkMode` 绑定 app 主题 |
| 实现方式 | 使用 `vue3-calendar-heatmap` 库,零手写网格 |

## Library 选型

**`vue3-calendar-heatmap`** (v2.0.5, MIT)
- Vue 3 原生 SVG 组件
- 0 自身依赖,只需 `tippy.js` 作为 peer dep
- API 与本场景完美契合:
  - `values: Array<{ date, count }>` — 直接喂入我们聚合出的 `[{date, count}]`
  - `endDate` — 终点 = 今天,自动向前推 52 周
  - `darkMode: boolean` — 切换内置 light/dark 绿色色板
  - `rangeColor: string[]` (可选) — 自定义 5 级配色覆盖默认
  - `tooltip`, `tooltipUnit`, `tooltipFormatter` — tooltip 完全可控
  - `noDataText` — 空数据日 tooltip 文案
- 内置 CSS 自动随包加载,无需手动 import 样式

## Proposed Changes

### 1. `package.json`: 新增两个依赖

```diff
   "dependencies": {
     ...
+    "tippy.js": "^6.3.7",
+    "vue3-calendar-heatmap": "^2.0.5",
   }
```

执行 `npm install` 安装。

### 2. 新增 `src/components/HeatmapView.vue`

**职责**:从 `todos` 聚合每日完成数,包装 `<CalendarHeatmap>` 并应用项目主题。

**Props**
```ts
defineProps<{ todos: TodoItem[] }>()
```

**核心 computed**

```ts
import dayjs from "dayjs";
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { CalendarHeatmap } from "vue3-calendar-heatmap";
import type { TodoItem } from "../types";

// 聚合 Map<YYYY-MM-DD, count>
const dailyCounts = computed(() => {
  const m = new Map<string, number>();
  for (const t of props.todos) {
    if (!t.completed || !t.completedAt) continue;
    const d = dayjs(t.completedAt).format("YYYY-MM-DD");
    m.set(d, (m.get(d) || 0) + 1);
  }
  return m;
});

// 转为库需要的 values 数组
const values = computed(() =>
  Array.from(dailyCounts.value, ([date, count]) => ({ date, count }))
);

// 监听 <html> 上的 .dark 类以同步 darkMode
const isDark = ref(false);
const darkObserver = new MutationObserver(() => {
  isDark.value = document.documentElement.classList.contains("dark");
});
onMounted(() => {
  isDark.value = document.documentElement.classList.contains("dark");
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
});
onBeforeUnmount(() => darkObserver.disconnect());

// tooltip 文案
const tooltipFormatter = (v: { date: string | Date; count: number }) => {
  const date = dayjs(v.date).format("YYYY年MM月DD日");
  return v.count === 0 ? `${date} 无完成记录` : `${date} 完成 ${v.count} 个待办`;
};
```

**模板**

```html
<div class="p-4 overflow-x-auto">
  <div class="inline-flex flex-col gap-3 min-w-fit">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="text-sm font-semibold text-[var(--foreground)]">每日完成热点图</h2>
      <span class="text-xs text-[var(--muted-foreground)]">最近 52 周 · 共完成 {{ totalCount }} 个待办</span>
    </div>
    <CalendarHeatmap
      :values="values"
      :end-date="todayStr"
      :dark-mode="isDark"
      :tooltip="true"
      tooltip-unit="个待办"
      :tooltip-formatter="tooltipFormatter"
      no-data-text="无数据"
      :round="3"
    />
    <p v-if="values.length === 0" class="text-xs text-[var(--muted-foreground)] self-center py-4">
      还没有完成记录,完成一条待办即可点亮你的第一格
    </p>
  </div>
</div>
```

**todayStr** 通过 `dayjs().format("YYYY-MM-DD")` 在 setup 顶层求值一次即可,作为 `endDate` 传给库。

**编码要点**
- `import { CalendarHeatmap } from 'vue3-calendar-heatmap'` —— 使用具名导入,避免全局污染
- 不写注释,`.vue` 文件带分号(遵循项目规约)
- 不在 `HeatmapView.vue` 内写 `<style>` 块,所有排版走 Tailwind utility
- `totalCount` 用 `computed` 派生自 `dailyCounts.values()`

### 3. 修改 `src/components/TitleBar.vue`

**改动点**
- `currentView` ref 类型扩展为 `"today" | "time" | "heatmap"`,默认仍为 `"today"`
- segmented control 的 `:options` 数组新增一项:
  ```ts
  { label: "统计", value: "heatmap" }
  ```
- 排在「按时间查看」之后,顺序为:今日待办 / 按时间查看 / 统计
- `onViewChange` 无需改动,仍直接 `emit("update:view", val)`

### 4. 修改 `src/App.vue`

**改动点**
- `import HeatmapView from "./components/HeatmapView.vue"`
- `currentView` ref 类型扩展为 `"today" | "time" | "heatmap"`,初始值保持 `"today"`
- 模板中 `currentView === "time"` 分支旁追加:
  ```html
  <HeatmapView
    v-if="currentView === 'heatmap'"
    :todos="todos"
  />
  ```
- 传入的是 `todos`(全量,未分类筛选),确保跨分类聚合

## Assumptions & Trade-offs

- **时间范围 52 周**:由于库内 `start = endDate - 1 year` 硬编码,无法直接做 26 周窗口;用户已确认接受 52 周
- **配色**:使用库内置 GitHub 同款绿阶,色板成熟、辨识度高;**不与项目 CSS 变量同步**,但通过 `darkMode` 绑定跟随 app 主题切换 light/dark
- **不与分类筛选联动**:始终展示全量数据,避免在切换分类时反复重渲染热力图
- **不持久化"显示偏好"**:HeatmapView 是只读视图,不涉及 settings 字段,无需扩展 `AppSettings`
- **不与 ReportDialog 联动**:本次不做"点击热点图某天 → 跳转日报"的深度联动,保持组件简单
- **today 视图下不展示**:仅作为独立 tab,不嵌入主列表
- **窄屏**:库原生响应式,窄屏走父容器 `overflow-x-auto` 横向滚动

## Verification

1. **依赖安装与构建检查**:
   ```bash
   cd /Users/nbn/workspace/github/doit && npm install && npm run build
   ```
   预期:`vue-tsc` 0 错误,Vite 构建成功

2. **运行时验证**:
   - `npm run dev` 启动浏览器调试
   - 顶部 segmented 出现「统计」选项
   - 点击「统计」:切换到 HeatmapView,渲染 52 周 × 7 天网格,显示 GitHub 同款绿色阶
   - 手动完成若干待办,完成时间分布在不同日期 → 回到「统计」tab,对应日期方块颜色变深
   - 鼠标 hover 单元格 → tooltip 显示 `YYYY年MM月DD日 完成 N 个待办`
   - 在 app 设置里切换 light/dark 主题 → 热点图绿阶同步切换

3. **回归检查**:
   - 「今日待办」「按时间查看」tab 切换正常
   - 报告弹窗的日报/周报不受影响
   - Tauri 桌面端 (`npm run tauri dev`) 行为一致
