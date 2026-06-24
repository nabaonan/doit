# 周报/日报预览框改为 Markdown 解析渲染

## 概述

`ReportDialog.vue` 的预览框当前用 `<pre>` 直接显示 markdown 源码，体验差。改为：引入 `marked` 解析器把 `reportText` 转成 HTML，用 `v-html` 渲染。完全去掉手写 HTML 渲染逻辑（不再新增递归子组件、不再用 Tailwind class 逐元素拼装）。

**关键决策**：
- **使用 `marked` 作为 markdown 解析器**（不是 `markdown-it`）—— 更小（~30KB）、API 更简单、GFM 默认开启可渲染任务列表 `[x]` / `[ ]`
- **不引入 `@tailwindcss/typography`** —— 用 Tailwind 4 的 arbitrary variants `[&_selector]:` 给渲染后的 HTML 加最少样式（list/heading/input checkbox）
- **保留 `reportText`** —— 复制 / 导出 Markdown / 导出 PDF 仍依赖 markdown 字符串
- **安全性**：`marked` 默认转义输入中的 HTML（`<script>` 等会被渲染为文本），不需额外引入 sanitizer

---

## 当前状态分析

**已有能力**：
- [src/components/ReportDialog.vue:142-170](file:///Users/nbn/workspace/github/doit/src/components/ReportDialog.vue#L142-L170) `reportText` computed 生成 markdown 字符串
- [src/components/ReportDialog.vue:398-402](file:///Users/nbn/workspace/github/doit/src/components/ReportDialog.vue#L398-L402) 当前预览框是 `<pre>{{ reportText }}</pre>`，直接显示 markdown 源码
- [package.json](file:///Users/nbn/workspace/github/doit/package.json) 当前无 markdown 解析库；`dompurify` 已是间接依赖（jspdf 引入），但未在项目 package.json 中

**关键缺口**：
- 缺少 markdown → HTML 的解析能力
- 预览框无渲染样式

**报告 markdown 结构**（来自 `renderTreeMarkdown` + `reportText`）：

```
# Doit 报告
**日期**: 2026年06月24日
**完成率**: 5/8 (63%)

## 工作分类
完成率: 3/5 (60%)
- [x] Task 1 (5 分钟)
  - [x] Subtask 1.1 (2 分钟)
- [ ] Task 2
```

涉及的 markdown 语法：
- `#` `##` 标题
- `**bold**` 粗体
- `- list` 列表（带 2 空格缩进表示嵌套）
- `[x]` / `[ ]` 任务列表（GFM 扩展）

---

## 详细变更

### 1. 新增依赖：[package.json](file:///Users/nbn/workspace/github/doit/package.json)

在 `dependencies` 中新增：

```json
"marked": "^15.0.0"
```

执行 `npm install` 拉取依赖。

**为什么 `marked`**：
- 体积小（~30KB minified）
- 默认 GFM 开启（任务列表 `[x]` 自动渲染成 `<input type="checkbox" checked>`）
- 默认转义 HTML 输入（XSS 安全）
- API 简单：`marked.parse(text, { gfm: true })` → HTML 字符串
- 与项目现有 `dayjs` / `jspdf` 风格一致（轻量 + 单一职责）

**为什么不用 `markdown-it`**：
- 体积大（~80KB）
- 任务列表需额外插件 `markdown-it-task-lists`
- API 略复杂

**为什么不用 `@tailwindcss/typography`**：
- 增加 1 个依赖（typography 插件包）
- Tailwind 4 启用方式需修改 `style.css`（`@plugin "@tailwindcss/typography"`）
- 用 arbitrary variants 足以覆盖本报告的简单结构

### 2. 修改预览框：[src/components/ReportDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/ReportDialog.vue)

**2.1 引入 `marked`**（约第 6 行 `import { jsPDF } from "jspdf"` 之后）：

```ts
import { marked } from "marked";
```

**2.2 新增 `reportHtml` computed**（约第 142 行 `reportText` computed 之后）：

```ts
const reportHtml = computed(() => marked.parse(reportText.value, { gfm: true }));
```

- `gfm: true` —— 开启 GitHub Flavored Markdown，让 `- [x]` 渲染为复选框
- `marked` 默认转义 HTML 输入，TodoItem.content 中的 `<` `>` `&` 等特殊字符安全处理
- 单次解析，结果缓存为 computed

**2.3 替换预览框**（约 398-402 行的 `<pre>` 块）：

旧代码：
```vue
<div
  class="bg-[var(--secondary)] rounded-lg p-4 mb-4 max-h-[300px] overflow-y-auto"
>
  <pre class="text-sm text-[var(--foreground)] whitespace-pre-wrap font-mono leading-relaxed">{{ reportText }}</pre>
</div>
```

新代码：
```vue
<div
  class="bg-[var(--secondary)] rounded-lg p-4 mb-4 max-h-[300px] overflow-y-auto text-sm text-[var(--foreground)] [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:accent-[var(--primary)] [&_input[type=checkbox]]:size-3.5"
  v-html="reportHtml"
></div>
```

**样式说明**（Tailwind 4 arbitrary variants `[&_selector]:`）：
| 选择器 | 样式 | 作用 |
|--------|------|------|
| `[&_h1]` | `text-base font-bold mb-2 mt-1` | 「Doit 报告」标题加粗 |
| `[&_h2]` | `text-sm font-semibold mb-1 mt-2` | 分类名次级标题 |
| `[&_p]` | `my-1` | 段落间距 |
| `[&_ul]` | `list-disc pl-5 my-1` | 列表恢复默认圆点 + 缩进（Tailwind preflight 会重置） |
| `[&_ol]` | `list-decimal pl-5` | 有序列表 |
| `[&_li]` | `my-0.5` | 列表项间距 |
| `[&_strong]` | `font-semibold` | 加粗（如「**日期**」） |
| `[&_input[type=checkbox]]` | `mr-1.5 accent-primary size-3.5` | 复选框缩进 + 主题色 + 小尺寸 |

**为什么用 arbitrary variants 而不是 prose**：
- 0 新增依赖
- 与项目 CSS 变量（`--primary` / `--foreground`）直接联动
- 覆盖范围刚好够用

### 3. 不涉及的改动

- `reportText` computed —— 保留不变（复制按钮、Markdown 导出、PDF 导出都依赖）
- `renderTreeMarkdown` / `formatDuration` / `formatDate` / `groupStats` —— 保留
- `flatToNested` —— 保留
- `buildPDFDoc` —— 保留（PDF 走独立渲染路径）
- `style.css` —— 不修改

---

## 涉及文件清单

| 文件 | 变更类型 | 摘要 |
|------|---------|------|
| [package.json](file:///Users/nbn/workspace/github/doit/package.json) | 编辑 | `dependencies` 新增 `marked: ^15.0.0` |
| [src/components/ReportDialog.vue](file:///Users/nbn/workspace/github/doit/src/components/ReportDialog.vue) | 编辑 | import `marked`；新增 `reportHtml` computed；`<pre>` 替换为 `<div v-html="reportHtml">` + arbitrary variants 样式 |

新增文件：无（`ReportPreviewNode.vue` 不再需要）

---

## 关键决策与假设

- **决策 1**：`marked` vs. `markdown-it`
  - 选定 `marked` —— 体积小、API 简单、GFM 内置、本项目结构简单
  - 否决 `markdown-it` —— 体积大、任务列表需额外插件

- **决策 2**：arbitrary variants vs. `@tailwindcss/typography`
  - 选定 arbitrary variants —— 0 新增依赖、与 CSS 变量联动
  - 否决 typography 插件 —— 增加 1 个依赖，启用方式较繁琐

- **决策 3**：不删除 `reportText`
  - 复制按钮、Markdown 导出、PDF 导出都依赖 markdown 字符串
  - `reportHtml` 仅用于 UI 预览

- **决策 4**：不引入 sanitizer
  - `marked` 默认转义 HTML 输入
  - 数据源是 TodoItem.content（用户文本），无恶意 HTML 风险
  - 引入 `dompurify` 需额外配置

- **假设 1**：`marked@15.x` 的 `gfm: true` 默认行为符合预期
  - 任务列表 `- [x]` 渲染为 `<li><input type="checkbox" checked disabled> text</li>`
  - 验证方式：手动打开报告预览检查

- **假设 2**：Tailwind 4 arbitrary variants `[&_input[type=checkbox]]` 语法生效
  - Tailwind 4 支持完整的 `[&_selector]:` 嵌套选择器语法
  - 验证方式：`npm run build` 编译通过 + 手动检查样式

- **假设 3**：`marked` 包在 Tauri 打包时无 node 内置依赖
  - `marked` 是纯 JS 包，无 fs/path 等 node API
  - 验证方式：参考 Tauri 文档 + 实际打包测试

---

## 验证步骤

### 编译验证
- `npm install` 安装 `marked` 成功
- `npm run build` 退出码 0
- TypeScript 无 `marked` 类型错误

### 手动验证

1. **空数据**
   - 选一个无任何本周/今日 todo 的日期或分类 → 预览框显示「暂无数据」（来自 markdown 文本）

2. **基础渲染**
   - 有 todo 时 → 预览框显示：
     - 「Doit 报告」作为 H1（加粗大字）
     - 「**日期**」加粗、冒号后值正常
     - 「**完成率**」同上
     - 分类名作为 H2
     - 列表项渲染为带圆点的 ul/li
     - `[x]` 渲染为已选中的复选框
     - `[ ]` 渲染为未选中的复选框

3. **复选框样式**
   - 复选框大小适中（3.5）
   - 复选框颜色使用主题色（var(--primary)）
   - 复选框与文字有间距

4. **嵌套缩进**
   - 子 todo 列表在父列表内缩进显示
   - 缩进量合理（pl-5 = 1.25rem）

5. **深色模式**
   - 切换深色主题 → 预览框文字、复选框、列表样式仍可读
   - `text-[var(--foreground)]` 自适应主题

6. **复制按钮（回归）**
   - 点击「复制到剪贴板」→ 剪贴板内容为 markdown 源码（不是 HTML）

7. **导出 Markdown（回归）**
   - 点击「导出 Markdown」→ 文件内容与之前一致

8. **导出 PDF（回归）**
   - 点击「导出 PDF」→ PDF 内容与之前一致

9. **XSS 安全性**
   - 创建一个 todo 内容为 `<script>alert('xss')</script>`
   - 预览框中应显示为文本（`&lt;script&gt;`），不触发脚本
   - 导出 Markdown / PDF 同理

### 视觉回归
- 预览框容器 `max-h-[300px] overflow-y-auto` 保持不变 → 内容溢出时正常滚动
- 背景色 `bg-[var(--secondary)]` 与原一致
- 整体视觉风格与 TodoList 主界面协调
