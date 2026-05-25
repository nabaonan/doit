# Todo 桌面应用 - 项目实现计划

## 项目概述

使用 Tauri 2 + Vue 3 + shadcn-vue 构建的桌面端待办事项应用，具备便签式简洁界面，支持长按完成、拖拽排序、日报/周报生成和任务耗时统计。

***

## 一、项目初始化

### 1.1 创建 Tauri 2 + Vue 3 项目

* 项目创建在 `c:\Users\nbn\workspace\gitee\doit\` 目录下

* 使用 `npm create tauri-app@latest` 创建项目，选择 Vue + TypeScript 模板

* 项目名称：`doit`

* 配置 Tauri 2 基础设置（窗口大小、标题等）

### 1.2 安装依赖

* 安装 shadcn-vue 及相关依赖

* 安装 `tailwindcss`、`@tailwindcss/vite`

* 安装拖拽库：`@vueuse/core`（useDraggable 等）、`vuedraggable`（基于 SortableJS）

* 安装日期处理库：`dayjs`

* 安装图标库：`lucide-vue-next`

* 安装 PDF 生成库：`jspdf`

* 安装 Tauri SQL 插件：`tauri-plugin-sql`（Rust 端 + JS 端）

* Rust 端依赖：`rusqlite`（通过 tauri-plugin-sql）、`serde`、`serde_json`

* Rust 端 PDF 生成（备选）：`genpdf` crate

### 1.3 配置 shadcn-vue

* 初始化 shadcn-vue 组件库

* 按需添加所需组件：Button、Input、Checkbox、Dialog、Select、Slider、Progress 等

### 1.4 Tauri 后端配置

* 配置窗口为无边框或简洁标题栏样式

* 配置窗口最小尺寸

* 注册 `tauri-plugin-sql` 插件（SQLite）

* 注册 `tauri-plugin-dialog` 插件（文件保存对话框，用于导出）

* 注册 `tauri-plugin-fs` 插件（文件写入，用于导出报告文件）

***

## 二、数据模型设计

### 2.1 Todo 条目数据结构

```typescript
interface TodoItem {
  id: string;                    // 唯一标识
  content: string;               // 文本内容
  completed: boolean;            // 是否完成
  createdAt: string;             // 创建时间 (ISO)
  completedAt: string | null;    // 完成时间 (ISO)
  order: number;                 // 排序序号
}
```

### 2.2 应用设置数据结构

```typescript
interface AppSettings {
  completionMode: 'checkbox' | 'longpress';  // 完成方式
  longPressDuration: number;                  // 长按时长（秒），默认 3
  cloudSync: {
    enabled: boolean;                         // 是否启用云同步
    provider: 'webdav' | 'local_folder';     // 云同步方式
    webdavUrl: string;                        // WebDAV 地址
    webdavUsername: string;                   // WebDAV 用户名
    webdavPassword: string;                   // WebDAV 密码（加密存储）
    localSyncPath: string;                    // 本地文件夹同步路径
  };
}
```

### 2.3 SQLite 数据库表设计

```sql
-- 待办事项表
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 应用设置表（键值对）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

***

## 三、核心功能实现

### 3.1 主界面布局

* **顶部区域**：标题栏 + 右上角设置按钮（齿轮图标）

* **主内容区**：待办事项列表，占满整个窗口，字体尽可能大

* **整体风格**：极简便签风格，类似纸质便签

### 3.2 待办事项列表

#### 3.2.1 新增条目

* 列表顶部始终有一个空白的"输入框"占位（样式上看起来像便签行）

* 点击回车键：如果当前输入为空且列表中没有空条目，则新增一个空条目并获得焦点

* 如果已经有空条目未填写内容，再次回车不新增（防止连续空条目）

* 新增条目后直接进入编辑模式，可以输入文字

* 输入文字后按回车确认保存，如果内容为空则删除该条目

#### 3.2.2 编辑条目

* 双击条目进入编辑模式

* 编辑模式下按回车保存

* 点击其他区域或按 Escape 取消编辑

#### 3.2.3 排序规则

* 未完成的条目在上方显示

* 已完成的条目自动移到列表最下方

* 已完成条目显示删除线样式

### 3.3 拖拽排序

* 使用 `vuedraggable`（基于 SortableJS）实现拖拽排序

* 添加过渡动画（使用 Vue 的 `<TransitionGroup>` 或 draggable 内置动画）

* 拖拽结束后更新所有条目的 order 字段

* 已完成条目也可以拖拽，但始终保持在未完成条目下方

### 3.4 完成条目 - 双模式

#### 3.4.1 勾选完成模式

* 每条未完成条目左侧显示一个圆形复选框

* 点击勾选后，条目标记为完成，自动移动到列表底部，显示删除线

* 点击已完成条目的勾选框可以取消完成

#### 3.4.2 长按完成模式

* 用户长按条目触发完成流程

* 长按过程中，在当前被按下的条目上显示一个进度条（水平进度条，覆盖在条目背景上或条目下方）

* 进度条根据设置中的"长按完成时间"决定进度速度

* 长按达到设定时间后，条目标记为完成

* 如果中途松开，进度归零，不触发完成

### 3.5 设置面板

* 点击右上角齿轮图标打开设置弹窗（Dialog）

* **完成方式选择**：勾选完成 / 长按完成（单选框或下拉选择）

* **长按时长设置**：滑块（Slider），范围 1-10 秒，默认 3 秒

* **云同步设置**：

  * 启用/禁用云同步开关

  * 同步方式选择：WebDAV / 本地文件夹

  * WebDAV 配置：地址、用户名、密码

  * 本地文件夹：选择同步目录路径

  * 手动同步按钮 + 最后同步时间显示

* 设置变更实时保存

***

## 四、日报/周报功能

### 4.1 日报生成

* 统计当天已完成的所有条目

* 统计当天未完成的所有条目

* 生成格式化的文本报告，包含：

  * 日期

  * 已完成事项列表

  * 未完成事项列表

  * 完成率统计

### 4.2 周报生成

* 汇总本周（周一至周日）已完成条目

* 汇总本周未完成条目

* 未完成的条目会一直保留延续（跨天跨周持续追踪）

* 生成格式化的文本报告

### 4.3 报告展示与操作

* 使用弹窗展示报告内容

* 提供一键复制到剪贴板功能

* 报告入口放在设置面板中或右上角菜单中

### 4.4 报告导出

#### 4.4.1 Markdown 导出

* 前端直接拼接 Markdown 格式文本

* 通过 Tauri 的 `dialog.save()` 选择保存路径

* 通过 Tauri 的 `fs.writeTextFile()` 写入 `.md` 文件

* Markdown 模板包含标题、日期、分类列表、完成率

#### 4.4.2 PDF 导出

* 使用 `jspdf` 在前端生成 PDF

* 将报告内容渲染为 PDF 页面，支持中文（需嵌入中文字体）

* 通过 Tauri 的 `dialog.save()` 选择保存路径

* 将生成的 PDF blob 写入文件

* PDF 排版包含：标题、生成日期、已完成/未完成分区表格、完成耗时统计

***

## 五、统计功能

### 5.1 任务耗时统计

* 每个已完成条目记录 `createdAt` 和 `completedAt`

* 计算从创建到完成的时间差

* 在条目的详细信息中展示耗时（如 "耗时: 2小时30分"）

* 可以在已完成条目旁边以小字形式展示耗时

### 5.2 统计数据展示（可选优化）

* 在报告中也包含平均完成耗时

* 统计本周/本月完成效率

***

## 六、数据持久化

### 6.1 SQLite 本地数据库

* 使用 `tauri-plugin-sql` 插件，底层基于 SQLite

* 数据库文件默认存储在 Tauri 应用数据目录：`$APPDATA/doit/doit.db`

* SQLite 优势：轻量嵌入式、零配置、查询快、支持索引、事务安全

* 初始化时自动建表（todos + settings）

### 6.2 数据访问层设计

* 前端通过 `tauri-plugin-sql` 的 JS API 直接执行 SQL 查询

* 封装 `todoService` 服务层，提供统一的 CRUD 接口：

  * `getAllTodos()` - 查询所有条目，按 sort\_order 排序

  * `addTodo(item)` - 新增条目

  * `updateTodo(id, data)` - 更新条目

  * `deleteTodo(id)` - 删除条目

  * `reorderTodos(ids)` - 批量更新排序

  * `getSettings()` - 读取设置

  * `updateSetting(key, value)` - 更新单个设置

* 排序逻辑：未完成条目 sort\_order 递增，已完成条目 sort\_order = 原有值 + 一个大偏移量

### 6.3 云同步方案

* **同步方式一：本地文件夹同步**

  * 将 `todo.db` 文件复制到用户指定的本地同步目录（如 iCloud、OneDrive、Dropbox 文件夹）

  * 应用启动时检查同步目录中的数据库文件是否更新，自动合并

  * 定时自动同步（可配置间隔），也支持手动触发

* **同步方式二：WebDAV 远程同步**

  * 在 Rust 后端实现 WebDAV 客户端（使用 `reqwest` crate）

  * 将 `todo.db` 文件上传/下载到 WebDAV 服务器

  * 同步策略：基于 `updated_at` 时间戳对比，以最新数据为准

  * WebDAV 密码使用系统凭据存储或加密后存入本地设置表

* 同步状态 UI 提示：设置面板中显示"最后同步时间"和同步状态

***

## 七、UI 组件树

```
App.vue
├── TitleBar.vue                    # 顶部栏
│   ├── 应用标题
│   ├── ReportMenu.vue              # 报告菜单（日报/周报生成 + 导出）
│   └── SettingsButton.vue          # 设置按钮
├── TodoList.vue                    # 主内容区
│   ├── TodoInput.vue               # 新增输入区（回车新增）
│   └── TodoItem.vue (v-for)        # 单个待办条目
│       ├── 复选框 / 长按进度条
│       ├── 文本内容（编辑/展示模式）
│       └── 完成时间耗时小字
├── SettingsDialog.vue              # 设置弹窗
│   ├── 完成方式选择
│   ├── 长按时长滑块
│   └── CloudSyncSettings.vue       # 云同步设置子组件
│       ├── 启用开关
│       ├── 同步方式选择
│       ├── WebDAV 配置表单
│       └── 本地文件夹路径选择 + 同步按钮
└── ReportDialog.vue                # 报告弹窗
    ├── 日报/周报切换
    ├── 报告内容展示
    ├── 复制按钮
    ├── 导出 Markdown 按钮
    └── 导出 PDF 按钮
```

***

## 八、实现步骤（按优先级）

### Phase 1: 项目搭建

1. 创建 Tauri 2 + Vue 3 项目
2. 安装配置 Tailwind CSS + shadcn-vue
3. 配置 Tauri 窗口和基础设置
4. 集成 tauri-plugin-sql，初始化 SQLite 数据库和建表

### Phase 2: 核心列表功能

1. 实现 TodoItem 数据模型和 SQLite 数据访问层（todoService）
2. 实现主界面布局（极简便签风格）
3. 实现回车新增条目功能（含空条目防重复逻辑）
4. 实现双击编辑、回车保存功能

### Phase 3: 拖拽与排序

1. 集成拖拽排序功能
2. 实现过度动画
3. 实现完成/未完成自动分组排序

### Phase 4: 完成模式

1. 实现勾选完成模式
2. 实现长按完成模式（含进度条动画）
3. 实现设置面板（完成模式切换 + 时长设置）

### Phase 5: 报告与导出

1. 实现日报/周报生成逻辑
2. 实现 Markdown 导出功能
3. 实现 PDF 导出功能（jspdf + 中文字体）
4. 实现报告复制到剪贴板功能

### Phase 6: 云同步

1. 实现本地文件夹同步（数据库文件复制 + 定时同步）
2. 实现 WebDAV 远程同步（Rust 端 WebDAV 客户端）
3. 实现云同步设置界面

### Phase 7: 统计与优化

1. 实现任务耗时统计与展示
2. UI 细节打磨（字体大小、间距、动画）
3. 边界情况处理与 bug 修复

### Phase 8: 构建与发布

1. 配置 tauri.conf.json 多平台打包参数
2. 编写 `scripts/generate-changelog.js` Changelog 自动生成脚本（按 feat/fix/perf 等分类）
3. 初始化 Git 仓库，添加 `.gitignore`
4. 关联远程仓库 `git@gitee.com:nabaonan/doit.git` 并推送
5. 配置 `.gitee-ci.yml` Gitee 流水线（Tag 触发 → Changelog → 多平台构建 → Release）
6. 测试打 tag 触发流水线，验证各平台打包产物

***

## 九、关键技术点

### 拖拽实现

* 使用 `vuedraggable` 组件（基于 SortableJS，Vue 3 兼容）

* 结合 Vue 的 `<TransitionGroup>` 实现流畅动画

### 长按进度条

* 监听 `mousedown`/`touchstart` 和 `mouseup`/`touchend` 事件

* 使用 `setInterval` 或 `requestAnimationFrame` 更新进度

* 进度条使用 CSS transition 实现平滑效果

* 在条目背景上叠加半透明进度条

### SQLite 数据持久化

* 通过 `tauri-plugin-sql` 插件在前端直接执行 SQL

* 应用启动时自动建表和迁移

* 使用参数化查询防止 SQL 注入

* 利用 SQLite 的索引加速按时间和排序字段的查询

### 云同步实现

* **本地文件夹同步**：Rust 端监听文件变化 + 定时任务复制 `todo.db` 到同步目录

* **WebDAV 同步**：Rust 端使用 `reqwest` + `dav-server` 相关 crate 实现 WebDAV 客户端，支持 PUT/GET/PROPFIND

* 同步冲突处理：以 `updated_at` 时间戳为准，最新数据覆盖旧数据

### PDF 导出

* 使用 `jspdf` 前端库生成 PDF

* 中文支持：嵌入思源黑体或使用 `jspdf` 的自定义字体功能

* PDF 布局：标题 + 日期 + 表格分区（已完成/未完成）

* 通过 `tauri-plugin-dialog` 选择保存路径，`tauri-plugin-fs` 写入文件

### Markdown 导出

* 前端纯逻辑实现，拼接 Markdown 格式文本

* 通过 `tauri-plugin-dialog` 选择保存路径，`tauri-plugin-fs` 写入 `.md` 文件

### 报告生成

* 前端纯逻辑实现，通过 dayjs 筛选日期范围

* 使用模板字符串拼接报告内容

* 通过 `navigator.clipboard.writeText()` 复制到剪贴板

***

## 十、构建与打包

### 10.1 源码启动（开发模式）

```bash
# 安装前端依赖
npm install

# 启动开发服务器（热更新）
npm run tauri dev
```

* 开发模式支持热更新（HMR），前端改动即时生效

* Rust 后端改动会自动重新编译

* 系统要求：

  * **Windows**：Microsoft Visual Studio C++ Build Tools、WebView2

  * **macOS**：Xcode Command Line Tools

  * **Linux**：`libwebkit2gtk-4.1-dev`、`libgtk-3-dev` 等系统依赖

### 10.2 打包配置（tauri.conf.json）

在 `tauri.conf.json` 的 `bundle` 配置中设置多平台打包目标：

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "wix": {
        "language": "zh-CN"
      },
      "nsis": {
        "languages": ["SimpChinese", "English"]
      }
    },
    "macOS": {
      "minimumSystemVersion": "10.15"
    },
    "linux": {
      "deb": {
        "depends": []
      }
    }
  }
}
```

### 10.3 各平台打包产物

| 平台          | 打包格式                        | 架构支持                                    | 打包命令                  |
| ----------- | --------------------------- | --------------------------------------- | --------------------- |
| **Windows** | `.exe` 安装包（NSIS/WiX）、`.msi` | x86\_64、aarch64                         | `npm run tauri build` |
| **macOS**   | `.dmg`、`.app`               | Intel (x86\_64)、Apple Silicon (aarch64) | `npm run tauri build` |
| **Linux**   | `.deb`、`.AppImage`、`.rpm`   | x86\_64、aarch64                         | `npm run tauri build` |

### 10.4 CI/CD 自动构建（Gitee 流水线）

使用 Gitee CI 流水线，通过 **打 Tag** 触发多平台构建 + 自动生成 Changelog。

#### 触发方式

* **Tag 触发**：推送 `v*` 格式的 tag（如 `v1.0.0`）自动触发构建流水线

* 推送 master/main 分支不触发构建，仅打 tag 时触发

#### Changelog 自动生成

每次打 tag 后，自动收集**上一个 tag 到当前 tag** 之间的所有 commit message，按 [Conventional Commits](https://www.conventionalcommits.org/) 规范分类写入 `CHANGELOG.md`：

| 分类         | 前缀                          | 说明         |
| ---------- | --------------------------- | ---------- |
| **新功能**    | `feat:` / `feature:`        | 新增功能       |
| **Bug 修复** | `fix:` / `bugfix:`          | BUG 修复     |
| **性能优化**   | `perf:`                     | 性能提升       |
| **重构**     | `refactor:`                 | 代码重构       |
| **样式**     | `style:`                    | UI 样式调整    |
| **文档**     | `docs:`                     | 文档更新       |
| **测试**     | `test:`                     | 测试相关       |
| **构建/工具**  | `build:` / `chore:` / `ci:` | 构建配置、依赖更新等 |

未被分类的 commit 归入 **「其他变更」**。

#### Changelog 脚本设计

在项目根目录创建 `scripts/generate-changelog.js`，通过 Node.js 脚本实现：

```javascript
// 核心逻辑
const { execSync } = require('child_process');

// 1. 获取所有 tag 列表，取最新的两个 tag
const tags = execSync('git tag --sort=-v:refname').toString().trim().split('\n');
const currentTag = tags[0];  // 当前 tag
const previousTag = tags[1]; // 上一个 tag

// 2. 获取两个 tag 之间的 commit 列表
const range = previousTag 
  ? `${previousTag}..${currentTag}` 
  : currentTag;  // 首次 tag 取所有历史
const log = execSync(`git log ${range} --pretty=format:"%s|||%h|||%an"`);

// 3. 按 conventional commit 前缀分类
// 4. 生成 Markdown 格式的 CHANGELOG.md
// 5. 追加到现有 CHANGELOG.md 顶部
```

#### Gitee 流水线配置

```yaml
# .gitee-ci.yml
name: Build & Release

on:
  push:
    tags:
      - 'v*'

jobs:
  # Job 1: 生成 Changelog
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 拉取完整历史

      - name: 生成 CHANGELOG
        run: node scripts/generate-changelog.js

      - name: 提交 CHANGELOG
        run: |
          git config user.name "CI Bot"
          git config user.email "ci@bot.com"
          git add CHANGELOG.md
          git commit -m "docs: update CHANGELOG for ${{ gitee.ref_name }}"
          git push

  # Job 2: 构建各平台安装包
  build:
    needs: changelog
    strategy:
      matrix:
        target:
          - { os: windows-latest, target: x86_64-pc-windows-msvc, ext: exe }
          - { os: windows-latest, target: aarch64-pc-windows-msvc, ext: exe }
          - { os: macos-latest, target: x86_64-apple-darwin, ext: dmg }
          - { os: macos-latest, target: aarch64-apple-darwin, ext: dmg }
          - { os: ubuntu-latest, target: x86_64-unknown-linux-gnu, ext: deb }
          - { os: ubuntu-latest, target: aarch64-unknown-linux-gnu, ext: deb }
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          target: ${{ matrix.target }}

      - name: Build
        run: npm run tauri build -- --target ${{ matrix.target }}

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: doit-${{ matrix.target }}
          path: src-tauri/target/${{ matrix.target }}/release/bundle/

  # Job 3: 发布 Release（将产物附加到 Gitee Release 页面）
  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: 下载所有构建产物
        - uses: actions/download-artifact@v4
      
      - name: 读取 CHANGELOG 作为 Release 说明
        run: |
          echo "RELEASE_BODY<<EOF" >> $GITHUB_ENV
          cat CHANGELOG.md >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV

      - name: 创建 Gitee Release
        uses: gitee-actions/release@v1
        with:
          tag_name: ${{ gitee.ref_name }}
          body: ${{ env.RELEASE_BODY }}
          files: |
            bundle/**/*.exe
            bundle/**/*.dmg
            bundle/**/*.deb
```

#### 流水线执行流程总结

```
开发者推送 tag (v1.0.0)
        │
        ▼
  ┌─────────────────┐
  │  Job: Changelog │  提取 v0.9.0..v1.0.0 之间的 commit
  │  生成分类报告    │  → 写入 CHANGELOG.md → 推送回仓库
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────┐
  │  Job: Build (Matrix 并行 6 个任务)   │
  │  Windows x64  │  macOS Intel         │
  │  Windows ARM  │  macOS Apple Silicon  │
  │  Linux x64    │  Linux ARM           │
  └────────┬────────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────────┐
  │  Job: Release                        │
  │  创建 Gitee Release                  │
  │  → 上传所有平台安装包                 │
  │  → Release 说明内容 = CHANGELOG      │
  └──────────────────────────────────────┘
```

#### 关键配置要点

* **Rust target**：通过 `rustup target add` 添加对应的交叉编译目标

* **Windows 安装包**：使用 NSIS（轻量）或 WiX（功能全），生成 `.exe` 安装程序

* **macOS DMG**：自动生成 `.dmg` 磁盘映像，需在 macOS 环境下构建

* **Linux ARM64 交叉编译**：需要 `gcc-aarch64-linux-gnu` 等交叉编译工具链

* **代码签名**（可选）：macOS 需要 Apple Developer 证书、Windows 需要代码签名证书

### 10.5 本地手动构建命令

```bash
# 开发调试（不打包，快速测试）
npm run tauri dev

# 构建当前平台的发布包
npm run tauri build

# 构建指定目标平台（需要对应 Rust target）
npm run tauri build -- --target x86_64-pc-windows-msvc    # Windows x64
npm run tauri build -- --target aarch64-pc-windows-msvc    # Windows ARM
npm run tauri build -- --target x86_64-apple-darwin         # macOS Intel
npm run tauri build -- --target aarch64-apple-darwin        # macOS Apple Silicon
npm run tauri build -- --target x86_64-unknown-linux-gnu    # Linux x64
npm run tauri build -- --target aarch64-unknown-linux-gnu   # Linux ARM

# 构建产物输出目录
# 默认路径：src-tauri/target/release/bundle/
```

### 10.6 版本管理与自动更新（可选扩展）

* 通过 `tauri.conf.json` 中的 `version` 字段管理版本号

* Tauri 2 内置更新支持，可对接自建更新服务器

* 更新签名确保安装包完整性

