# CLAUDE.md

## 项目简介

Doit — Tauri 2 + Vue 3 + TypeScript 构建的极简桌面待办事项应用。便签风格界面，支持勾选/长按完成、拖拽排序、FLIP 过渡动画、日报/周报和多格式导出。

## 技术栈

- **桌面壳**: Tauri 2 (Rust), EDITION="2021"
- **前端**: Vue 3.5 Composition API `<script setup>`, TypeScript 5.6 strict
- **样式**: Tailwind CSS 4 + shadcn-vue/radix-vue 设计令牌 (CSS 变量)
- **构建**: Vite 6
- **拖拽**: vuedraggable (SortableJS Vue 3 封装)
- **图标**: lucide-vue-next
- **日期**: dayjs + isoWeek 插件
- **存储**: SQLite (Tauri 插件) + localStorage 浏览器降级
- **导出**: jspdf (PDF) + Tauri dialog/fs APIs

## 目录速览

```
src/
├── types/index.ts           ← 唯一数据模型 (TodoItem, AppSettings)
├── services/
│   ├── tauriEnv.ts          ← isTauri 环境检测
│   ├── todoService.ts       ← 待办 CRUD (双模式)
│   └── settingsService.ts   ← 设置读写 (双模式)
├── components/
│   ├── TodoList.vue         ← 核心容器: 拖拽/新增/FLIP 动画/watch 同步
│   ├── TodoItem.vue         ← 单条目: 勾选/长按/右键菜单/编辑视图
│   ├── TitleBar.vue         ← 顶部栏
│   ├── SettingsDialog.vue   ← 设置弹窗
│   └── ReportDialog.vue     ← 报告弹窗
└── App.vue                  ← 状态持有者 + 事件协调
```

## 数据流与事件链

```
TodoItem ─emit─→ TodoList ─emit─→ App.vue ─调用─→ Service ──→ Storage(SQLite/localStorage)
                                     ↑
                            const todos = ref<TodoItem[]>([])
                            修改 ref → 自动重渲染所有子组件
```

- **App.vue** 持有所有状态 (`todos`, `settings`)，是唯一的 "single source of truth"
- 子组件通过 `defineEmits<T>()` 上报事件，不跨层
- **TodoList.vue** 维护本地 `draggableList` (拖拽副本)，通过 `watch(props.todos, deep)` 与 props 同步
- 同步时执行 **FLIP 动画**：`getBoundingClientRect` 快照 → 更新 → `nextTick` → `transform` 反向偏移 → CSS transition

## 编码规范

### 必须遵守

- **不加注释** — 所有代码零注释
- `.ts` 文件不用分号，`.vue` 文件用分号
- `defineProps<T>()` + `defineEmits<T>()` (函数签名语法)
- emit 事件名: **kebab-case** (`@toggle-complete`, `@start-edit`)
- handler: `handle*` 前缀; 局部事件: `on*` 前缀
- 类型导入: `import type { X }`
- 表单深拷贝 props: `JSON.parse(JSON.stringify(props.xxx))`

### 样式

- **只使用 Tailwind utility classes**，不允许 `<style>` 块
- 所有颜色用 CSS 变量: `bg-[var(--background)]`、`text-[var(--foreground)]`、`border-[var(--border)]`
- 可用令牌: `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--ring`
- 深色模式: `.dark` 类自动切换

### 拖拽 (vuedraggable)

- **必须 `:list`**，禁止 `v-model`（FLIP 动画会冲突崩溃）
- 已完成条目: `class="completed-item"` + `filter=".completed-item"`
- 交互按钮加 `@mousedown.stop` + `@click.stop` 阻断 SortableJS 拦截

### Tauri 兼容

- Tauri API 必须 `dynamic import()`: `await import("@tauri-apps/plugin-sql")`
- 每个 Tauri 调用前用 `isTauri` 守卫
- `tauri.conf.json` 的 `app` 层不能加 `title`（放 `windows[].title`）

## 关键陷阱

| 陷阱 | 原因 | 解决 |
|------|------|------|
| 勾选/编辑后 UI 不刷新 | `getAllTodos()` localStorage 不排序 | `sortTodos()` 按 `completed ASC, order ASC` 排序 |
| 右键菜单点击无反应 | SortableJS 拦截了 click | `@mousedown.stop` + `@click.stop` |
| 长按完成时 `Cannot read 'index'` 崩溃 | `v-model` 双向绑定干扰 FLIP | 改用 `:list` 单向绑定 |
| 浏览器 `ERR_ABORTED` | 顶层 import Tauri 原生模块 | `dynamic import()` + `isTauri` 守卫 |
| FLIP `querySelectorAll is not a function` | `ref` 放在 vue 组件上 | `ref` 放包裹 `<div>` 上 |

## 命令

```bash
npm run dev         # Vite 开发服务器 (浏览器调试)
npm run tauri dev   # Tauri 桌面开发 (需 Rust)
npm run build       # 类型检查 + 构建
npm run tauri build # 打包安装包
```

## Git / CI

- Commit: Conventional Commits (`feat:`, `fix:`, `perf:`, ...)
- Tag `v*` → 自动触发 Gitee CI → Changelog + 多平台构建 + Release