# Doit

极简桌面待办事项应用 — 便签风格，专注高效。

基于 Tauri 2 + Vue 3 + TypeScript 构建，支持 Windows / macOS / Linux。

## 功能

- **待办管理** — 快速新增、勾选完成、长按完成、右键操作
- **拖拽排序** — 拖拽调整顺序，FLIP 过渡动画流畅自然
- **日报 / 周报** — 统计完成率、耗时，一键查看
- **多格式导出** — 复制到剪贴板、导出 Markdown、导出 PDF
- **深色模式** — 跟随系统 / 浅色 / 深色
- **标签系统** — 自定义颜色标签，分类管理
- **本地存储** — SQLite 存储（Tauri 桌面环境），浏览器降级 localStorage

## 下载

前往 [Releases](https://github.com/nabaonan/doit/releases) 页面下载对应平台的安装包：

| 平台 | 格式 |
|---|---|
| Windows | `.msi` / `.exe` |
| macOS (Intel) | `.dmg` |
| macOS (Apple Silicon) | `.dmg` |
| Linux | `.deb` / `.AppImage` |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) (Tauri 桌面开发需要)

### 启动

```bash
# 安装依赖
npm install

# 浏览器开发模式
npm run dev

# Tauri 桌面开发模式
npm run tauri dev
```

### 构建

```bash
# 前端类型检查 + 构建
npm run build

# Tauri 桌面打包
npm run tauri build
```

### 发版

```bash
npm run release
```

自动 bump 版本号、同步 Tauri 配置、提交、打 tag 并推送，触发 CI 多平台构建发布。

## 技术栈

| 类别 | 技术 |
|---|---|
| 桌面壳 | Tauri 2 (Rust) |
| 前端框架 | Vue 3.5 Composition API |
| 类型系统 | TypeScript 5.9 strict |
| 构建工具 | Vite 8 + Rolldown |
| 样式方案 | Tailwind CSS 4 + radix-vue 设计令牌 |
| 拖拽 | vuedraggable (SortableJS) |
| 图标 | @lucide/vue |
| 日期处理 | dayjs |
| PDF 导出 | jsPDF |

## 项目结构

```
src/
├── types/index.ts           # 数据模型 (TodoItem, AppSettings)
├── services/
│   ├── tauriEnv.ts          # isTauri 环境检测
│   ├── todoService.ts       # 待办 CRUD (双模式)
│   └── settingsService.ts   # 设置读写 (双模式)
├── components/
│   ├── TodoList.vue         # 核心容器: 拖拽/新增/FLIP 动画
│   ├── TodoItem.vue         # 单条目: 勾选/长按/右键/编辑
│   ├── TitleBar.vue         # 顶部栏
│   ├── SettingsDialog.vue   # 设置弹窗
│   └── ReportDialog.vue     # 报告弹窗
└── App.vue                  # 状态持有者 + 事件协调
```

## License

MIT