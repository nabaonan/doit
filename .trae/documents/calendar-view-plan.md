# 计划：日历浏览增加按月日历视图

## 总结

在现有的 "日历浏览" 页面中增加一种按月日历网格视图（使用 antdv-next 的 `<a-calendar>` 组件），与现有的按周/按月的侧边栏列表视图共存。日历视图展示每天完成了多少待办，点击日期弹出气泡展示该日完成的待办详情。

***

## 当前状态分析

* **TimeView\.vue** (`src/components/TimeView.vue`)：当前 "日历浏览" 视图，提供 "按周"/"按月" 两种侧边栏 + 列表模式

* **App.vue**（第 823-826 行）：`currentView === "calendar"` 时渲染 `<TimeView :todos="completedTodos" />`

* **completedTodos** 计算属性（App.vue 第 127-133 行）：过滤已完成的待办

* 数据模型 `TodoItem` 包含 `completedAt` 字段，可用于按天聚合

* 项目使用 **antdv-next** 组件库，已有 `<a-calendar>`、`<a-popover>` 可用

***

## 计划变更

### 1. 创建 `CalendarView.vue` — 新组件

**路径**：`src/components/CalendarView.vue`

**功能**：在 TimeView 的头部增加切换按钮（"列表" / "日历"），当切换到 "日历" 模式时，展示一个按月日历网格。

**设计要点**：

**a) 模式切换**

* 在 TimeView 现有的 `<a-segmented>`（按周/按月）旁边或内部，增加一个模式切换：`列表视图` / `日历视图`

* 默认显示 "列表视图"（即现有的 TimeView 行为）

* 切换到 "日历视图" 时，隐藏侧边栏列表，显示 `<a-calendar>` 组件

**b) 日历组件 (`<a-calendar>`)**

* 使用 `fullscreen` 模式填满可用空间

* 通过 **`cellRender`** **插槽**自定义每个日期单元格内容：

  * 显示当天完成的待办数量（用圆点/badge 表示）

  * 如果没有完成的待办，显示为空或小圆点占位

  * 使用 `var(--primary)` 主题色作为数量标记

* 通过 **`@select`** **事件**监听日期点击

**c) 点击弹窗 (`<a-popover>`)**

* 点击日期时，弹出 `<a-popover>`

* 弹窗内容：

  * 标题：`YYYY年MM月DD日 · 完成 N 个待办`

  * 列表：每个完成待办的条目（显示 `content` 文本 + 完成勾选标记）

  * 如果该天没有完成待办，显示 "该日期没有已完成的待办事项"

* 弹窗使用 `trigger="click"`，点击外部关闭

**d) 数据结构**

* `computed` 预处理：生成 `Map<string, TodoItem[]>`，key 为 `YYYY-MM-DD`

* 在 `cellRender` 中根据日期 key 快速查询

**Props**：

* `todos: TodoItem[]` — 已完成的待办列表

### 2. 修改 `TimeView.vue` — 增加日历模式

**变更**：

* 在 `<template>` 顶部的控制栏，增加一个 `<a-segmented>` 或按钮切换「列表」/「日历」

* 使用 `v-if` / `v-else` 控制：

  * `v-if="viewMode === 'list'"`：显示现有内容（侧边栏列表）

  * `v-else`：显示新的 `<CalendarView>` 组件

* viewMode 内部状态：`ref<"list" | "calendar">("list")`

**具体变更位置**：

* 第 80 行 `<div class="flex-1 flex overflow-hidden">` 这一整块是列表视图的内容

* 在它同一层增加日历视图分支

### 3. 样式适配

* `<a-calendar>` 外层包裹容器：`flex-1 overflow-auto` 以填满剩余空间

* 使用 Tailwind 类控制，不添加 `<style>` 块

* 颜色使用 CSS 变量：`bg-[var(--background)]`、`text-[var(--foreground)]`、`border-[var(--border)]`

* 日历单元格中的待办数量标记使用 `bg-[var(--primary)]` 背景色 + `text-[var(--primary-foreground)]` 文字色

***

## 假设与决策

* **假设**：用户希望在现有 "日历浏览" 页面中增加一种可视化模式选择，而不是替换或导航到新页面

* **决策**：直接在 `TimeView.vue` 内部增加模式切换，保持所有状态在同一个组件内

* **决策**：使用 antdv-next 的 `<a-calendar>` + `<a-popover>`，与项目现有 UI 组件库一致

* **决策**：日历视图显示的数据源与列表视图相同（`completedTodos`）

* **决策**：默认展示列表视图，用户通过切换按钮进入日历视图

***

## 验证步骤

1. 打开应用，点击「日历浏览」tab
2. 验证默认显示现有列表视图（行为不变）
3. 点击「日历」切换按钮，验证日历网格渲染
4. 验证每个日期单元格显示完成数量
5. 点击有完成待办的日期，验证弹窗显示待办列表
6. 点击无完成待办的日期，验证弹窗显示空状态提示
7. 切换回「列表」模式，验证原有功能正常
8. 在日历模式中切换月份，验证数据正确更新
9. 运行 `npm run dev` 验证无 TypeScript/构建错误

