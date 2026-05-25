# Doit — AI Agent 开发指南

## 项目概述

Doit 是一个极简风格的桌面待办事项应用，基于 **Tauri 2 + Vue 3 + TypeScript**。支持勾选/长按完成模式、拖拽排序、FLIP 动画过渡、日报/周报 Markdown 和 PDF 导出。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Tauri 2 (Rust) |
| 前端框架 | Vue 3.5 (Composition API, `<script setup>`) |
| 类型系统 | TypeScript 5.6 (strict 模式) |
| 样式 | Tailwind CSS 4 + shadcn-vue/radix-vue 设计令牌 |
| 构建工具 | Vite 6 |
| 拖拽 | vuedraggable (SortableJS 的 Vue 3 封装) |
| 图标 | lucide-vue-next |
| 日期 | dayjs |
| 数据存储 | SQLite (Tauri) / localStorage (浏览器降级) |
| 报告导出 | jspdf (PDF)、Tauri dialog + fs APIs |

## 目录结构

```
doit/
├── src/                          # 前端源码
│   ├── main.ts                   # Vue 入口
│   ├── App.vue                   # 根组件（状态中心、事件协调）
│   ├── style.css                 # 全局样式 + shadcn-vue 设计令牌
│   ├── types/
│   │   └── index.ts              # TodoItem, AppSettings 接口定义
│   ├── services/
│   │   ├── tauriEnv.ts           # isTauri 环境检测
│   │   ├── todoService.ts        # 待办 CRUD（Tauri SQLite / localStorage 双模式）
│   │   └── settingsService.ts    # 设置读写（同上）
│   ├── components/
│   │   ├── TitleBar.vue          # 顶部栏（标题 + 报告/设置按钮）
│   │   ├── TodoList.vue          # 待办列表容器（拖拽、新增、FLIP 动画）
│   │   ├── TodoItem.vue          # 单条待办（勾选/长按/右键菜单/编辑）
│   │   ├── SettingsDialog.vue    # 设置弹窗（完成模式、长按时长、云同步）
│   │   └── ReportDialog.vue      # 报告弹窗（日报/周报、导出）
│   └── vite-env.d.ts             # Vue SFC 类型声明
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               # Rust 入口
│   │   └── lib.rs                # 插件注册、SQL migration、命令
│   ├── capabilities/default.json # 权限配置（fs、sql、dialog）
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # 窗口配置、打包参数
├── scripts/
│   └── generate-changelog.js     # Changelog 自动生成脚本（CI 用）
├── .gitee-ci.yml                 # Gitee CI/CD 流水线（Tag → Changelog → 构建 → Release）
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json                 # TS 严格模式、路径别名 @/*
└── vite.config.ts
```

## 架构模式

### 数据流（单向）

```
服务层 (Service)                  组件层 (Component)
─────────────────                ──────────────────
todoService.ts                   App.vue (状态持有者)
  .init()          ──────────→     todos ref, settings ref
  .getAllTodos()                  TodoList.vue (展示 + 用户操作)
  .addTodo()           ↑props      draggableList (拖拽副本)
  .updateTodo()        │emit       通过 watch(props.todos) 同步
  .deleteTodo()        │           通过 emit 将操作上报
  .reorderTodos()      │         TodoItem.vue (单条目渲染)
                       │           通过 emit 将操作上报 TodoList
settingsService.ts                TitleBar / SettingsDialog / ReportDialog
  .getSettings()                    通过 emit 打开/关闭弹窗
  .saveSettings()
```

### 事件层级

每个子组件只向直属父组件 emit 事件，不跨层。App.vue 是最终状态持有者：

```
TodoItem  ─emit──→  TodoList  ─emit──→  App.vue  ─调用──→  Service  ──→  Storage
                                       (更新 ref → 自动重新渲染)
```

### 双模式数据存储

[tauriEnv.ts](file:///c:/Users/nbn/workspace/gitee/doit/src/services/tauriEnv.ts) 检测运行时环境：

```
isTauri === true  → 动态 import("@tauri-apps/plugin-sql") → SQLite
isTauri === false → localStorage
```

所有 Tauri 特有 API 必须通过 `dynamic import()` 加载，避免浏览器 `ERR_ABORTED`。

## 编码规范

### TypeScript / Vue SFC

- **所有代码不使用注释**（遵循项目约定）
- `<script setup lang="ts">` 语法，Composition API
- `defineProps<T>()` + `defineEmits<T>()` 使用函数签名语法
- Emits 事件名用 **kebab-case**：`@toggle-complete`、`@start-edit`
- Handler 函数用 `handle*` 前缀：`handleAddTodo`、`handleToggleComplete`
- 局部事件处理用 `on*` 前缀：`onCheckboxClick`、`onContextMenu`
- `.ts` 文件不写分号，`.vue` 文件写分号
- 使用 `ref<T>()` 声明响应式变量、`computed()` 声明派生状态
- 类型导入用 `import type { X }` 前缀

### 样式

- **只用 Tailwind utility classes**，禁止内联 `<style>` 块
- 色彩用 CSS 变量 `var(--xxx)`，取自 [style.css](file:///c:/Users/nbn/workspace/gitee/doit/src/style.css) 中的 shadcn-vue 设计令牌
- 可用令牌：`--background`、`--foreground`、`--primary`、`--primary-foreground`、`--secondary`、`--muted`、`--muted-foreground`、`--accent`、`--destructive`、`--border`、`--ring`
- 深色模式：`.dark` 类自动切换
- 全局 `user-select: none`，需要选择的元素单独设置

### 拖拽相关

- 使用 `vuedraggable` 组件，**必须用 `:list` 单向绑定**，不能用 `v-model`
- 已完成条目加 `class="completed-item"` + `filter=".completed-item"` 禁止拖拽
- `@mousedown.stop` + `@click.stop` 阻断拖拽库的事件拦截
- FLIP 动画在 watch 中实现：记录旧位置 → 更新数据 → nextTick → 反向偏移 → CSS transition

### Tauri/浏览器兼容

- 前端开发用 `npm run dev`（Vite），可在浏览器调试
- 桌面开发用 `npm run tauri dev`（需要本地安装 Rust 工具链）
- Tauri APIs (`dialog`, `fs`, `sql`) 必须 `dynamic import()` 并用 `isTauri` 守卫
- `tauri.conf.json` 中 `app` 层级不能有 `title`，title 只在 `windows[]` 内

### Git 规范

- Commit 遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:`、`fix:`、`perf:`、`refactor:`、`style:`、`docs:`
- Tag 格式 `v*`（如 `v0.1.0`），推送后自动触发 CI 流水线
- CI 流程：生成 Changelog → 并行构建 Windows/macOS/Linux → 发布 Release

## 启动命令

```bash
npm run dev         # 纯前端开发（浏览器，无 Tauri API）
npm run tauri dev   # 完整桌面开发（需要 Rust 工具链）
npm run build       # 类型检查 + 前端构建
npm run tauri build # 打包当前平台安装包
```

## 关键规则速查

1. **不加任何注释** — 项目约定
2. Tauri API 必须 `dynamic import()` — 否则浏览器崩溃
3. vuedraggable 必须 `:list`，不能 `v-model` — 否则 FLIP 动画冲突
4. 色彩只用 `var(--xxx)` 令牌 — 不由 inline color
5. 拖拽交互的按钮加 `@mousedown.stop` + `@click.stop` — 防止 SortableJS 拦截
6. Service 文件 `.ts` 不加分号，`.vue` 文件加分号
7. 子组件只 emit，不修改 props — 单向数据流